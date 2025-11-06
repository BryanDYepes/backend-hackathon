const Venta = require('../models/Venta.model');
const Producto = require('../models/Producto.model');

// Obtener tendencias de ventas (con filtro de sucursal)
const obtenerTendencias = async (mesesAtras = 6, sucursal = null) => {
    try {
        const fechaInicio = new Date();
        fechaInicio.setMonth(fechaInicio.getMonth() - mesesAtras);

        const filtros = {
            estadoVenta: 'Completada',
            fecha: { $gte: fechaInicio }
        };
        
        if (sucursal) filtros.sucursal = sucursal;

        const ventasMensuales = await Venta.aggregate([
            { $match: filtros },
            {
                $group: {
                    _id: {
                        año: { $year: '$fecha' },
                        mes: { $month: '$fecha' },
                        ...(sucursal ? {} : { sucursal: '$sucursal' })
                    },
                    totalVentas: { $sum: 1 },
                    totalIngresos: { $sum: '$total' }
                }
            },
            { $sort: { '_id.año': 1, '_id.mes': 1 } }
        ]);

        // Calcular promedio móvil simple (últimos 3 meses)
        const tendencia = ventasMensuales.map((item, index, array) => {
            if (index < 2) return { ...item, promedioMovil: null };

            const ultimos3 = array.slice(index - 2, index + 1);
            const promedio = ultimos3.reduce((sum, v) => sum + v.totalIngresos, 0) / 3;

            return {
                ...item,
                promedioMovil: promedio.toFixed(2)
            };
        });

        return tendencia;
    } catch (error) {
        throw new Error('Error al calcular tendencias: ' + error.message);
    }
};

// Identificar productos con riesgo de sobre-stock (por sucursal)
const identificarSobreStock = async (mesesHistorico = 3, sucursal = null) => {
    try {
        const fechaInicio = new Date();
        fechaInicio.setMonth(fechaInicio.getMonth() - mesesHistorico);

        const filtrosVenta = {
            estadoVenta: 'Completada',
            fecha: { $gte: fechaInicio }
        };
        
        if (sucursal) filtrosVenta.sucursal = sucursal;

        // Obtener ventas promedio por producto
        const ventasPromedio = await Venta.aggregate([
            { $match: filtrosVenta },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.producto',
                    nombreProducto: { $first: '$items.nombreProducto' },
                    ventaMensualPromedio: { $avg: '$items.cantidad' }
                }
            }
        ]);

        // Comparar con stock actual
        const productosRiesgo = [];
        const filtrosProducto = sucursal ? { sucursal } : {};

        for (const item of ventasPromedio) {
            const producto = await Producto.findOne({ 
                _id: item._id, 
                ...filtrosProducto 
            }).populate('sucursal', 'nombre codigo');

            if (!producto) continue;

            // Calcular meses de inventario disponible
            const mesesInventario = item.ventaMensualPromedio > 0
                ? (producto.stockActual / item.ventaMensualPromedio).toFixed(2)
                : 999;

            // Si tiene más de 6 meses de inventario, se considera sobre-stock
            if (mesesInventario > 6) {
                productosRiesgo.push({
                    producto: producto._id,
                    codigo: producto.codigo,
                    nombre: producto.nombre,
                    categoria: producto.categoria,
                    sucursal: producto.sucursal,
                    stockActual: producto.stockActual,
                    ventaMensualPromedio: item.ventaMensualPromedio.toFixed(2),
                    mesesInventario: parseFloat(mesesInventario),
                    recomendacion: 'Considerar descuento o promoción'
                });
            }
        }

        return productosRiesgo.sort((a, b) => b.mesesInventario - a.mesesInventario);
    } catch (error) {
        throw new Error('Error al identificar sobre-stock: ' + error.message);
    }
};

// Sugerencias de reabastecimiento inteligente (por sucursal)
const sugerirReabastecimiento = async (diasProyeccion = 30, sucursal = null) => {
    try {
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - 90);

        const filtrosVenta = {
            estadoVenta: 'Completada',
            fecha: { $gte: fechaInicio }
        };
        
        if (sucursal) filtrosVenta.sucursal = sucursal;

        const ventasDiarias = await Venta.aggregate([
            { $match: filtrosVenta },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.producto',
                    nombreProducto: { $first: '$items.nombreProducto' },
                    codigoProducto: { $first: '$items.codigoProducto' },
                    totalVendido: { $sum: '$items.cantidad' }
                }
            }
        ]);

        const sugerencias = [];
        const dias = 90;
        const filtrosProducto = { activo: true };
        if (sucursal) filtrosProducto.sucursal = sucursal;

        for (const item of ventasDiarias) {
            const producto = await Producto.findOne({ 
                _id: item._id, 
                ...filtrosProducto 
            }).populate('sucursal', 'nombre codigo');

            if (!producto) continue;

            const ventaDiaria = item.totalVendido / dias;
            const diasStock = ventaDiaria > 0 ? producto.stockActual / ventaDiaria : 999;

            if (diasStock < diasProyeccion) {
                const cantidadSugerida = Math.ceil(
                    (ventaDiaria * diasProyeccion) - producto.stockActual
                );

                sugerencias.push({
                    producto: producto._id,
                    codigo: producto.codigo,
                    nombre: producto.nombre,
                    categoria: producto.categoria,
                    sucursal: producto.sucursal,
                    stockActual: producto.stockActual,
                    ventaDiariaPromedio: ventaDiaria.toFixed(2),
                    diasStockDisponible: Math.floor(diasStock),
                    cantidadSugerida,
                    prioridad: diasStock < 7 ? 'Alta' : diasStock < 15 ? 'Media' : 'Baja'
                });
            }
        }

        return sugerencias.sort((a, b) => a.diasStockDisponible - b.diasStockDisponible);
    } catch (error) {
        throw new Error('Error al generar sugerencias: ' + error.message);
    }
};

// Análisis de rentabilidad por producto (con sucursal)
const analizarRentabilidad = async (fechaInicio, fechaFin, sucursal = null) => {
    try {
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);

        const filtros = {
            estadoVenta: 'Completada',
            fecha: { $gte: inicio, $lte: fin }
        };
        
        if (sucursal) filtros.sucursal = sucursal;

        const rentabilidad = await Venta.aggregate([
            { $match: filtros },
            { $unwind: '$items' },
            {
                $lookup: {
                    from: 'productos',
                    localField: 'items.producto',
                    foreignField: '_id',
                    as: 'productoInfo'
                }
            },
            { $unwind: '$productoInfo' },
            {
                $lookup: {
                    from: 'sucursals',
                    localField: 'sucursal',
                    foreignField: '_id',
                    as: 'sucursalInfo'
                }
            },
            {
                $group: {
                    _id: '$items.producto',
                    nombre: { $first: '$items.nombreProducto' },
                    codigo: { $first: '$items.codigoProducto' },
                    categoria: { $first: '$items.categoria' },
                    sucursal: { $first: { $arrayElemAt: ['$sucursalInfo', 0] } },
                    cantidadVendida: { $sum: '$items.cantidad' },
                    totalIngresos: { $sum: '$items.subtotal' },
                    precioCompra: { $first: '$productoInfo.precioCompra' },
                    precioVenta: { $first: '$productoInfo.precioVenta' }
                }
            }
        ]);

        const analisis = rentabilidad.map(item => {
            const costoTotal = item.cantidadVendida * item.precioCompra;
            const utilidadBruta = item.totalIngresos - costoTotal;
            const margenPorcentaje = item.totalIngresos > 0
                ? ((utilidadBruta / item.totalIngresos) * 100).toFixed(2)
                : 0;

            return {
                producto: item._id,
                codigo: item.codigo,
                nombre: item.nombre,
                categoria: item.categoria,
                sucursal: item.sucursal ? {
                    _id: item.sucursal._id,
                    nombre: item.sucursal.nombre,
                    codigo: item.sucursal.codigo
                } : null,
                cantidadVendida: item.cantidadVendida,
                totalIngresos: item.totalIngresos,
                costoTotal,
                utilidadBruta,
                margenPorcentaje: parseFloat(margenPorcentaje)
            };
        });

        return analisis.sort((a, b) => b.utilidadBruta - a.utilidadBruta);
    } catch (error) {
        throw new Error('Error al analizar rentabilidad: ' + error.message);
    }
};

// Obtener horarios pico de ventas (con sucursal)
const obtenerHorariosPico = async (fechaInicio, fechaFin, sucursal = null) => {
    try {
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);

        const filtros = {
            estadoVenta: 'Completada',
            fecha: { $gte: inicio, $lte: fin }
        };
        
        if (sucursal) filtros.sucursal = sucursal;

        const ventasPorHora = await Venta.aggregate([
            { $match: filtros },
            {
                $group: {
                    _id: { $hour: '$fecha' },
                    cantidadVentas: { $sum: 1 },
                    totalIngresos: { $sum: '$total' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const horarios = ventasPorHora.map(item => ({
            hora: `${item._id}:00`,
            cantidadVentas: item.cantidadVentas,
            totalIngresos: item.totalIngresos,
            promedioVenta: (item.totalIngresos / item.cantidadVentas).toFixed(2)
        }));

        return horarios;
    } catch (error) {
        throw new Error('Error al obtener horarios pico: ' + error.message);
    }
};

module.exports = {
    obtenerTendencias,
    identificarSobreStock,
    sugerirReabastecimiento,
    analizarRentabilidad,
    obtenerHorariosPico
};