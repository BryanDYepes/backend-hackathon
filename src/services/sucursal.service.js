const Sucursal = require('../models/Sucursal.model');
const Producto = require('../models/Producto.model');
const Venta = require('../models/Venta.model');
const MovimientoInventario = require('../models/MovimientoInventario.model');

// Obtener todas las sucursales activas
const obtenerSucursalesActivas = async () => {
    try {
        const sucursales = await Sucursal.find({ estado: 'Activa' })
            .populate('gerente', 'nombre email telefono')
            .sort({ nombre: 1 });
        
        return sucursales;
    } catch (error) {
        throw new Error('Error al obtener sucursales: ' + error.message);
    }
};

// Obtener estadísticas generales de una sucursal
const obtenerEstadisticasSucursal = async (sucursalId) => {
    try {
        const sucursal = await Sucursal.findById(sucursalId)
            .populate('gerente', 'nombre email');
        
        if (!sucursal) {
            throw new Error('Sucursal no encontrada');
        }

        // Contar productos
        const totalProductos = await Producto.countDocuments({ 
            sucursal: sucursalId, 
            activo: true 
        });

        // Calcular stock total y valor
        const inventario = await Producto.aggregate([
            { 
                $match: { 
                    sucursal: sucursalId, 
                    activo: true 
                } 
            },
            {
                $group: {
                    _id: null,
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

        // Ventas del mes actual
        const inicioMes = new Date();
        inicioMes.setDate(1);
        inicioMes.setHours(0, 0, 0, 0);

        const ventasMes = await Venta.aggregate([
            {
                $match: {
                    sucursal: sucursalId,
                    estadoVenta: 'Completada',
                    fecha: { $gte: inicioMes }
                }
            },
            {
                $group: {
                    _id: null,
                    totalVentas: { $sum: 1 },
                    ingresosMes: { $sum: '$total' }
                }
            }
        ]);

        const inventarioData = inventario[0] || {
            stockTotal: 0,
            valorInventario: 0,
            productosBajoStock: 0
        };

        const ventasData = ventasMes[0] || {
            totalVentas: 0,
            ingresosMes: 0
        };

        return {
            sucursal: {
                _id: sucursal._id,
                codigo: sucursal.codigo,
                nombre: sucursal.nombre,
                direccion: sucursal.direccionCompleta,
                ciudad: sucursal.direccion.ciudad,
                departamento: sucursal.direccion.departamento,
                telefono: sucursal.contacto.telefono,
                email: sucursal.contacto.email,
                gerente: sucursal.gerente,
                nombreGerente: sucursal.nombreGerente,
                estado: sucursal.estado,
                horario: sucursal.horario
            },
            inventario: {
                totalProductos,
                stockTotal: inventarioData.stockTotal,
                valorInventario: inventarioData.valorInventario,
                productosBajoStock: inventarioData.productosBajoStock
            },
            ventasMesActual: {
                cantidad: ventasData.totalVentas,
                ingresos: ventasData.ingresosMes
            }
        };
    } catch (error) {
        throw new Error('Error al obtener estadísticas: ' + error.message);
    }
};

// Comparar rendimiento de ventas entre sucursales
const compararRendimientoVentas = async (fechaInicio, fechaFin) => {
    try {
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);

        const rendimiento = await Venta.aggregate([
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
                    ingresosTotales: { $sum: '$total' },
                    ticketPromedio: { $avg: '$total' },
                    ventaMasAlta: { $max: '$total' }
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
            { $sort: { ingresosTotales: -1 } }
        ]);

        // Calcular porcentajes
        const ingresoTotal = rendimiento.reduce((sum, s) => sum + s.ingresosTotales, 0);

        return rendimiento.map((item, index) => ({
            ranking: index + 1,
            sucursal: {
                _id: item.sucursalInfo._id,
                codigo: item.sucursalInfo.codigo,
                nombre: item.sucursalInfo.nombre,
                ciudad: item.sucursalInfo.direccion.ciudad,
                gerente: item.sucursalInfo.nombreGerente
            },
            totalVentas: item.totalVentas,
            ingresosTotales: item.ingresosTotales,
            ticketPromedio: parseFloat(item.ticketPromedio.toFixed(2)),
            ventaMasAlta: item.ventaMasAlta,
            porcentajeIngresos: ((item.ingresosTotales / ingresoTotal) * 100).toFixed(2)
        }));
    } catch (error) {
        throw new Error('Error al comparar rendimiento: ' + error.message);
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
                    },
                    stockMinimo: { $sum: '$stockMinimo' }
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

        return comparacion.map(item => {
            const capacidadUsada = item.sucursalInfo.capacidad?.capacidadAlmacenamiento 
                ? ((item.stockTotal / item.sucursalInfo.capacidad.capacidadAlmacenamiento) * 100).toFixed(2)
                : null;

            return {
                sucursal: {
                    _id: item.sucursalInfo._id,
                    codigo: item.sucursalInfo.codigo,
                    nombre: item.sucursalInfo.nombre,
                    ciudad: item.sucursalInfo.direccion.ciudad
                },
                inventario: {
                    totalProductos: item.totalProductos,
                    stockTotal: item.stockTotal,
                    stockMinimo: item.stockMinimo,
                    valorInventario: item.valorInventario,
                    productosBajoStock: item.productosBajoStock
                },
                capacidad: {
                    maxima: item.sucursalInfo.capacidad?.capacidadAlmacenamiento || null,
                    utilizada: capacidadUsada,
                    disponible: item.sucursalInfo.capacidad?.capacidadAlmacenamiento 
                        ? item.sucursalInfo.capacidad.capacidadAlmacenamiento - item.stockTotal
                        : null
                }
            };
        });
    } catch (error) {
        throw new Error('Error al comparar inventarios: ' + error.message);
    }
};

// Productos más vendidos por sucursal
const productosMasVendidosPorSucursal = async (sucursalId, fechaInicio, fechaFin, limite = 10) => {
    try {
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);

        const productos = await Venta.aggregate([
            {
                $match: {
                    sucursal: sucursalId,
                    estadoVenta: 'Completada',
                    fecha: { $gte: inicio, $lte: fin }
                }
            },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.producto',
                    nombreProducto: { $first: '$items.nombreProducto' },
                    codigoProducto: { $first: '$items.codigoProducto' },
                    categoria: { $first: '$items.categoria' },
                    cantidadVendida: { $sum: '$items.cantidad' },
                    ingresoTotal: { $sum: '$items.subtotal' }
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

// Productos con bajo stock por sucursal
const productosBajoStockPorSucursal = async (sucursalId) => {
    try {
        const productos = await Producto.find({
            sucursal: sucursalId,
            activo: true,
            alertaStock: true
        })
        .select('codigo nombre categoria stockActual stockMinimo precioVenta')
        .sort({ stockActual: 1 });

        return productos.map(p => ({
            producto: p._id,
            codigo: p.codigo,
            nombre: p.nombre,
            categoria: p.categoria,
            stockActual: p.stockActual,
            stockMinimo: p.stockMinimo,
            deficit: p.stockMinimo - p.stockActual,
            prioridad: p.stockActual === 0 ? 'Crítica' : 
                       p.stockActual < (p.stockMinimo * 0.5) ? 'Alta' : 'Media'
        }));
    } catch (error) {
        throw new Error('Error al obtener productos bajo stock: ' + error.message);
    }
};

// Resumen de movimientos de inventario por sucursal
const resumenMovimientosSucursal = async (sucursalId, fechaInicio, fechaFin) => {
    try {
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);

        const movimientos = await MovimientoInventario.aggregate([
            {
                $match: {
                    sucursal: sucursalId,
                    createdAt: { $gte: inicio, $lte: fin }
                }
            },
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

        const totales = movimientos.reduce((acc, mov) => {
            acc.totalMovimientos += mov.numeroMovimientos;
            acc.totalCantidad += mov.cantidad;
            acc.totalValor += mov.valorTotal;
            return acc;
        }, { totalMovimientos: 0, totalCantidad: 0, totalValor: 0 });

        return {
            porTipo: movimientos,
            totales
        };
    } catch (error) {
        throw new Error('Error al obtener resumen de movimientos: ' + error.message);
    }
};

// Historial de transferencias de una sucursal
const historialTransferencias = async (sucursalId, tipo = 'todas', fechaInicio, fechaFin) => {
    try {
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);

        let tiposMovimiento = [];
        if (tipo === 'todas') {
            tiposMovimiento = ['TRANSFERENCIA_ENTRADA', 'TRANSFERENCIA_SALIDA'];
        } else if (tipo === 'entradas') {
            tiposMovimiento = ['TRANSFERENCIA_ENTRADA'];
        } else if (tipo === 'salidas') {
            tiposMovimiento = ['TRANSFERENCIA_SALIDA'];
        }

        const transferencias = await MovimientoInventario.find({
            sucursal: sucursalId,
            tipoMovimiento: { $in: tiposMovimiento },
            createdAt: { $gte: inicio, $lte: fin }
        })
        .populate('producto', 'codigo nombre categoria')
        .populate('usuario', 'nombre email')
        .sort({ createdAt: -1 });

        return transferencias;
    } catch (error) {
        throw new Error('Error al obtener historial de transferencias: ' + error.message);
    }
};

// Sugerir transferencias entre sucursales
const sugerirTransferencias = async () => {
    try {
        // Obtener productos con sobre-stock y bajo stock por sucursal
        const productos = await Producto.find({ activo: true })
            .populate('sucursal', 'codigo nombre ciudad');

        const sugerencias = [];

        // Agrupar por código de producto
        const productosPorCodigo = productos.reduce((acc, p) => {
            if (!acc[p.codigo]) acc[p.codigo] = [];
            acc[p.codigo].push(p);
            return acc;
        }, {});

        // Analizar cada grupo de productos
        for (const codigo in productosPorCodigo) {
            const grupo = productosPorCodigo[codigo];
            
            // Encontrar sucursales con exceso y déficit
            const conExceso = grupo.filter(p => !p.alertaStock && p.stockActual > p.stockMinimo * 2);
            const conDeficit = grupo.filter(p => p.alertaStock);

            // Generar sugerencias
            for (const origen of conExceso) {
                for (const destino of conDeficit) {
                    const exceso = origen.stockActual - origen.stockMinimo;
                    const deficit = destino.stockMinimo - destino.stockActual;
                    const cantidadSugerida = Math.min(exceso, deficit);

                    if (cantidadSugerida > 0) {
                        sugerencias.push({
                            producto: {
                                _id: origen._id,
                                codigo: origen.codigo,
                                nombre: origen.nombre,
                                categoria: origen.categoria
                            },
                            origen: {
                                sucursal: origen.sucursal,
                                stockActual: origen.stockActual,
                                stockMinimo: origen.stockMinimo,
                                exceso
                            },
                            destino: {
                                sucursal: destino.sucursal,
                                stockActual: destino.stockActual,
                                stockMinimo: destino.stockMinimo,
                                deficit
                            },
                            cantidadSugerida,
                            prioridad: destino.stockActual === 0 ? 'Crítica' : 'Alta'
                        });
                    }
                }
            }
        }

        return sugerencias.sort((a, b) => {
            if (a.prioridad === 'Crítica' && b.prioridad !== 'Crítica') return -1;
            if (a.prioridad !== 'Crítica' && b.prioridad === 'Crítica') return 1;
            return b.cantidadSugerida - a.cantidadSugerida;
        });
    } catch (error) {
        throw new Error('Error al sugerir transferencias: ' + error.message);
    }
};

// Dashboard completo de sucursal
const dashboardSucursal = async (sucursalId, fechaInicio, fechaFin) => {
    try {
        const [
            estadisticas,
            rendimiento,
            productosMasVendidos,
            productosBajoStock,
            movimientos
        ] = await Promise.all([
            obtenerEstadisticasSucursal(sucursalId),
            compararRendimientoVentas(fechaInicio, fechaFin),
            productosMasVendidosPorSucursal(sucursalId, fechaInicio, fechaFin, 5),
            productosBajoStockPorSucursal(sucursalId),
            resumenMovimientosSucursal(sucursalId, fechaInicio, fechaFin)
        ]);

        // Encontrar la posición de esta sucursal en el ranking
        const posicionRanking = rendimiento.findIndex(
            r => r.sucursal._id.toString() === sucursalId.toString()
        ) + 1;

        return {
            sucursal: estadisticas.sucursal,
            periodo: {
                inicio: new Date(fechaInicio),
                fin: new Date(fechaFin)
            },
            ranking: {
                posicion: posicionRanking,
                totalSucursales: rendimiento.length
            },
            estadisticas: estadisticas.inventario,
            ventas: estadisticas.ventasMesActual,
            topProductos: productosMasVendidos,
            alertas: {
                productosBajoStock: productosBajoStock.length,
                detalle: productosBajoStock.slice(0, 10)
            },
            movimientosInventario: movimientos
        };
    } catch (error) {
        throw new Error('Error al generar dashboard: ' + error.message);
    }
};

// Reporte comparativo global
const reporteComparativoGlobal = async (fechaInicio, fechaFin) => {
    try {
        const [
            rendimientoVentas,
            inventarios,
            transferencias
        ] = await Promise.all([
            compararRendimientoVentas(fechaInicio, fechaFin),
            compararInventarioSucursales(),
            sugerirTransferencias()
        ]);

        return {
            periodo: {
                inicio: new Date(fechaInicio),
                fin: new Date(fechaFin)
            },
            rendimientoVentas,
            inventarios,
            transferenciasRecomendadas: transferencias.slice(0, 10),
            resumen: {
                totalSucursales: rendimientoVentas.length,
                ingresosGlobales: rendimientoVentas.reduce((sum, s) => sum + s.ingresosTotales, 0),
                ventasGlobales: rendimientoVentas.reduce((sum, s) => sum + s.totalVentas, 0),
                valorInventarioGlobal: inventarios.reduce((sum, i) => sum + i.inventario.valorInventario, 0)
            }
        };
    } catch (error) {
        throw new Error('Error al generar reporte comparativo: ' + error.message);
    }
};

module.exports = {
    // Básicos
    obtenerSucursalesActivas,
    obtenerEstadisticasSucursal,
    
    // Comparativos
    compararRendimientoVentas,
    compararInventarioSucursales,
    
    // Productos
    productosMasVendidosPorSucursal,
    productosBajoStockPorSucursal,
    
    // Movimientos
    resumenMovimientosSucursal,
    historialTransferencias,
    
    // Transferencias
    sugerirTransferencias,
    
    // Reportes
    dashboardSucursal,
    reporteComparativoGlobal
};