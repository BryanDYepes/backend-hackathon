const MovimientoInventario = require('../models/MovimientoInventario.model');
const Producto = require('../models/Producto.model');

// Obtener resumen de movimientos por tipo
const obtenerResumenMovimientos = async (fechaInicio, fechaFin, sucursal = null) => {
    try {
        const filtros = {
            createdAt: {
                $gte: new Date(fechaInicio),
                $lte: new Date(fechaFin)
            }
        };

        if (sucursal) filtros.sucursal = sucursal;

        const resumen = await MovimientoInventario.aggregate([
            { $match: filtros },
            {
                $group: {
                    _id: '$tipoMovimiento',
                    cantidad: { $sum: '$cantidad' },
                    numeroMovimientos: { $sum: 1 },
                    valorTotal: { $sum: '$valorTotal' }
                }
            },
            { $sort: { numeroMovimientos: -1 } }
        ]);

        return resumen;
    } catch (error) {
        throw new Error('Error al obtener resumen: ' + error.message);
    }
};

// Obtener productos con más movimientos
const obtenerProductosConMasMovimientos = async (fechaInicio, fechaFin, limite = 10) => {
    try {
        const productos = await MovimientoInventario.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: new Date(fechaInicio),
                        $lte: new Date(fechaFin)
                    }
                }
            },
            {
                $group: {
                    _id: '$producto',
                    nombreProducto: { $first: '$nombreProducto' },
                    codigoProducto: { $first: '$codigoProducto' },
                    totalMovimientos: { $sum: 1 },
                    cantidadTotal: { $sum: '$cantidad' }
                }
            },
            { $sort: { totalMovimientos: -1 } },
            { $limit: limite }
        ]);

        return productos;
    } catch (error) {
        throw new Error('Error al obtener productos con más movimientos: ' + error.message);
    }
};

// Detectar discrepancias de inventario
const detectarDiscrepancias = async (sucursal = null) => {
    try {
        const filtros = { activo: true };
        if (sucursal) filtros.sucursal = sucursal;

        const productos = await Producto.find(filtros);
        const discrepancias = [];

        for (const producto of productos) {
            const movimientos = await MovimientoInventario.find({
                producto: producto._id
            }).sort({ createdAt: 1 });

            if (movimientos.length === 0) continue;

            const ultimoMovimiento = movimientos[movimientos.length - 1];

            if (ultimoMovimiento.stockNuevo !== producto.stockActual) {
                discrepancias.push({
                    producto: producto._id,
                    codigo: producto.codigo,
                    nombre: producto.nombre,
                    sucursal: producto.sucursal,
                    stockRegistrado: producto.stockActual,
                    stockUltimoMovimiento: ultimoMovimiento.stockNuevo,
                    diferencia: producto.stockActual - ultimoMovimiento.stockNuevo,
                    fechaUltimoMovimiento: ultimoMovimiento.createdAt
                });
            }
        }
        return discrepancias;
    } catch (error) {
        throw new Error('Error al detectar discrepancias: ' + error.message);
    }
};

// Calcular índice de rotación por producto
const calcularIndiceRotacion = async (fechaInicio, fechaFin) => {
    try {
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);
        const dias = Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24));

        const salidas = await MovimientoInventario.aggregate([
            {
                $match: {
                    tipoMovimiento: { $in: ['SALIDA', 'TRANSFERENCIA_SALIDA'] },
                    createdAt: { $gte: inicio, $lte: fin }
                }
            },
            {
                $group: {
                    _id: '$producto',
                    nombreProducto: { $first: '$nombreProducto' },
                    codigoProducto: { $first: '$codigoProducto' },
                    totalSalidas: { $sum: '$cantidad' }
                }
            }
        ]);

        const rotacion = [];

        for (const item of salidas) {
            const producto = await Producto.findById(item._id);
            if (!producto) continue;

            const stockInicial = producto.stockActual + item.totalSalidas;
            const stockPromedio = (stockInicial + producto.stockActual) / 2;

            const indice = stockPromedio > 0 ? (item.totalSalidas / stockPromedio).toFixed(2) : 0;
            const diasRotacion = indice > 0 ? (dias / indice).toFixed(0) : 0;

            rotacion.push({
                producto: item._id,
                codigo: item.codigoProducto,
                nombre: item.nombreProducto,
                stockActual: producto.stockActual,
                totalSalidas: item.totalSalidas,
                indiceRotacion: parseFloat(indice),
                diasRotacion: parseInt(diasRotacion),
                clasificacion: indice > 1 ? 'Alta rotación' : indice > 0.5 ? 'Media rotación' : 'Baja rotación'
            });
        }

        return rotacion.sort((a, b) => b.indiceRotacion - a.indiceRotacion);
    } catch (error) {
        throw new Error('Error al calcular índice de rotación: ' + error.message);
    }
};

// Análisis ABC de inventario
const analisisABC = async (fechaInicio, fechaFin) => {
    try {
        const ventas = await MovimientoInventario.aggregate([
            {
                $match: {
                    tipoMovimiento: 'SALIDA',
                    createdAt: {
                        $gte: new Date(fechaInicio),
                        $lte: new Date(fechaFin)
                    }
                }
            },
            {
                $group: {
                    _id: '$producto',
                    nombreProducto: { $first: '$nombreProducto' },
                    codigoProducto: { $first: '$codigoProducto' },
                    valorTotal: { $sum: '$valorTotal' }
                }
            },
            { $sort: { valorTotal: -1 } }
        ]);

        const valorTotalGeneral = ventas.reduce((sum, item) => sum + item.valorTotal, 0);

        let acumulado = 0;
        const clasificacion = ventas.map(item => {
            acumulado += item.valorTotal;
            const porcentajeAcumulado = (acumulado / valorTotalGeneral) * 100;

            let categoria;
            if (porcentajeAcumulado <= 80) categoria = 'A';
            else if (porcentajeAcumulado <= 95) categoria = 'B';
            else categoria = 'C';

            return {
                producto: item._id,
                codigo: item.codigoProducto,
                nombre: item.nombreProducto,
                valorTotal: item.valorTotal,
                porcentajeDelTotal: ((item.valorTotal / valorTotalGeneral) * 100).toFixed(2),
                porcentajeAcumulado: porcentajeAcumulado.toFixed(2),
                categoriaABC: categoria
            };
        });

        const resumen = {
            categoriaA: clasificacion.filter(p => p.categoriaABC === 'A').length,
            categoriaB: clasificacion.filter(p => p.categoriaABC === 'B').length,
            categoriaC: clasificacion.filter(p => p.categoriaABC === 'C').length
        };

        return { clasificacion, resumen };
    } catch (error) {
        throw new Error('Error en análisis ABC: ' + error.message);
    }
};

module.exports = {
    obtenerResumenMovimientos,
    obtenerProductosConMasMovimientos,
    detectarDiscrepancias,
    calcularIndiceRotacion,
    analisisABC
};
