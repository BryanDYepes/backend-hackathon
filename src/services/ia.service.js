// services/ia.service.js
const mongoose = require('mongoose');
const openai = require('../utils/openaiClient');
const Venta = require('../models/Venta.model');
const Producto = require('../models/Producto.model');
const Sucursal = require('../models/Sucursal.model');

const MovimientoInventario = require('../models/MovimientoInventario.model');

// 1. ROTACIÓN DE PRODUCTOS t
const analizarRotacionProductos = async (fechaInicio, fechaFin, sucursal = null) => {
    try {
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);
        const diasPeriodo = Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24));

        const filtroVentas = {
            estadoVenta: 'Completada',
            fecha: { $gte: inicio, $lte: fin }
        };

        if (sucursal) {
            if (mongoose.Types.ObjectId.isValid(sucursal)) {
                filtroVentas.sucursal = sucursal;
            } else {
                const sucursalDoc = await Sucursal.findOne({ nombre: sucursal });
                if (sucursalDoc) {
                    filtroVentas.sucursal = sucursalDoc._id;
                }
            }
        }

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

        // Validar que haya datos antes de continuar
        if (rotacion.length === 0) {
            return {
                success: false,
                mensaje: 'No se encontraron ventas en el período especificado',
                periodo: {
                    inicio: inicio.toLocaleDateString('es-CO'),
                    fin: fin.toLocaleDateString('es-CO'),
                    dias: diasPeriodo
                },
                estadisticas: {
                    totalProductosAnalizados: 0,
                    altaRotacion: 0,
                    mediaRotacion: 0,
                    bajaRotacion: 0
                },
                datos: [],
                analisisIA: null
            };
        }

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

        // Análisis con IA SOLO si hay datos
        const top10 = datosLimpios.slice(0, 10);
        const bottom10 = datosLimpios.slice(-10);

        const prompt = `
Eres un analista retail experto. Analiza la rotación de inventario de una tienda de ropa.

IMPORTANTE: Analiza ÚNICAMENTE los productos proporcionados. NO inventes productos que no están en los datos.

TOP ${top10.length} PRODUCTOS DE ALTA ROTACIÓN:
${JSON.stringify(top10, null, 2)}

BOTTOM ${bottom10.length} PRODUCTOS DE BAJA ROTACIÓN:
${JSON.stringify(bottom10, null, 2)}

Responde SOLO en formato JSON válido usando los nombres EXACTOS de los productos proporcionados:
{
  "resumenGeneral": "análisis ejecutivo en 2-3 líneas basado en los datos reales",
  "productosExitosos": ["usar nombres EXACTOS de top10"],
  "productosProblemáticos": ["usar nombres EXACTOS de bottom10"],
  "recomendacionesAccion": [
    "acción específica basada en las categorías y datos reales",
    "acción específica 2",
    "acción específica 3"
  ],
  "alertasCriticas": ["alertas basadas en los índices de rotación reales o dejar vacío si no aplica"]
}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
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

// 2. SOBRE-STOCK t
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

const generarReabastecimientoInteligente = async (body) => {
    try {
        const { diasProyeccion = 30, sucursal = null, fechaInicio, fechaFin } = body;

        let fechaInicioFiltro = fechaInicio ? new Date(fechaInicio) : new Date();
        if (!fechaInicio) fechaInicioFiltro.setDate(fechaInicioFiltro.getDate() - 90);

        let fechaFinFiltro = fechaFin ? new Date(fechaFin) : new Date();

        let sucursalCodigo = sucursal;

        // Si envían ObjectId, convertir a código
        if (sucursal && mongoose.Types.ObjectId.isValid(sucursal)) {
            const dataSucursal = await Sucursal.findById(sucursal);
            if (!dataSucursal) throw new Error("Sucursal no encontrada");
            sucursalCodigo = dataSucursal.codigo;
        }

        const filtroProductos = { activo: true };
        if (sucursalCodigo) filtroProductos.sucursal = sucursalCodigo;

        const productos = await Producto.find(filtroProductos);
        const alertas = [];

        for (const producto of productos) {

            //  Buscar ventas por ObjectId o por código de producto
            const ventasRecientes = await Venta.aggregate([
                {
                    $match: {
                        estadoVenta: "Completada",
                        ...(sucursalCodigo && { sucursal: sucursalCodigo }),
                        fecha: { $gte: fechaInicioFiltro, $lte: fechaFinFiltro }
                    }
                },
                { $unwind: "$items" },
                {
                    $match: {
                        $or: [
                            { "items.producto": producto._id },          // si es ObjectId
                            { "items.codigoProducto": producto.codigo } // si es código
                        ]
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalVendido: { $sum: "$items.cantidad" }
                    }
                }
            ]);

            const totalVendido = ventasRecientes[0]?.totalVendido || 0;

            const diasPeriodo = (fechaFinFiltro - fechaInicioFiltro) / (1000 * 60 * 60 * 24) || 90;
            const promedioDiario = totalVendido / diasPeriodo;
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
                    prioridad: diasStock < 7 ? "CRÍTICO" : diasStock < 15 ? "ALTO" : "MEDIO"
                });
            }
        }

        const ordenado = alertas.sort((a, b) => a.diasStockDisponible - b.diasStockDisponible);

        // si no hay datos, retornar directo (sin llamar IA)
        if (ordenado.length === 0) {
            return {
                success: true,
                sucursal: sucursalCodigo,
                proyeccion: `${diasProyeccion} días`,
                totalAlertas: 0,
                inversionTotal: 0,
                datos: [],
                analisisIA: {
                    resumenSituacion: "No se requieren compras.",
                    productosCriticos: [],
                    planCompras: "No se requiere estrategia de compras.",
                    inversionRequeridaCOP: 0,
                    recomendacionesEspecificas: []
                }
            };
        }

        // Llamado a IA 
        const prompt = `
Actúa como un Chief Supply Chain & Merchandising Officer experto en retail de moda en LATAM, 
especializado en optimización de inventario, rotación de mercancía y planificación de demanda.

Objetivo: generar análisis estratégico y plan de reabastecimiento basado EXCLUSIVAMENTE en los datos entregados.

Contexto del negocio:
- Industria: Retail de moda
- País: Colombia
- Objetivo principal: asegurar disponibilidad sin sobreinventarios
- Horizonte de análisis: planificación basada en rotación y cobertura de inventario futura
- Métricas clave: rotación, días de inventario, nivel de servicio, inversión requerida

REGLAS CRÍTICAS:
1. NO inventes productos ni datos.
2. Usa únicamente los productos entregados.
3. Sé analítico, profesional y directo.
4. Lenguaje corporativo, no académico.
5. Responde en COP para valores económicos.
6. Si no hay productos críticos → responde estrategia preventiva, no “nada que hacer”.
7. Foco: priorización, inversión inteligente, abastecimiento estratégico.

Datos para analizar (top 20):
${JSON.stringify(ordenado.slice(0, 20), null, 2)}

Entrega respuesta SOLO en JSON válido con esta estructura:

{
  "diagnostico": "visión ejecutiva del estado actual del inventario",
  "alertasClave": [
    "resaltar puntos críticos o confirmación de estabilidad"
  ],
  "productosPrioritarios": [
    {
      "producto": "nombre exacto",
      "nivelRiesgo": "Crítico | Alto | Medio",
      "diasStockActual": number,
      "unidadesSugeridas": number,
      "racional": "por qué es prioritario"
    }
  ],
  "planAbastecimiento": {
    "estrategia": "plan de acción detallado y profesional",
    "prioridadesCompra": "criterios de decisión",
    "inversionRequeridaCOP": number,
    "horizonteCoberturaDias": number
  },
  "recomendacionesTacticas": [
    "acciones de corto plazo",
    "optimización operativa",
    "sugerencias comerciales si aplica"
  ],
  "recomendacionesEstrategicas": [
    "prácticas de supply chain",
    "gestión de surtido",
    "mejora en pronósticos y rotación"
  ]
}
`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });

        const analisisIA = JSON.parse(completion.choices[0].message.content);

        return {
            success: true,
            sucursal: sucursalCodigo,
            proyeccion: `${diasProyeccion} días`,
            totalAlertas: ordenado.length,
            inversionTotal: ordenado.reduce((s, a) => s + a.costoReabastecimiento, 0),
            datos: ordenado,
            analisisIA
        };
    } catch (error) {
        throw new Error('Error generando reabastecimiento inteligente: ' + error.message);
    }
};

// 4. COMPARATIVO SUCURSALES t
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
            {
                $lookup: {
                    from: 'sucursals', // Verifica este nombre en tu MongoDB
                    localField: '_id',
                    foreignField: '_id',
                    as: 'infoSucursal'
                }
            },
            {
                $unwind: {
                    path: '$infoSucursal',
                    preserveNullAndEmptyArrays: true
                }
            },
            { $sort: { totalIngresos: -1 } }
        ]);

        // Si no hay ventas, obtener todas las sucursales activas
        let analisisCompleto;

        if (ventasPorSucursal.length === 0) {
            // No hay ventas en el periodo, pero mostramos todas las sucursales
            const todasSucursales = await Sucursal.find({ estado: 'Activa' });

            analisisCompleto = await Promise.all(
                todasSucursales.map(async (sucursal) => {
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
                        idSucursal: sucursal._id,
                        codigoSucursal: sucursal.codigo,
                        nombreSucursal: sucursal.nombre,
                        ciudad: sucursal.direccion?.ciudad || 'N/A',
                        direccionCompleta: sucursal.direccion?.direccion || 'N/A',
                        telefono: sucursal.contacto?.telefono || 'N/A',
                        gerente: sucursal.nombreGerente || 'Sin gerente asignado',
                        totalVentas: 0,
                        totalIngresos: 0,
                        promedioVenta: 0,
                        totalProductos,
                        valorInventario: parseFloat((valorInventario[0]?.valor || 0).toFixed(2)),
                        estado: sucursal.estado,
                        fechaApertura: sucursal.fechaApertura
                    };
                })
            );
        } else {
            // Hay ventas, procesamos normalmente
            analisisCompleto = await Promise.all(
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
                        idSucursal: sucursal._id,
                        codigoSucursal: sucursal.infoSucursal?.codigo || 'N/A',
                        nombreSucursal: sucursal.infoSucursal?.nombre || 'Sucursal sin nombre',
                        ciudad: sucursal.infoSucursal?.direccion?.ciudad || 'N/A',
                        direccionCompleta: sucursal.infoSucursal?.direccion?.direccion || 'N/A',
                        telefono: sucursal.infoSucursal?.contacto?.telefono || 'N/A',
                        gerente: sucursal.infoSucursal?.nombreGerente || 'Sin gerente asignado',
                        totalVentas: sucursal.totalVentas,
                        totalIngresos: parseFloat(sucursal.totalIngresos.toFixed(2)),
                        promedioVenta: parseFloat(sucursal.promedioVenta.toFixed(2)),
                        totalProductos,
                        valorInventario: parseFloat((valorInventario[0]?.valor || 0).toFixed(2)),
                        estado: sucursal.infoSucursal?.estado || 'N/A',
                        fechaApertura: sucursal.infoSucursal?.fechaApertura
                    };
                })
            );
        }

        // Análisis IA con datos reales
        const prompt = `
Eres un consultor retail especializado en análisis de sucursales y expansión comercial. 

DATOS REALES de las sucursales en el periodo analizado:

${JSON.stringify(analisisCompleto, null, 2)}

INSTRUCCIONES CRÍTICAS:
1. USA ÚNICAMENTE los nombres EXACTOS de las sucursales que aparecen en los datos
2. NO inventes nombres, ciudades o datos que no estén en la información proporcionada
3. Si no hay ventas (totalVentas = 0), enfócate en análisis de inventario y capacidad instalada

Proporciona un análisis estratégico en formato JSON válido:

{
  "mejorSucursal": {
    "nombre": "nombre EXACTO de la sucursal con mejor rendimiento",
    "codigo": "código de la sucursal",
    "ciudad": "ciudad real",
    "razon": "análisis basado en los datos reales: ventas, ingresos, inventario"
  },
  "sucursalesRiesgo": [
    {
      "nombre": "nombre EXACTO de sucursal",
      "codigo": "código",
      "ciudad": "ciudad real",
      "problemas": "problemas identificados en los datos reales",
      "recomendacion": "acciones específicas"
    }
  ],
  "oportunidadesExpansion": {
    "ciudadesRecomendadas": ["basado en ciudades actuales"],
    "justificacion": "análisis del rendimiento actual"
  },
  "estrategiaRedistribucion": {
    "desde": "nombre EXACTO de sucursal con datos",
    "hacia": "nombre EXACTO de sucursal con datos",
    "razonamiento": "basado en inventario y ventas reales"
  },
  "kpisDestacados": [
    "KPI con datos numéricos reales de las sucursales",
    "KPI con nombres exactos de sucursales",
    "KPI con métricas reales del periodo"
  ],
  "recomendacionGeneral": "consejo basado en los datos reales proporcionados"
}

IMPORTANTE: Si totalVentas es 0 para todas las sucursales, indica que no hubo ventas en el periodo y enfócate en análisis de inventario.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.5, // Reducido para respuestas más precisas
            max_tokens: 1500,
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

// 5. TENDENCIAS MENSUALES
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
Eres un analista experto en retail y moda. Analiza SOLO estos datos reales de ventas mensuales por categoría:

${JSON.stringify(ventasMensuales, null, 2)}

IMPORTANTE:
- No inventes tendencias globales ni estacionales externas.
- NO menciones festividades o temporadas si no están en los datos.
- Extrae patrones basados EXCLUSIVAMENTE en el comportamiento matemático observado.
- Si el histórico es corto o no hay evidencia, dilo.

Devuelve SOLO JSON con este formato:

{
  "patronesEstacionales": "Describe cambios reales mes a mes, sin suponer temporadas externas",
  "categoriasMasVendidas": ["3 con mayores cantidades"],
  "prediccionProximos3Meses": "Predicción basada en tendencia matematicamente visible. Si no se puede, indica que no hay suficiente histórico",
  "recomendacionesCompra": ["Basadas en lo observado, no en suposiciones"],
  "alertasTendencias": ["Advertencias por caídas reales o low performance"]
}
`;


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

// 6. SEGMENTACIÓN GÉNERO Y TALLA t
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

// 7. DASHBOARD EJECUTIVO
const generarDashboardEjecutivo = async (fechaInicio, fechaFin, sucursal = null) => {
    try {
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);

        const filtros = {
            estadoVenta: "Completada",
            fecha: { $gte: inicio, $lte: fin }
        };

        if (sucursal) filtros.sucursal = sucursal;

        console.log(" Filtros aplicados dashboard:", filtros);


        console.log("Filtros aplicados dashboard:", filtros);

        // PIs principales
        const estadisticas = await Venta.aggregate([
            { $match: filtros },
            {
                $group: {
                    _id: null,
                    totalVentas: { $sum: 1 },
                    totalIngresos: { $sum: "$total" },
                    promedioVenta: { $avg: "$total" }
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
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.nombreProducto",
                    cantidadVendida: { $sum: "$items.cantidad" }
                }
            },
            { $sort: { cantidadVendida: -1 } },
            { $limit: 5 }
        ]);

        const kpis = {
            totalVentas: estadisticas[0]?.totalVentas || 0,
            totalIngresos: estadisticas[0]?.totalIngresos || 0,
            promedioVenta: parseFloat(estadisticas[0]?.promedioVenta?.toFixed(2)) || 0,
            productosBajoStock,
            top5Productos
        };


     const prompt = `
Actúa como un Director Comercial Senior de una empresa retail en Colombia.
Tu objetivo es elaborar un análisis ejecutivo con base en los siguientes KPIs:

${JSON.stringify(kpis, null, 2)}

Instrucciones y estilo:
- El contexto es empresarial colombiano: usa valores monetarios expresados en pesos (COP), con el formato $1.234.567,00.
- Si totalVentas = 0 o totalIngresos = 0, indica de forma clara y formal que no hubo actividad comercial en el período analizado.
- Evita suposiciones o invenciones: analiza únicamente los datos entregados.
- Escribe de forma precisa, profesional y enfocada en la toma de decisiones gerenciales.
- Destaca cifras clave, variaciones relevantes y oportunidades o riesgos.
- No incluyas texto adicional fuera del JSON.

Tu respuesta DEBE ser SOLO un JSON válido con la siguiente estructura:
{
  "resumenEjecutivo": "Síntesis de máximo 4 líneas con una visión general del desempeño comercial.",
  "indicadoresDestacados": [
    "Indicador 1 con su valor en COP o porcentaje y una breve interpretación.",
    "Indicador 2...",
    "Indicador 3..."
  ],
  "alertasPrioritarias": [
    "Riesgos detectados o señales de atención inmediata."
  ],
  "accionesInmediatas": [
    "Acción ejecutiva sugerida, orientada a resultados medibles."
  ],
  "proyeccionSemanal": "Proyección corta en tono estratégico, con visión de próxima semana."
}
`;


        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.4,
            max_tokens: 900,
            response_format: { type: "json_object" }
        });

        const analisisIA = JSON.parse(completion.choices[0].message.content);

        return {
            success: true,
            periodo: {
                inicio: inicio.toLocaleDateString("es-CO"),
                fin: fin.toLocaleDateString("es-CO")
            },
            kpis,
            analisisIA
        };

    } catch (error) {
        console.error("Error Dashboard:", error);
        throw new Error("Error generando dashboard: " + error.message);
    }
};

// 8. ESTRATEGIA DE DESCUENTOS 
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
Actúa como un experto en pricing dinámico y optimización de inventario.

Tienes una lista REAL de productos con:
- margen actual
- días sin vender
- stock
- precio compra y venta

DEBES utilizar EXCLUSIVAMENTE los datos proporcionados a continuación.
No inventes datos, no agregues productos que no existan, no modifiques campos.

DATOS REALES:
${JSON.stringify(estrategias, null, 2)}

Tu tarea:
- Definir una estrategia óptima de descuento por producto
- Basarte en márgenes reales, días sin vender y valor inmovilizado
- Evitar descuentos que generen pérdida
- Priorizar liquidar inventario lento

Reglas estrictas:
- Si el margen < 10%, máximo 5% de descuento
- Si el margen está entre 10% y 25%, máximo 10% de descuento
- Si el producto tiene > 30 días sin vender, puedes aumentar hasta 15%
- NO inventes valores, NO alucines
- Usa los nombres EXACTOS de los productos

FORMATO DE RESPUESTA (obligatorio JSON válido):
{
  "estrategiaGeneral": "texto corto explicando el enfoque",
  "productosDescuento": [
    {
      "nombre": "nombre exacto",
      "descuentoSugerido": "X%",
      "precioFinal": numero,
      "justificacion": "razón concreta basada en los datos entregados",
      "duracion": "X días"
    }
  ],
  "impactoEstimado": "breve previsión de rotación e ingreso"
}

Si no tienes suficientes datos para recomendar un descuento concreto en algún producto,
respóndelo claramente y sugiere una acción alternativa (ej: revisar precio base o rotación).
`;


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

// 9. CONSULTA CHAT INTELIGENTE
const consultaChatInteligente = async (pregunta, contexto = {}) => {
  try {
    if (!pregunta || typeof pregunta !== "string") {
      throw new Error("Debe enviar una pregunta válida en texto.");
    }

    // 🔹 Obtener información real desde la BD
    const [totalProductos, totalVentas, productos, ventas, sucursales] = await Promise.all([
      Producto.countDocuments({ activo: true }),
      Venta.countDocuments({ estadoVenta: "Completada" }),
      Producto.find({ activo: true }).select("categoria genero talla stock precio"),
      Venta.find({ estadoVenta: "Completada" }).select("fecha total items"),
      Sucursal.find({ estado: "Activa" }).select("nombre ciudad codigo")
    ]);

    // Construir contexto real del negocio
    const categorias = [...new Set(productos.map(p => p.categoria).filter(Boolean))];
    const generos = [...new Set(productos.map(p => p.genero).filter(Boolean))];
    const tallas = [...new Set(productos.map(p => p.talla).filter(Boolean))];

    //Resumen de inventario y ventas
    const totalStock = productos.reduce((acc, p) => acc + (p.stock || 0), 0);
    const ingresosTotales = ventas.reduce((acc, v) => acc + (v.total || 0), 0);

    const contextoBD = {
      resumen: {
        totalProductos,
        totalVentas,
        totalStock,
        ingresosTotales,
        sucursalesActivas: sucursales.length
      },
      categorias,
      generos,
      tallas,
      sucursales: sucursales.map(s => ({
        nombre: s.nombre,
        ciudad: s.ciudad,
        codigo: s.codigo
      }))
    };

    // Normalizar contexto del usuario
    const contextoUsuario = (contexto && typeof contexto === "object") ? contexto : {};

    // Prompt profesional y ejecutivo
    const prompt = `
Actúas como un Analista Comercial Senior especializado en retail de moda. 
Usa ÚNICAMENTE la información provista del negocio (no inventes nada).
Tu objetivo es dar una respuesta profesional y ejecutiva, en pesos colombianos, con formato de miles (ej: 1.250.000).

DATOS DE LA EMPRESA:
${JSON.stringify(contextoBD, null, 2)}

INFORMACIÓN ADICIONAL DEL USUARIO:
${JSON.stringify(contextoUsuario, null, 2)}

PREGUNTA:
"${pregunta}"

Reglas:
- No inventes cifras ni categorías.
- Si falta data, dilo y sugiere el endpoint del API que podría dar esa información.
- Usa lenguaje claro, formal y orientado a decisiones.
- Los valores monetarios deben estar en pesos colombianos (COP) con puntos o comas.

Formato JSON obligatorio:
{
  "respuesta": "explicación conversacional y profesional",
  "datosRelevantes": "resumen ejecutivo con valores y unidades",
  "sugerenciasAccion": ["acción 1", "acción 2"],
  "endpointSugerido": "/api/ia/... o null"
}
`.trim();

    // Fallback por si la IA no responde
    let respuestaIA = {
      respuesta: "No fue posible obtener respuesta de la IA en este momento.",
      datosRelevantes: contextoBD.resumen,
      sugerenciasAccion: [
        "Verificar conexión con OpenAI o API key",
        "Intentar nuevamente más tarde"
      ],
      endpointSugerido: null
    };

    // Llamada a OpenAI
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Eres un consultor comercial senior experto en retail de moda. Hablas en español y usas cifras en pesos colombianos (COP)."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.6,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });

      const raw = completion?.choices?.[0]?.message?.content;
      if (raw) respuestaIA = JSON.parse(raw);
    } catch (err) {
      console.warn(" Error al consultar OpenAI:", err.message);
    }

    // Retornar respuesta completa
    return {
      success: true,
      pregunta,
      contextoUsado: contextoBD,
      respuestaIA
    };
  } catch (error) {
    throw new Error(`Error en chat inteligente: ${error.message}`);
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
