const Venta = require('../models/Venta.model');

// Obtener estadísticas de ventas por período
const obtenerEstadisticasVentas = async (fechaInicio, fechaFin, sucursal = null) => {
    try {
        const filtros = {
            estadoVenta: 'Completada',
            fecha: {
                $gte: new Date(fechaInicio),
                $lte: new Date(fechaFin)
            }
        };
        
        if (sucursal) {
            filtros.sucursal = sucursal;
        }
        
        const estadisticas = await Venta.aggregate([
            { $match: filtros },
            {
                $group: {
                    _id: null,
                    totalVentas: { $sum: 1 },
                    totalIngresos: { $sum: '$total' },
                    promedioVenta: { $avg: '$total' },
                    ventaMasAlta: { $max: '$total' },
                    ventaMasBaja: { $min: '$total' }
                }
            }
        ]);
        
        return estadisticas[0] || {
            totalVentas: 0,
            totalIngresos: 0,
            promedioVenta: 0,
            ventaMasAlta: 0,
            ventaMasBaja: 0
        };
    } catch (error) {
        throw new Error('Error al calcular estadísticas: ' + error.message);
    }
};

// Obtener productos más vendidos
const obtenerProductosMasVendidos = async (fechaInicio, fechaFin, limite = 10) => {
    try {
        const productos = await Venta.aggregate([
            {
                $match: {
                    estadoVenta: 'Completada',
                    fecha: {
                        $gte: new Date(fechaInicio),
                        $lte: new Date(fechaFin)
                    }
                }
            },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.producto',
                    nombreProducto: { $first: '$items.nombreProducto' },
                    categoria: { $first: '$items.categoria' },
                    genero: { $first: '$items.genero' },
                    cantidadVendida: { $sum: '$items.cantidad' },
                    totalIngresos: { $sum: '$items.subtotal' }
                }
            },
            { $sort: { cantidadVendida: -1 } },
            { $limit: limite }
        ]);
        
        return productos;
    } catch (error) {
        throw new Error('Error al obtener productos más vendidos: ' + error.message);
    }
};

// Obtener ventas por método de pago
const obtenerVentasPorMetodoPago = async (fechaInicio, fechaFin) => {
    try {
        const ventas = await Venta.aggregate([
            {
                $match: {
                    estadoVenta: 'Completada',
                    fecha: {
                        $gte: new Date(fechaInicio),
                        $lte: new Date(fechaFin)
                    }
                }
            },
            {
                $group: {
                    _id: '$metodoPago',
                    cantidad: { $sum: 1 },
                    total: { $sum: '$total' }
                }
            },
            { $sort: { total: -1 } }
        ]);
        
        return ventas;
    } catch (error) {
        throw new Error('Error al agrupar por método de pago: ' + error.message);
    }
};

// Obtener ventas por sucursal
// Obtener ventas por sucursal (con detalles completos)
const obtenerVentasPorSucursal = async (fechaInicio, fechaFin) => {
    try {
        const ventas = await Venta.aggregate([
            {
                $match: {
                    estadoVenta: 'Completada',
                    fecha: {
                        $gte: new Date(fechaInicio),
                        $lte: new Date(fechaFin)
                    }
                }
            },
            {
                $group: {
                    _id: '$sucursal',
                    cantidadVentas: { $sum: 1 },
                    totalIngresos: { $sum: '$total' },
                    promedioVenta: { $avg: '$total' }
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
            { $sort: { totalIngresos: -1 } }
        ]);
        
        return ventas.map(v => ({
            sucursal: {
                _id: v.sucursalInfo._id,
                codigo: v.sucursalInfo.codigo,
                nombre: v.sucursalInfo.nombre,
                ciudad: v.sucursalInfo.direccion.ciudad,
                gerente: v.sucursalInfo.nombreGerente
            },
            cantidadVentas: v.cantidadVentas,
            totalIngresos: v.totalIngresos,
            promedioVenta: v.promedioVenta
        }));
    } catch (error) {
        throw new Error('Error al agrupar por sucursal: ' + error.message);
    }
};

// Obtener ventas por categoría de producto
const obtenerVentasPorCategoria = async (fechaInicio, fechaFin) => {
    try {
        const ventas = await Venta.aggregate([
            {
                $match: {
                    estadoVenta: 'Completada',
                    fecha: {
                        $gte: new Date(fechaInicio),
                        $lte: new Date(fechaFin)
                    }
                }
            },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.categoria',
                    cantidadVendida: { $sum: '$items.cantidad' },
                    totalIngresos: { $sum: '$items.subtotal' }
                }
            },
            { $sort: { totalIngresos: -1 } }
        ]);
        
        return ventas;
    } catch (error) {
        throw new Error('Error al agrupar por categoría: ' + error.message);
    }
};

module.exports = {
    obtenerEstadisticasVentas,
    obtenerProductosMasVendidos,
    obtenerVentasPorMetodoPago,
    obtenerVentasPorSucursal,
    obtenerVentasPorCategoria
};