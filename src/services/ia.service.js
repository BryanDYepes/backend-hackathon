// services/ia.service.js
const openai = require('../utils/openaiClient');
const Venta = require('../models/Venta.model');
const Producto = require('../models/Producto.model');
const Sucursal = require('../models/Sucursal.model');
const MovimientoInventario = require('../models/MovimientoInventario.model');

// ========================================
// 1. ROTACIÓN DE PRODUCTOS
// ========================================
const analizarRotacionProductos = async (fechaInicio, fechaFin, sucursal = null) => {
    try {
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);
        const diasPeriodo = Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24));

        const filtroVentas = {
            estadoVenta: 'Completada',
            fecha: { $gte: inicio, $lte: fin }
        };
        if (sucursal) filtroVentas.sucursal = sucursal;

        // Calcular rotación por producto
        const rotacion = await Venta.aggregate([
            { $match: filtroVentas },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.producto',
                    nombreProducto: { $first: '$items.nombreProducto' },
                    categoria: { $first: '$items.categoria' },
                    genero: { $first: '$items.genero' },
                    talla: { $first: '$items.talla' },
                    cantidadVendida: { $sum: '$items.cantidad' },
                    totalIngresos: { $sum: '$items.subtotal' }
                }
            }
        ]);

        // Enriquecer con datos de stock actual
        const analisisCompleto = await Promise.all(
            rotacion.map(async (item) => {
                const producto = await Producto.findById(item._id);
                if (!producto) return null;

                const stockPromedio = (producto.stockActual + item.cantidadVendida) / 2;
                const indiceRotacion = stockPromedio > 0 
                    ? ((item.cantidadVendida / stockPromedio) * (30 / diasPeriodo)).toFixed(2)
                    : 0;

                return {
                    producto: item._id,
                    nombre: item.nombreProducto,
                    categoria: item.categoria,
                    genero: item.genero,
                    talla: item.talla,
                    cantidadVendida: item.cantidadVendida,
                    stockActual: producto.stockActual,
                    indiceRotacionMensual: parseFloat(indiceRotacion),
                    clasificacion: indiceRotacion > 2 ? 'ALTA' : indiceRotacion > 1 ? 'MEDIA' : 'BAJA',
                    ingresos: item.totalIngresos
                };
            })
        );

        const datosLimpios = analisisCompleto
            .filter(item => item !== null)
            .sort((a, b) => b.indiceRotacionMensual - a.indiceRotacionMensual);

        // Análisis con IA
        const top10 = datosLimpios.slice(0, 10);
        const bottom10 = datosLimpios.slice(-10);

        const prompt = `
Eres un analista retail experto. Analiza la rotación de inventario de una tienda de ropa:

TOP 10 PRODUCTOS DE ALTA ROTACIÓN:
${JSON.stringify(top10, null, 2)}

BOTTOM 10 PRODUCTOS DE BAJA ROTACIÓN:
${JSON.stringify(bottom10, null, 2)}

Responde SOLO en formato JSON válido:
{
  "resumenGeneral": "análisis ejecutivo en 2-3 líneas",
  "productosExitosos": ["producto 1", "producto 2", "producto 3"],
  "productosProblemáticos": ["producto 1", "producto 2"],
  "recomendacionesAccion": [
    "acción específica 1",
    "acción específica 2",
    "acción específica 3"
  ],
  "alertasCriticas": ["alerta 1 si aplica"]
}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 800,
            response_format: { type: "json_object" }
        });

        const analisisIA = JSON.parse(completion.choices[0].message.content);

        return {
            success: true,
            periodo: {
                inicio: inicio.toLocaleDateString('es-CO'),
                fin: fin.toLocaleDateString('es-CO'),
                dias: diasPeriodo
            },
            estadisticas: {
                totalProductosAnalizados: datosLimpios.length,
                altaRotacion: datosLimpios.filter(p => p.clasificacion === 'ALTA').length,
                mediaRotacion: datosLimpios.filter(p => p.clasificacion === 'MEDIA').length,
                bajaRotacion: datosLimpios.filter(p => p.clasificacion === 'BAJA').length
            },
            datos: datosLimpios,
            analisisIA
        };

    } catch (error) {
        throw new Error('Error en análisis de rotación: ' + error.message);
    }
};

// ========================================
// 2. SOBRE-STOCK
// ========================================
const identificarSobreStock = async (mesesHistorico = 6) => {
    try {
        const fechaInicio = new Date();
        fechaInicio.setMonth(fechaInicio.getMonth() - mesesHistorico);

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
                    ventaMensualPromedio: { $avg: '$items.cantidad' }
                }
            }
        ]);

        const productosSobreStock = [];

        for (const item of ventasPromedio) {
            const producto = await Producto.findById(item._id);
            if (!producto || !producto.activo) continue;

            const mesesInventario = item.ventaMensualPromedio > 0
                ? (producto.stockActual / item.ventaMensualPromedio).toFixed(2)
                : 999;

            if (mesesInventario > 6) {
                const valorInmovilizado = producto.stockActual * producto.precioCompra;
                
                productosSobreStock.push({
                    producto: producto._id,
                    codigo: producto.codigo,
                    nombre: producto.nombre,
                    categoria: producto.categoria,
                    genero: producto.genero,
                    talla: producto.talla,
                    sucursal: producto.sucursal,
                    stockActual: producto.stockActual,
                    ventaMensualPromedio: parseFloat(item.ventaMensualPromedio.toFixed(2)),
                    mesesInventario: parseFloat(mesesInventario),
                    valorInmovilizado,
                    prioridad: mesesInventario > 12 ? 'CRÍTICO' : 'ALTO'
                });
            }
        }

        const ordenado = productosSobreStock.sort((a, b) => b.mesesInventario - a.mesesInventario);

        // Análisis IA
        const prompt = `
Eres un experto en gestión de inventarios. Analiza estos productos con sobre-stock:

${JSON.stringify(ordenado.slice(0, 15), null, 2)}

Responde SOLO en formato JSON válido:
{
  "resumen": "situación general del sobre-stock",
  "impactoFinanciero": "análisis del capital inmovilizado",
  "estrategias": [
    "estrategia 1 con % descuento sugerido",
    "estrategia 2",
    "estrategia 3"
  ],
  "prioridadLiquidacion": ["producto 1", "producto 2", "producto 3"]
}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.6,
            max_tokens: 700,
            response_format: { type: "json_object" }
        });

        const analisisIA = JSON.parse(completion.choices[0].message.content);

        return {
            success: true,
            totalProductos: ordenado.length,
            valorTotalInmovilizado: ordenado.reduce((sum, p) => sum + p.valorInmovilizado, 0),
            datos: ordenado,
            analisisIA
        };

    } catch (error) {
        throw new Error('Error identificando sobre-stock: ' + error.message);
    }
};

// ========================================
// 3. REABASTECIMIENTO INTELIGENTE
// ========================================
const generarReabastecimientoInteligente = async (diasProyeccion = 30, sucursal = null) => {
    try {
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - 90);

        const filtroProductos = { activo: true };
        if (sucursal) filtroProductos.sucursal = sucursal;

        const productos = await Producto.find(filtroProductos);
        const alertas = [];

        for (const producto of productos) {
            const ventasRecientes = await Venta.aggregate([
                {
                    $match: {
                        estadoVenta: 'Completada',
                        fecha: { $gte: fechaInicio }
                    }
                },
                { $unwind: '$items' },
                { $match: { 'items.producto': producto._id } },
                {
                    $group: {
                        _id: null,
                        totalVendido: { $sum: '$items.cantidad' }
                    }
                }
            ]);

            const totalVendido = ventasRecientes[0]?.totalVendido || 0;
            const promedioDiario = totalVendido / 90;
            const diasStock = promedioDiario > 0 ? producto.stockActual / promedioDiario : 999;

            if (diasStock < diasProyeccion) {
                const unidadesNecesarias = Math.ceil((promedioDiario * diasProyeccion) - producto.stockActual);
                
                alertas.push({
                    producto: producto._id,
                    codigo: producto.codigo,
                    nombre: producto.nombre,
                    categoria: producto.categoria,
                    genero: producto.genero,
                    sucursal: producto.sucursal,
                    stockActual: producto.stockActual,
                    promedioDiario: parseFloat(promedioDiario.toFixed(2)),
                    diasStockDisponible: Math.floor(diasStock),
                    unidadesSugeridas: unidadesNecesarias,
                    costoReabastecimiento: unidadesNecesarias * producto.precioCompra,
                    prioridad: diasStock < 7 ? 'CRÍTICO' : diasStock < 15 ? 'ALTO' : 'MEDIO'
                });
            }
        }

        const ordenado = alertas.sort((a, b) => a.diasStockDisponible - b.diasStockDisponible);

        // Análisis IA
        const prompt = `
Eres un experto en cadena de suministro. Analiza estas alertas de reabastecimiento:

${JSON.stringify(ordenado.slice(0, 20), null, 2)}

Responde SOLO en formato JSON válido:
{
  "resumenSituacion": "estado general del inventario",
  "productosCriticos": ["top 5 productos que requieren compra urgente"],
  "planCompras": "estrategia de reabastecimiento sugerida",
  "inversionRequerida": "análisis del capital necesario",
  "recomendacionesEspecificas": ["recomendación 1", "recomendación 2"]
}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.5,
            max_tokens: 800,
            response_format: { type: "json_object" }
        });

        const analisisIA = JSON.parse(completion.choices[0].message.content);

        return {
            success: true,
            proyeccion: `${diasProyeccion} días`,
            totalAlertas: ordenado.length,
            inversionTotal: ordenado.reduce((sum, a) => sum + a.costoReabastecimiento, 0),
            datos: ordenado,
            analisisIA
        };

    } catch (error) {
        throw new Error('Error en reabastecimiento: ' + error.message);
    }
};

// ========================================
// 4. COMPARATIVO SUCURSALES
// ========================================
const compararSucursales = async (fechaInicio, fechaFin) => {
    try {
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);

        const ventasPorSucursal = await Venta.aggregate([
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
                    totalIngresos: { $sum: '$total' },
                    promedioVenta: { $avg: '$total' }
                }
            },
            { $sort: { totalIngresos: -1 } }
        ]);

        // Enriquecer con datos de productos por sucursal
        const analisisCompleto = await Promise.all(
            ventasPorSucursal.map(async (sucursal) => {
                const totalProductos = await Producto.countDocuments({
                    sucursal: sucursal._id,
                    activo: true
                });

                const valorInventario = await Producto.aggregate([
                    {
                        $match: {
                            sucursal: sucursal._id,
                            activo: true
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            valor: { $sum: { $multiply: ['$stockActual', '$precioCompra'] } }
                        }
                    }
                ]);

                return {
                    sucursal: sucursal._id,
                    totalVentas: sucursal.totalVentas,
                    totalIngresos: sucursal.totalIngresos,
                    promedioVenta: parseFloat(sucursal.promedioVenta.toFixed(2)),
                    totalProductos,
                    valorInventario: valorInventario[0]?.valor || 0
                };
            })
        );

        // Análisis IA
        const prompt = `
Eres un consultor retail especializado en expansión. Analiza el rendimiento de estas sucursales:

${JSON.stringify(analisisCompleto, null, 2)}

Responde SOLO en formato JSON válido:
{
  "mejorSucursal": "nombre y razón",
  "sucursalesRiesgo": ["sucursal con análisis"],
  "oportunidadesExpansion": "recomendaciones para nuevas ciudades",
  "estrategiaRedistribucion": "cómo balancear inventario entre sucursales",
  "kpisDestacados": ["KPI 1", "KPI 2", "KPI 3"]
}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 900,
            response_format: { type: "json_object" }
        });

        const analisisIA = JSON.parse(completion.choices[0].message.content);

        return {
            success: true,
            periodo: {
                inicio: inicio.toLocaleDateString('es-CO'),
                fin: fin.toLocaleDateString('es-CO')
            },
            totalSucursales: analisisCompleto.length,
            datos: analisisCompleto,
            analisisIA
        };

    } catch (error) {
        throw new Error('Error comparando sucursales: ' + error.message);
    }
};

// ========================================
// 5. TENDENCIAS MENSUALES
// ========================================
const analizarTendenciasMensuales = async (mesesAtras = 12) => {
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
            { $unwind: '$items' },
            {
                $group: {
                    _id: {
                        año: { $year: '$fecha' },
                        mes: { $month: '$fecha' },
                        categoria: '$items.categoria'
                    },
                    cantidadVendida: { $sum: '$items.cantidad' },
                    totalIngresos: { $sum: '$items.subtotal' }
                }
            },
            { $sort: { '_id.año': 1, '_id.mes': 1 } }
        ]);

        // Análisis IA
        const prompt = `
Eres un analista de tendencias retail. Analiza estos datos históricos de ventas:

${JSON.stringify(ventasMensuales, null, 2)}

Responde SOLO en formato JSON válido:
{
  "patronesEstacionales": "análisis de temporadas",
  "categoriasMasVendidas": ["cat 1", "cat 2", "cat 3"],
  "prediccionProximos3Meses": "pronóstico basado en histórico",
  "recomendacionesCompra": ["qué comprar para próxima temporada"],
  "alertasTendencias": ["alerta 1 si aplica"]
}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.6,
            max_tokens: 800,
            response_format: { type: "json_object" }
        });

        const analisisIA = JSON.parse(completion.choices[0].message.content);

        return {
            success: true,
            periodoAnalizado: `Últimos ${mesesAtras} meses`,
            totalRegistros: ventasMensuales.length,
            datos: ventasMensuales,
            analisisIA
        };

    } catch (error) {
        throw new Error('Error analizando tendencias: ' + error.message);
    }
};

// ========================================
// 6. SEGMENTACIÓN GÉNERO Y TALLA
// ========================================
const analizarSegmentacionGeneroTalla = async (fechaInicio, fechaFin) => {
    try {
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);

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
                    _id: {
                        genero: '$items.genero',
                        talla: '$items.talla'
                    },
                    cantidadVendida: { $sum: '$items.cantidad' },
                    totalIngresos: { $sum: '$items.subtotal' }
                }
            },
            { $sort: { cantidadVendida: -1 } }
        ]);

        // Análisis IA
        const prompt = `
Eres un experto en comportamiento del consumidor retail. Analiza estas ventas por género y talla:

${JSON.stringify(ventasPorGenero, null, 2)}

Responde SOLO en formato JSON válido:
{
  "perfilClientePrincipal": "descripción del segmento más importante",
  "tallasMasVendidas": {
    "mujer": ["talla 1", "talla 2"],
    "hombre": ["talla 1", "talla 2"],
    "niño": ["talla 1", "talla 2"],
    "niña": ["talla 1", "talla 2"]
  },
  "recomendacionesStock": ["ajuste 1", "ajuste 2", "ajuste 3"],
  "oportunidadesSegmento": "insights sobre mercado no atendido"
}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 800,
            response_format: { type: "json_object" }
        });

        const analisisIA = JSON.parse(completion.choices[0].message.content);

        return {
            success: true,
            periodo: {
                inicio: inicio.toLocaleDateString('es-CO'),
                fin: fin.toLocaleDateString('es-CO')
            },
            datos: ventasPorGenero,
            analisisIA
        };

    } catch (error) {
        throw new Error('Error en segmentación: ' + error.message);
    }
};

// ========================================
// 7. DASHBOARD EJECUTIVO
// ========================================
const generarDashboardEjecutivo = async (fechaInicio, fechaFin, sucursal = null) => {
    try {
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);

        const filtros = {
            estadoVenta: 'Completada',
            fecha: { $gte: inicio, $lte: fin }
        };
        if (sucursal) filtros.sucursal = sucursal;

        // KPIs principales
        const estadisticas = await Venta.aggregate([
            { $match: filtros },
            {
                $group: {
                    _id: null,
                    totalVentas: { $sum: 1 },
                    totalIngresos: { $sum: '$total' },
                    promedioVenta: { $avg: '$total' }
                }
            }
        ]);

        const productosBajoStock = await Producto.countDocuments({
            alertaStock: true,
            activo: true,
            ...(sucursal && { sucursal })
        });

        const top5Productos = await Venta.aggregate([
            { $match: filtros },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.nombreProducto',
                    cantidadVendida: { $sum: '$items.cantidad' }
                }
            },
            { $sort: { cantidadVendida: -1 } },
            { $limit: 5 }
        ]);

        const kpis = {
            totalVentas: estadisticas[0]?.totalVentas || 0,
            totalIngresos: estadisticas[0]?.totalIngresos || 0,
            promedioVenta: parseFloat(estadisticas[0]?.promedioVenta.toFixed(2)) || 0,
            productosBajoStock,
            top5Productos
        };

        // Análisis IA
        const prompt = `
Eres un Director Comercial experimentado. Genera un reporte ejecutivo basado en estos KPIs:

${JSON.stringify(kpis, null, 2)}

Responde SOLO en formato JSON válido:
{
  "resumenEjecutivo": "análisis en 3-4 líneas del estado del negocio",
  "indicadoresDestacados": ["métrica positiva 1", "métrica positiva 2"],
  "alertasPrioritarias": ["alerta crítica 1", "alerta crítica 2"],
  "accionesInmediatas": [
    "acción concreta 1",
    "acción concreta 2",
    "acción concreta 3"
  ],
  "proyeccionSemanal": "estimación de próximos 7 días"
}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 900,
            response_format: { type: "json_object" }
        });

        const analisisIA = JSON.parse(completion.choices[0].message.content);

        return {
            success: true,
            periodo: {
                inicio: inicio.toLocaleDateString('es-CO'),
                fin: fin.toLocaleDateString('es-CO')
            },
            kpis,
            analisisIA
        };

    } catch (error) {
        throw new Error('Error generando dashboard: ' + error.message);
    }
};

// ========================================
// 8. ESTRATEGIA DE DESCUENTOS (INNOVADORA)
// ========================================
const generarEstrategiaDescuentos = async () => {
    try {
        // Productos lentos (últimos 60 días)
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - 60);

        const ventasRecientes = await Venta.aggregate([
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
                    cantidadVendida: { $sum: '$items.cantidad' }
                }
            }
        ]);

        const idsVendidos = ventasRecientes.map(v => v._id);
        const productosLentos = await Producto.find({
            _id: { $nin: idsVendidos },
            activo: true,
            stockActual: { $gt: 0 }
        }).limit(20);

        const estrategias = productosLentos.map(p => {
            const margen = ((p.precioVenta - p.precioCompra) / p.precioVenta * 100).toFixed(2);
            const valorInventario = p.stockActual * p.precioCompra;

            return {
                producto: p._id,
                codigo: p.codigo,
                nombre: p.nombre,
                categoria: p.categoria,
                stockActual: p.stockActual,
                precioVenta: p.precioVenta,
                margenActual: parseFloat(margen),
                valorInmovilizado: valorInventario,
                diasSinVender: Math.floor((Date.now() - p.updatedAt) / (1000 * 60 * 60 * 24))
            };
        });

        // Análisis IA
        const prompt = `
Eres un experto en pricing dinámico. Diseña una estrategia de descuentos para estos productos:

${JSON.stringify(estrategias, null, 2)}

Para CADA producto, calcula el % de descuento óptimo que:
1. Acelere la venta sin perder rentabilidad crítica
2. Considere el margen actual
3. Priorice productos con más días sin vender

Responde SOLO en formato JSON válido:
{
  "estrategiaGeneral": "filosofía de descuentos",
  "productosDescuento": [
    {
      "nombre": "nombre del producto",
      "descuentoSugerido": "X%",
      "precioFinal": número,
      "justificacion": "por qué este %",
      "duracion": "X días/semanas"
    }
  ],
  "impactoEstimado": "proyección de resultados"
}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.6,
            max_tokens: 1200,
            response_format: { type: "json_object" }
        });

        const analisisIA = JSON.parse(completion.choices[0].message.content);

        return {
            success: true,
            totalProductosAnalizados: estrategias.length,
            datos: estrategias,
            analisisIA
        };

    } catch (error) {
        throw new Error('Error generando estrategia: ' + error.message);
    }
};

// ========================================
// 9. CHAT INTELIGENTE (INNOVADORA)
// ========================================
const consultaChatInteligente = async (pregunta, contexto = {}) => {
    try {
        // Obtener contexto del negocio
        const totalProductos = await Producto.countDocuments({ activo: true });
        const totalVentas = await Venta.countDocuments({ estadoVenta: 'Completada' });
        const sucursales = await Sucursal.find({ activo: true }).select('nombre ciudad');

        const contextoBD = {
            totalProductos,
            totalVentas,
            sucursales: sucursales.map(s => ({ nombre: s.nombre, ciudad: s.ciudad })),
            categorias: ['ABRIGO', 'BERMUDA', 'BUZOS', 'CAMISAS', 'FALDA', 'JEANS TERMINADOS', 'PANTALONES', 'VESTIDOS'],
            generos: ['Mujer', 'Hombre', 'Niño', 'Niña']
        };

        // Análisis IA conversacional
        const prompt = `
Eres un asistente virtual experto en retail de ropa. Tienes acceso a esta información del negocio:

CONTEXTO DEL NEGOCIO:
${JSON.stringify(contextoBD, null, 2)}

INFORMACIÓN ADICIONAL DEL USUARIO:
${JSON.stringify(contexto, null, 2)}

PREGUNTA DEL USUARIO:
"${pregunta}"

Responde de manera conversacional pero profesional. Si la pregunta requiere datos específicos que no tienes, 
sugiere qué endpoint de API usar o qué análisis realizar.

Responde SOLO en formato JSON válido:
{
  "respuesta": "respuesta natural y conversacional",
  "datosRelevantes": "datos numéricos si aplica",
  "sugerenciasAccion": ["acción 1 si aplica", "acción 2"],
  "endpointSugerido": "ruta API para más detalles si aplica"
}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "Eres un asistente comercial experto en retail. Respondes en español de manera clara y accionable."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.8,
            max_tokens: 800,
            response_format: { type: "json_object" }
        });

        const respuestaIA = JSON.parse(completion.choices[0].message.content);

        return {
            success: true,
            pregunta,
            respuestaIA
        };

    } catch (error) {
        throw new Error('Error en chat inteligente: ' + error.message);
    }
};

module.exports = {
    analizarRotacionProductos,
    identificarSobreStock,
    generarReabastecimientoInteligente,
    compararSucursales,
    analizarTendenciasMensuales,
    analizarSegmentacionGeneroTalla,
    generarDashboardEjecutivo,
    generarEstrategiaDescuentos,
    consultaChatInteligente
};