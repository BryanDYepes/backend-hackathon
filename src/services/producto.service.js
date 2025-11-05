const Producto = require('../models/Producto.model');

// Servicio para obtener estadísticas generales de productos
const obtenerEstadisticasProductos = async (filtros = {}) => {
    try {
        const estadisticas = await Producto.aggregate([
            { $match: { activo: true, ...filtros } },
            {
                $group: {
                    _id: null,
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

// Servicio para obtener productos por categoría y género
const obtenerProductosPorCategoria = async () => {
    try {
        const productos = await Producto.aggregate([
            { $match: { activo: true } },
            {
                $group: {
                    _id: { categoria: '$categoria', genero: '$genero' },
                    cantidad: { $sum: 1 },
                    stockTotal: { $sum: '$stockActual' }
                }
            },
            { $sort: { cantidad: -1 } }
        ]);
        
        return productos;
    } catch (error) {
        throw new Error('Error al agrupar productos: ' + error.message);
    }
};

module.exports = {
    obtenerEstadisticasProductos,
    obtenerProductosPorCategoria
};