const Producto = require('../models/Producto.model');

// Servicio para obtener estadísticas generales de productos (con sucursal)
const obtenerEstadisticasProductos = async (filtros = {}) => {
    try {
        const matchFiltros = { activo: true, ...filtros };
        
        const estadisticas = await Producto.aggregate([
            { $match: matchFiltros },
            {
                $group: {
                    _id: filtros.sucursal ? '$sucursal' : null,
                    totalProductos: { $sum: 1 },
                    stockTotal: { $sum: '$stockActual' },
                    valorInventario: { 
                        $sum: { $multiply: ['$stockActual', '$precioCompra'] } 
                    },
                    productosBajoStock: {
                        $sum: { $cond: ['$alertaStock', 1, 0] }
                    }
                }
            }
        ]);
        
        // Si hay filtro de sucursal, popular información
        if (filtros.sucursal && estadisticas.length > 0) {
            const Sucursal = require('../models/Sucursal.model');
            const sucursalInfo = await Sucursal.findById(filtros.sucursal, 'nombre codigo');
            
            return {
                ...estadisticas[0],
                sucursal: sucursalInfo
            };
        }
        
        return estadisticas[0] || {
            totalProductos: 0,
            stockTotal: 0,
            valorInventario: 0,
            productosBajoStock: 0
        };
    } catch (error) {
        throw new Error('Error al calcular estadísticas: ' + error.message);
    }
};

// Servicio para obtener productos por categoría, género y sucursal
const obtenerProductosPorCategoria = async (sucursal = null) => {
    try {
        const filtros = { activo: true };
        if (sucursal) filtros.sucursal = sucursal;
        
        const productos = await Producto.aggregate([
            { $match: filtros },
            {
                $group: {
                    _id: { 
                        categoria: '$categoria', 
                        genero: '$genero',
                        sucursal: '$sucursal'
                    },
                    cantidad: { $sum: 1 },
                    stockTotal: { $sum: '$stockActual' },
                    valorTotal: { 
                        $sum: { $multiply: ['$stockActual', '$precioCompra'] }
                    }
                }
            },
            {
                $lookup: {
                    from: 'sucursals',
                    localField: '_id.sucursal',
                    foreignField: '_id',
                    as: 'sucursalInfo'
                }
            },
            { $sort: { cantidad: -1 } }
        ]);
        
        return productos.map(p => ({
            categoria: p._id.categoria,
            genero: p._id.genero,
            sucursal: p.sucursalInfo[0] ? {
                _id: p.sucursalInfo[0]._id,
                nombre: p.sucursalInfo[0].nombre,
                codigo: p.sucursalInfo[0].codigo
            } : null,
            cantidad: p.cantidad,
            stockTotal: p.stockTotal,
            valorTotal: p.valorTotal
        }));
    } catch (error) {
        throw new Error('Error al agrupar productos: ' + error.message);
    }
};

// Comparar inventario entre sucursales
const compararInventarioSucursales = async () => {
    try {
        const comparacion = await Producto.aggregate([
            { $match: { activo: true } },
            {
                $group: {
                    _id: '$sucursal',
                    totalProductos: { $sum: 1 },
                    stockTotal: { $sum: '$stockActual' },
                    valorInventario: {
                        $sum: { $multiply: ['$stockActual', '$precioCompra'] }
                    },
                    productosBajoStock: {
                        $sum: { $cond: ['$alertaStock', 1, 0] }
                    }
                }
            },
            {
                $lookup: {
                    from: 'sucursals',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'sucursalInfo'
                }
            },
            { $unwind: '$sucursalInfo' },
            { $sort: { valorInventario: -1 } }
        ]);

        return comparacion.map(item => ({
            sucursal: {
                _id: item.sucursalInfo._id,
                codigo: item.sucursalInfo.codigo,
                nombre: item.sucursalInfo.nombre,
                ciudad: item.sucursalInfo.direccion.ciudad
            },
            totalProductos: item.totalProductos,
            stockTotal: item.stockTotal,
            valorInventario: item.valorInventario,
            productosBajoStock: item.productosBajoStock
        }));
    } catch (error) {
        throw new Error('Error al comparar sucursales: ' + error.message);
    }
};

module.exports = {
    obtenerEstadisticasProductos,
    obtenerProductosPorCategoria,
    compararInventarioSucursales
};