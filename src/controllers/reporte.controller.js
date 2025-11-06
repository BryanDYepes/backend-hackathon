const Venta = require('../models/Venta.model');
const Producto = require('../models/Producto.model');
const {
    obtenerEstadisticasVentas,
    obtenerProductosMasVendidos,
    obtenerVentasPorMetodoPago,
    obtenerVentasPorSucursal,
    obtenerVentasPorCategoria
} = require('../services/venta.service');

// @desc    Obtener dashboard general con KPIs principales
// @route   GET /api/reportes/dashboard
// @access  Private
const obtenerDashboard = async (req, res) => {
    try {
        const { fechaInicio, fechaFin, sucursal } = req.query;

        // Si no se proporcionan fechas, usar el mes actual
        const inicio = fechaInicio ? new Date(fechaInicio) : new Date(new Date().setDate(1));
        inicio.setHours(0, 0, 0, 0);

        const fin = fechaFin ? new Date(fechaFin) : new Date();
        fin.setHours(23, 59, 59, 999);

        // Obtener estadísticas generales de ventas
        const estadisticasVentas = await obtenerEstadisticasVentas(inicio, fin, sucursal);

        // Obtener productos con stock bajo
        const filtroStock = sucursal ? { sucursal: mongoose.Types.ObjectId(sucursal), alertaStock: true, activo: true } : { alertaStock: true, activo: true };
        const productosStockBajo = await Producto.countDocuments(filtroStock);

        // Obtener total de productos activos
        const filtroProductos = sucursal ? { sucursal: mongoose.Types.ObjectId(sucursal), activo: true } : { activo: true };
        const totalProductosActivos = await Producto.countDocuments(filtroProductos);

        // Calcular valor del inventario
        const valorInventario = await Producto.aggregate([
            { $match: filtroProductos },
            {
                $group: {
                    _id: null,
                    valor: { $sum: { $multiply: ['$stockActual', '$precioCompra'] } },
                    totalUnidades: { $sum: '$stockActual' }
                }
            }
        ]);

        // Top 5 productos más vendidos
        const productosMasVendidos = await obtenerProductosMasVendidos(inicio, fin, 5);

        // Ventas por método de pago
        const ventasPorMetodoPago = await obtenerVentasPorMetodoPago(inicio, fin);

        res.json({
            success: true,
            periodo: {
                inicio: inicio.toLocaleDateString('es-CO'),
                fin: fin.toLocaleDateString('es-CO')
            },
            kpis: {
                ventas: {
                    total: estadisticasVentas.totalVentas || 0,
                    ingresos: estadisticasVentas.totalIngresos || 0,
                    promedio: estadisticasVentas.promedioVenta || 0,
                    ventaMasAlta: estadisticasVentas.ventaMasAlta || 0,
                    ventaMasBaja: estadisticasVentas.ventaMasBaja || 0
                },
                inventario: {
                    totalProductos: totalProductosActivos,
                    productosStockBajo,
                    valorTotal: valorInventario[0]?.valor || 0,
                    totalUnidades: valorInventario[0]?.totalUnidades || 0
                }
            },
            topProductos: productosMasVendidos,
            metodosPago: ventasPorMetodoPago
        });

    } catch (error) {
        console.error('Error al obtener dashboard:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener dashboard',
            detalle: error.message
        });
    }
};

// @desc    Obtener reporte de ventas detallado
// @route   GET /api/reportes/ventas
// @access  Private (Admin/Gerente)
const obtenerReporteVentas = async (req, res) => {
    try {
        const { fechaInicio, fechaFin, sucursal, agruparPor } = req.query;

        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                error: true,
                mensaje: 'Debe proporcionar fechaInicio y fechaFin'
            });
        }

        const inicio = new Date(fechaInicio);
        inicio.setHours(0, 0, 0, 0);

        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999);

        // Filtros base
        const filtros = {
            estadoVenta: 'Completada',
            fecha: { $gte: inicio, $lte: fin }
        };

        if (sucursal) {
            filtros.sucursal = mongoose.Types.ObjectId(sucursal);
        }

        // Estadísticas generales
        const estadisticas = await obtenerEstadisticasVentas(inicio, fin, sucursal);

        // Agrupar datos según el parámetro
        let datosAgrupados = [];

        switch (agruparPor) {
            case 'dia':
                datosAgrupados = await Venta.aggregate([
                    { $match: filtros },
                    {
                        $group: {
                            _id: {
                                $dateToString: { format: '%Y-%m-%d', date: '$fecha' }
                            },
                            cantidadVentas: { $sum: 1 },
                            totalIngresos: { $sum: '$total' },
                            promedioVenta: { $avg: '$total' }
                        }
                    },
                    { $sort: { _id: 1 } }
                ]);
                break;

            case 'mes':
                datosAgrupados = await Venta.aggregate([
                    { $match: filtros },
                    {
                        $group: {
                            _id: {
                                $dateToString: { format: '%Y-%m', date: '$fecha' }
                            },
                            cantidadVentas: { $sum: 1 },
                            totalIngresos: { $sum: '$total' },
                            promedioVenta: { $avg: '$total' }
                        }
                    },
                    { $sort: { _id: 1 } }
                ]);
                break;

            case 'vendedor':
                datosAgrupados = await Venta.aggregate([
                    { $match: filtros },
                    {
                        $group: {
                            _id: '$vendedor',
                            nombreVendedor: { $first: '$nombreVendedor' },
                            cantidadVentas: { $sum: 1 },
                            totalIngresos: { $sum: '$total' },
                            promedioVenta: { $avg: '$total' }
                        }
                    },
                    { $sort: { totalIngresos: -1 } }
                ]);
                break;

            case 'sucursal':
                datosAgrupados = await obtenerVentasPorSucursal(inicio, fin);
                break;

            default:
                // Sin agrupación, solo totales
                datosAgrupados = null;
        }

        res.json({
            success: true,
            periodo: {
                inicio: inicio.toLocaleDateString('es-CO'),
                fin: fin.toLocaleDateString('es-CO')
            },
            estadisticas,
            datos: datosAgrupados
        });

    } catch (error) {
        console.error('Error al obtener reporte de ventas:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener reporte de ventas',
            detalle: error.message
        });
    }
};

// @desc    Obtener reporte de productos más vendidos
// @route   GET /api/reportes/productos-mas-vendidos
// @access  Private
const obtenerReporteProductosMasVendidos = async (req, res) => {
    try {
        const { fechaInicio, fechaFin, limite = 20, categoria, genero } = req.query;

        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                error: true,
                mensaje: 'Debe proporcionar fechaInicio y fechaFin'
            });
        }

        const inicio = new Date(fechaInicio);
        inicio.setHours(0, 0, 0, 0);

        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999);

        // Construir pipeline de agregación
        const pipeline = [
            {
                $match: {
                    estadoVenta: 'Completada',
                    fecha: { $gte: inicio, $lte: fin }
                }
            },
            { $unwind: '$items' }
        ];

        // Filtros adicionales
        const filtrosItems = {};
        if (categoria) filtrosItems['items.categoria'] = categoria;
        if (genero) filtrosItems['items.genero'] = genero;

        if (Object.keys(filtrosItems).length > 0) {
            pipeline.push({ $match: filtrosItems });
        }

        pipeline.push(
            {
                $group: {
                    _id: '$items.producto',
                    codigoProducto: { $first: '$items.codigoProducto' },
                    nombreProducto: { $first: '$items.nombreProducto' },
                    categoria: { $first: '$items.categoria' },
                    genero: { $first: '$items.genero' },
                    talla: { $first: '$items.talla' },
                    cantidadVendida: { $sum: '$items.cantidad' },
                    totalIngresos: { $sum: '$items.subtotal' },
                    numeroVentas: { $sum: 1 }
                }
            },
            { $sort: { cantidadVendida: -1 } },
            { $limit: parseInt(limite) }
        );

        const productos = await Venta.aggregate(pipeline);

        res.json({
            success: true,
            periodo: {
                inicio: inicio.toLocaleDateString('es-CO'),
                fin: fin.toLocaleDateString('es-CO')
            },
            total: productos.length,
            data: productos
        });

    } catch (error) {
        console.error('Error al obtener productos más vendidos:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener productos más vendidos',
            detalle: error.message
        });
    }
};

// @desc    Obtener reporte de rotación de inventario
// @route   GET /api/reportes/rotacion-inventario
// @access  Private (Admin/Gerente)
const obtenerReporteRotacion = async (req, res) => {
    try {
        const { fechaInicio, fechaFin, sucursal } = req.query;

        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                error: true,
                mensaje: 'Debe proporcionar fechaInicio y fechaFin'
            });
        }

        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);

        // Calcular días del período
        const dias = Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24));

        // Obtener productos vendidos en el período
        const pipeline = [
            {
                $match: {
                    estadoVenta: 'Completada',
                    fecha: { $gte: inicio, $lte: fin }
                }
            }
        ];

        if (sucursal) {
            pipeline[0].$match.sucursal = sucursal;
        }

        pipeline.push(
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.producto',
                    nombreProducto: { $first: '$items.nombreProducto' },
                    codigoProducto: { $first: '$items.codigoProducto' },
                    categoria: { $first: '$items.categoria' },
                    cantidadVendida: { $sum: '$items.cantidad' }
                }
            }
        );

        const ventasProductos = await Venta.aggregate(pipeline);

        // Obtener información actual de stock de cada producto
        const productosConRotacion = await Promise.all(
            ventasProductos.map(async (item) => {
                const producto = await Producto.findById(item._id);

                if (!producto) return null;

                // Calcular rotación: ventas / stock promedio * días
                const stockPromedio = (producto.stockActual + item.cantidadVendida) / 2;
                const tasaRotacion = stockPromedio > 0
                    ? ((item.cantidadVendida / stockPromedio) * (30 / dias)).toFixed(2)
                    : 0;

                return {
                    producto: item._id,
                    codigo: item.codigoProducto,
                    nombre: item.nombreProducto,
                    categoria: item.categoria,
                    cantidadVendida: item.cantidadVendida,
                    stockActual: producto.stockActual,
                    tasaRotacionMensual: parseFloat(tasaRotacion),
                    estado: tasaRotacion > 2 ? 'Alta rotación' : tasaRotacion > 1 ? 'Rotación media' : 'Baja rotación'
                };
            })
        );

        // Filtrar nulls y ordenar por tasa de rotación
        const resultado = productosConRotacion
            .filter(item => item !== null)
            .sort((a, b) => b.tasaRotacionMensual - a.tasaRotacionMensual);

        res.json({
            success: true,
            periodo: {
                inicio: inicio.toLocaleDateString('es-CO'),
                fin: fin.toLocaleDateString('es-CO'),
                dias
            },
            total: resultado.length,
            data: resultado
        });

    } catch (error) {
        console.error('Error al calcular rotación:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al calcular rotación de inventario',
            detalle: error.message
        });
    }
};

// @desc    Obtener reporte por categorías
// @route   GET /api/reportes/por-categoria
// @access  Private
const obtenerReportePorCategoria = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.query;

        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                error: true,
                mensaje: 'Debe proporcionar fechaInicio y fechaFin'
            });
        }

        const inicio = new Date(fechaInicio);
        inicio.setHours(0, 0, 0, 0);

        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999);

        const ventasPorCategoria = await obtenerVentasPorCategoria(inicio, fin);

        // Calcular porcentajes
        const totalIngresos = ventasPorCategoria.reduce((sum, cat) => sum + cat.totalIngresos, 0);

        const datosConPorcentaje = ventasPorCategoria.map(cat => ({
            ...cat,
            porcentajeIngresos: totalIngresos > 0
                ? ((cat.totalIngresos / totalIngresos) * 100).toFixed(2)
                : 0
        }));

        res.json({
            success: true,
            periodo: {
                inicio: inicio.toLocaleDateString('es-CO'),
                fin: fin.toLocaleDateString('es-CO')
            },
            totalIngresos,
            data: datosConPorcentaje
        });

    } catch (error) {
        console.error('Error al obtener reporte por categoría:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener reporte por categoría',
            detalle: error.message
        });
    }
};

// @desc    Obtener reporte por género
// @route   GET /api/reportes/por-genero
// @access  Private
const obtenerReportePorGenero = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.query;

        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                error: true,
                mensaje: 'Debe proporcionar fechaInicio y fechaFin'
            });
        }

        const inicio = new Date(fechaInicio);
        inicio.setHours(0, 0, 0, 0);

        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999);

        const ventasPorGenero = await Venta.aggregate([
            {
                $match: {
                    estadoVenta: 'Completada',
                    fecha: { $gte: inicio, $lte: fin }
                }
            },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.genero',
                    cantidadVendida: { $sum: '$items.cantidad' },
                    totalIngresos: { $sum: '$items.subtotal' },
                    numeroVentas: { $sum: 1 }
                }
            },
            { $sort: { totalIngresos: -1 } }
        ]);

        // Calcular porcentajes
        const totalIngresos = ventasPorGenero.reduce((sum, gen) => sum + gen.totalIngresos, 0);

        const datosConPorcentaje = ventasPorGenero.map(gen => ({
            genero: gen._id,
            cantidadVendida: gen.cantidadVendida,
            totalIngresos: gen.totalIngresos,
            numeroVentas: gen.numeroVentas,
            porcentajeIngresos: totalIngresos > 0
                ? ((gen.totalIngresos / totalIngresos) * 100).toFixed(2)
                : 0
        }));

        res.json({
            success: true,
            periodo: {
                inicio: inicio.toLocaleDateString('es-CO'),
                fin: fin.toLocaleDateString('es-CO')
            },
            totalIngresos,
            data: datosConPorcentaje
        });

    } catch (error) {
        console.error('Error al obtener reporte por género:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener reporte por género',
            detalle: error.message
        });
    }
};

// @desc    Obtener reporte de tallas más vendidas
// @route   GET /api/reportes/tallas-mas-vendidas
// @access  Private
const obtenerReporteTallas = async (req, res) => {
    try {
        const { fechaInicio, fechaFin, genero } = req.query;

        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                error: true,
                mensaje: 'Debe proporcionar fechaInicio y fechaFin'
            });
        }

        const inicio = new Date(fechaInicio);
        inicio.setHours(0, 0, 0, 0);

        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999);

        const pipeline = [
            {
                $match: {
                    estadoVenta: 'Completada',
                    fecha: { $gte: inicio, $lte: fin }
                }
            },
            { $unwind: '$items' }
        ];

        // Filtrar por género si se proporciona
        if (genero) {
            pipeline.push({
                $match: { 'items.genero': genero }
            });
        }

        pipeline.push(
            {
                $group: {
                    _id: {
                        talla: '$items.talla',
                        genero: '$items.genero'
                    },
                    cantidadVendida: { $sum: '$items.cantidad' },
                    totalIngresos: { $sum: '$items.subtotal' }
                }
            },
            { $sort: { cantidadVendida: -1 } }
        );

        const ventasPorTalla = await Venta.aggregate(pipeline);

        // Formatear respuesta
        const datos = ventasPorTalla.map(item => ({
            talla: item._id.talla,
            genero: item._id.genero,
            cantidadVendida: item.cantidadVendida,
            totalIngresos: item.totalIngresos
        }));

        res.json({
            success: true,
            periodo: {
                inicio: inicio.toLocaleDateString('es-CO'),
                fin: fin.toLocaleDateString('es-CO')
            },
            filtros: genero ? { genero } : {},
            data: datos
        });

    } catch (error) {
        console.error('Error al obtener reporte de tallas:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener reporte de tallas',
            detalle: error.message
        });
    }
};

// @desc    Obtener comparativo entre períodos
// @route   GET /api/reportes/comparativo
// @access  Private (Admin/Gerente)
const obtenerComparativo = async (req, res) => {
    try {
        const {
            periodo1Inicio,
            periodo1Fin,
            periodo2Inicio,
            periodo2Fin,
            sucursal
        } = req.query;

        if (!periodo1Inicio || !periodo1Fin || !periodo2Inicio || !periodo2Fin) {
            return res.status(400).json({
                error: true,
                mensaje: 'Debe proporcionar las fechas de ambos períodos'
            });
        }

        // Período 1
        const p1Inicio = new Date(periodo1Inicio);
        p1Inicio.setHours(0, 0, 0, 0);
        const p1Fin = new Date(periodo1Fin);
        p1Fin.setHours(23, 59, 59, 999);

        // Período 2
        const p2Inicio = new Date(periodo2Inicio);
        p2Inicio.setHours(0, 0, 0, 0);
        const p2Fin = new Date(periodo2Fin);
        p2Fin.setHours(23, 59, 59, 999);

        // Obtener estadísticas de ambos períodos
        const estadisticasPeriodo1 = await obtenerEstadisticasVentas(p1Inicio, p1Fin, sucursal);
        const estadisticasPeriodo2 = await obtenerEstadisticasVentas(p2Inicio, p2Fin, sucursal);

        // Calcular variaciones porcentuales
        const calcularVariacion = (actual, anterior) => {
            if (anterior === 0) return actual > 0 ? 100 : 0;
            return (((actual - anterior) / anterior) * 100).toFixed(2);
        };

        const comparativo = {
            totalVentas: {
                periodo1: estadisticasPeriodo1.totalVentas || 0,
                periodo2: estadisticasPeriodo2.totalVentas || 0,
                variacion: calcularVariacion(
                    estadisticasPeriodo2.totalVentas || 0,
                    estadisticasPeriodo1.totalVentas || 0
                )
            },
            totalIngresos: {
                periodo1: estadisticasPeriodo1.totalIngresos || 0,
                periodo2: estadisticasPeriodo2.totalIngresos || 0,
                variacion: calcularVariacion(
                    estadisticasPeriodo2.totalIngresos || 0,
                    estadisticasPeriodo1.totalIngresos || 0
                )
            },
            promedioVenta: {
                periodo1: estadisticasPeriodo1.promedioVenta || 0,
                periodo2: estadisticasPeriodo2.promedioVenta || 0,
                variacion: calcularVariacion(
                    estadisticasPeriodo2.promedioVenta || 0,
                    estadisticasPeriodo1.promedioVenta || 0
                )
            }
        };

        res.json({
            success: true,
            periodos: {
                periodo1: {
                    inicio: p1Inicio.toLocaleDateString('es-CO'),
                    fin: p1Fin.toLocaleDateString('es-CO')
                },
                periodo2: {
                    inicio: p2Inicio.toLocaleDateString('es-CO'),
                    fin: p2Fin.toLocaleDateString('es-CO')
                }
            },
            comparativo
        });

    } catch (error) {
        console.error('Error al obtener comparativo:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener comparativo',
            detalle: error.message
        });
    }
};

module.exports = {
    obtenerDashboard,
    obtenerReporteVentas,
    obtenerReporteProductosMasVendidos,
    obtenerReporteRotacion,
    obtenerReportePorCategoria,
    obtenerReportePorGenero,
    obtenerReporteTallas,
    obtenerComparativo
};