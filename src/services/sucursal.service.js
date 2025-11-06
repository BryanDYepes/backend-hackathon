const Sucursal = require('../models/Sucursal.model');
const Producto = require('../models/Producto.model');
const Venta = require('../models/Venta.model');

// Obtener estadísticas detalladas de una sucursal
const obtenerEstadisticasSucursal = async (nombreSucursal, fechaInicio, fechaFin) => {
    try {
        // Definir rango de fechas
        const inicio = fechaInicio 
            ? new Date(fechaInicio) 
            : new Date(new Date().setDate(1)); // Inicio del mes actual
        inicio.setHours(0, 0, 0, 0);
        
        const fin = fechaFin 
            ? new Date(fechaFin) 
            : new Date(); // Hoy
        fin.setHours(23, 59, 59, 999);
        
        // Estadísticas de inventario
        const inventario = await Producto.aggregate([
            {
                $match: {
                    sucursal: nombreSucursal,
                    activo: true
                }
            },
            {
                $group: {
                    _id: null,
                    totalProductos: { $sum: 1 },
                    totalUnidades: { $sum: '$stockActual' },
                    valorCompra: { $sum: { $multiply: ['$stockActual', '$precioCompra'] } },
                    valorVenta: { $sum: { $multiply: ['$stockActual', '$precioVenta'] } },
                    productosStockBajo: { $sum: { $cond: ['$alertaStock', 1, 0] } }
                }
            }
        ]);
        
        // Estadísticas de ventas
        const ventas = await Venta.aggregate([
            {
                $match: {
                    sucursal: nombreSucursal,
                    estadoVenta: 'Completada',
                    fecha: { $gte: inicio, $lte: fin }
                }
            },
            {
                $group: {
                    _id: null,
                    totalVentas: { $sum: 1 },
                    totalIngresos: { $sum: '$total' },
                    promedioVenta: { $avg: '$total' },
                    ventaMasAlta: { $max: '$total' }
                }
            }
        ]);
        
        // Productos más vendidos
        const topProductos = await Venta.aggregate([
            {
                $match: {
                    sucursal: nombreSucursal,
                    estadoVenta: 'Completada',
                    fecha: { $gte: inicio, $lte: fin }
                }
            },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.producto',
                    nombre: { $first: '$items.nombreProducto' },
                    categoria: { $first: '$items.categoria' },
                    cantidadVendida: { $sum: '$items.cantidad' },
                    ingresos: { $sum: '$items.subtotal' }
                }
            },
            { $sort: { cantidadVendida: -1 } },
            { $limit: 5 }
        ]);
        
        // Ventas por método de pago
        const metodosPago = await Venta.aggregate([
            {
                $match: {
                    sucursal: nombreSucursal,
                    estadoVenta: 'Completada',
                    fecha: { $gte: inicio, $lte: fin }
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
        
        return {
            periodo: {
                inicio: inicio.toLocaleDateString('es-CO'),
                fin: fin.toLocaleDateString('es-CO')
            },
            inventario: inventario[0] || {
                totalProductos: 0,
                totalUnidades: 0,
                valorCompra: 0,
                valorVenta: 0,
                productosStockBajo: 0
            },
            ventas: ventas[0] || {
                totalVentas: 0,
                totalIngresos: 0,
                promedioVenta: 0,
                ventaMasAlta: 0
            },
            topProductos,
            metodosPago
        };
        
    } catch (error) {
        throw new Error('Error al obtener estadísticas: ' + error.message);
    }
};

// Comparar rendimiento entre todas las sucursales
const compararSucursales = async (fechaInicio, fechaFin) => {
    try {
        const inicio = new Date(fechaInicio);
        inicio.setHours(0, 0, 0, 0);
        
        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999);
        
        // Obtener todas las sucursales activas
        const sucursales = await Sucursal.find({ activo: true });
        
        const comparativo = [];
        
        for (const sucursal of sucursales) {
            // Ventas
            const ventas = await Venta.aggregate([
                {
                    $match: {
                        sucursal: sucursal.nombre,
                        estadoVenta: 'Completada',
                        fecha: { $gte: inicio, $lte: fin }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalVentas: { $sum: 1 },
                        totalIngresos: { $sum: '$total' },
                        promedioVenta: { $avg: '$total' }
                    }
                }
            ]);
            
            // Inventario
            const inventario = await Producto.aggregate([
                {
                    $match: {
                        sucursal: sucursal.nombre,
                        activo: true
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalProductos: { $sum: 1 },
                        valorInventario: { $sum: { $multiply: ['$stockActual', '$precioCompra'] } }
                    }
                }
            ]);
            
            comparativo.push({
                sucursal: {
                    codigo: sucursal.codigo,
                    nombre: sucursal.nombre,
                    ciudad: sucursal.ciudad
                },
                ventas: ventas[0] || {
                    totalVentas: 0,
                    totalIngresos: 0,
                    promedioVenta: 0
                },
                inventario: inventario[0] || {
                    totalProductos: 0,
                    valorInventario: 0
                }
            });
        }
        
        // Ordenar por ingresos de mayor a menor
        return comparativo.sort((a, b) => 
            b.ventas.totalIngresos - a.ventas.totalIngresos
        );
        
    } catch (error) {
        throw new Error('Error al comparar sucursales: ' + error.message);
    }
};

// Obtener ranking de sucursales por indicador
const obtenerRankingSucursales = async (indicador, fechaInicio, fechaFin) => {
    try {
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);
        
        let ranking = [];
        
        switch (indicador) {
            case 'ventas':
                ranking = await Venta.aggregate([
                    {
                        $match: {
                            estadoVenta: 'Completada',
                            fecha: { $gte: inicio, $lte: fin }
                        }
                    },
                    {
                        $group: {
                            _id: '$sucursal',
                            totalVentas: { $sum: 1 },
                            totalIngresos: { $sum: '$total' }
                        }
                    },
                    { $sort: { totalIngresos: -1 } }
                ]);
                break;
                
            case 'inventario':
                ranking = await Producto.aggregate([
                    {
                        $match: { activo: true }
                    },
                    {
                        $group: {
                            _id: '$sucursal',
                            totalProductos: { $sum: 1 },
                            valorTotal: { $sum: { $multiply: ['$stockActual', '$precioVenta'] } }
                        }
                    },
                    { $sort: { valorTotal: -1 } }
                ]);
                break;
                
            default:
                throw new Error('Indicador no válido');
        }
        
        return ranking;
        
    } catch (error) {
        throw new Error('Error al obtener ranking: ' + error.message);
    }
};

// Obtener resumen ejecutivo de todas las sucursales
const obtenerResumenEjecutivo = async () => {
    try {
        const sucursalesActivas = await Sucursal.find({ activo: true });
        
        // Resumen general
        const resumen = {
            totalSucursales: sucursalesActivas.length,
            sucursalesPorCiudad: {},
            totales: {
                productos: 0,
                valorInventario: 0,
                ventasMesActual: 0
            }
        };
        
        // Agrupar por ciudad y sumar totales
        for (const sucursal of sucursalesActivas) {
            // Contar por ciudad
            if (!resumen.sucursalesPorCiudad[sucursal.ciudad]) {
                resumen.sucursalesPorCiudad[sucursal.ciudad] = 0;
            }
            resumen.sucursalesPorCiudad[sucursal.ciudad]++;
            
            // Sumar estadísticas
            resumen.totales.productos += sucursal.estadisticas?.totalProductos || 0;
            resumen.totales.valorInventario += sucursal.estadisticas?.valorInventario || 0;
            resumen.totales.ventasMesActual += sucursal.estadisticas?.ventasMesActual || 0;
        }
        
        return resumen;
        
    } catch (error) {
        throw new Error('Error al obtener resumen ejecutivo: ' + error.message);
    }
};

// Analizar distribución geográfica
const analizarDistribucionGeografica = async () => {
    try {
        const distribucion = await Sucursal.aggregate([
            {
                $match: { activo: true }
            },
            {
                $group: {
                    _id: '$ciudad',
                    totalSucursales: { $sum: 1 },
                    sucursales: {
                        $push: {
                            codigo: '$codigo',
                            nombre: '$nombre',
                            direccion: '$direccion'
                        }
                    }
                }
            },
            { $sort: { totalSucursales: -1 } }
        ]);
        
        // Calcular inventario y ventas por ciudad
        const distribucionCompleta = await Promise.all(
            distribucion.map(async (ciudad) => {
                const sucursalesNombres = ciudad.sucursales.map(s => s.nombre);
                
                // Inventario
                const inventario = await Producto.aggregate([
                    {
                        $match: {
                            sucursal: { $in: sucursalesNombres },
                            activo: true
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalProductos: { $sum: 1 },
                            valorTotal: { $sum: { $multiply: ['$stockActual', '$precioCompra'] } }
                        }
                    }
                ]);
                
                // Ventas del mes actual
                const inicioMes = new Date();
                inicioMes.setDate(1);
                inicioMes.setHours(0, 0, 0, 0);
                
                const ventas = await Venta.aggregate([
                    {
                        $match: {
                            sucursal: { $in: sucursalesNombres },
                            estadoVenta: 'Completada',
                            fecha: { $gte: inicioMes }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalVentas: { $sum: 1 },
                            totalIngresos: { $sum: '$total' }
                        }
                    }
                ]);
                
                return {
                    ciudad: ciudad._id,
                    totalSucursales: ciudad.totalSucursales,
                    sucursales: ciudad.sucursales,
                    inventario: inventario[0] || { totalProductos: 0, valorTotal: 0 },
                    ventas: ventas[0] || { totalVentas: 0, totalIngresos: 0 }
                };
            })
        );
        
        return distribucionCompleta;
        
    } catch (error) {
        throw new Error('Error al analizar distribución: ' + error.message);
    }
};

module.exports = {
    obtenerEstadisticasSucursal,
    compararSucursales,
    obtenerRankingSucursales,
    obtenerResumenEjecutivo,
    analizarDistribucionGeografica
};