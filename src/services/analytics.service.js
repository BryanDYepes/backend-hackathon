const Venta = require('../models/Venta.model');
const Producto = require('../models/Producto.model');

// Obtener tendencias de ventas (predicción simple)
const obtenerTendencias = async (mesesAtras = 6) => {
    try {
        const fechaInicio = new Date();
        fechaInicio.setMonth(fechaInicio.getMonth() - mesesAtras);

        const ventasMensuales = await Venta.aggregate([
            {
                $match: {
                    estadoVenta: 'Completada',
                    fecha: { $gte: fechaInicio }
                }
            },
            {
                $group: {
                    _id: {
                        año: { $year: '$fecha' },
                        mes: { $month: '$fecha' }
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

// Identificar productos con riesgo de sobre-stock
const identificarSobreStock = async (mesesHistorico = 3) => {
    try {
        const fechaInicio = new Date();
        fechaInicio.setMonth(fechaInicio.getMonth() - mesesHistorico);

        // Obtener ventas promedio por producto
        const ventasPromedio = await Venta.aggregate([
            {
                $match: {
                    estadoVenta: 'Completada',
                    fecha: { $gte: fechaInicio }
                }
            },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.producto',
                    nombreProducto: { $first: '$items.nombreProducto' },
                    ventaMensualPromedio: {
                        $avg: '$items.cantidad'
                    }
                }
            }
        ]);

        // Comparar con stock actual
        const productosRiesgo = [];

        for (const item of ventasPromedio) {
            const producto = await Producto.findById(item._id);

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

// Sugerencias de reabastecimiento inteligente
const sugerirReabastecimiento = async (diasProyeccion = 30) => {
    try {
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - 90); // Últimos 90 días

        // Calcular venta diaria promedio por producto
        const ventasDiarias = await Venta.aggregate([
            {
                $match: {
                    estadoVenta: 'Completada',
                    fecha: { $gte: fechaInicio }
                }
            },
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

        for (const item of ventasDiarias) {
            const producto = await Producto.findById(item._id);

            if (!producto || !producto.activo) continue;

            // Venta diaria promedio
            const ventaDiaria = item.totalVendido / dias;

            // Días de stock disponible
            const diasStock = ventaDiaria > 0 ? producto.stockActual / ventaDiaria : 999;

            // Si el stock actual no cubre el período de proyección
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

// Análisis de rentabilidad por producto
const analizarRentabilidad = async (fechaInicio, fechaFin) => {
    try {
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);

        const rentabilidad = await Venta.aggregate([
            {
                $match: {
                    estadoVenta: 'Completada',
                    fecha: { $gte: inicio, $lte: fin }
                }
            },
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
                $group: {
                    _id: '$items.producto',
                    nombre: { $first: '$items.nombreProducto' },
                    codigo: { $first: '$items.codigoProducto' },
                    categoria: { $first: '$items.categoria' },
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

// Obtener horarios pico de ventas
const obtenerHorariosPico = async (fechaInicio, fechaFin) => {
    try {
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);

        const ventasPorHora = await Venta.aggregate([
            {
                $match: {
                    estadoVenta: 'Completada',
                    fecha: { $gte: inicio, $lte: fin }
                }
            },
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