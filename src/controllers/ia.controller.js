const {
    analizarRotacionProductos,
    identificarSobreStock,
    generarReabastecimientoInteligente,
    compararSucursales,
    analizarTendenciasMensuales,
    analizarSegmentacionGeneroTalla,
    generarDashboardEjecutivo,
    generarEstrategiaDescuentos,
    consultaChatInteligente
} = require('../services/ia.service');

// 1. ROTACIÓN DE PRODUCTOS
const obtenerRotacionProductos = async (req, res) => {
    try {
        const { fechaInicio, fechaFin, sucursal } = req.body;

        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                error: true,
                mensaje: 'Debe proporcionar fechaInicio y fechaFin en formato YYYY-MM-DD'
            });
        }

        const resultado = await analizarRotacionProductos(fechaInicio, fechaFin, sucursal);

        res.json(resultado);

    } catch (error) {
        console.error('Error en rotación:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al analizar rotación de productos',
            detalle: error.message
        });
    }
};


// 2. SOBRE-STOCK
const obtenerSobreStock = async (req, res) => {
    try {
        const { mesesHistorico = 6 } = req.body;

        const resultado = await identificarSobreStock(parseInt(mesesHistorico));

        res.json(resultado);

    } catch (error) {
        console.error('Error sobre-stock:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al identificar sobre-stock',
            detalle: error.message
        });
    }
};

// 3. REABASTECIMIENTO INTELIGENTE
const obtenerReabastecimientoInteligente = async (req, res) => {
    try {
        const { diasProyeccion = 30, sucursal } = req.body;

        const resultado = await generarReabastecimientoInteligente(parseInt(diasProyeccion), sucursal);

        res.json(resultado);

    } catch (error) {
        console.error('Error reabastecimiento:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al generar reabastecimiento inteligente',
            detalle: error.message
        });
    }
};

// 4. COMPARATIVO SUCURSALES
 const obtenerComparativoSucursales = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.body;

        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                error: true,
                mensaje: 'Debe proporcionar fechaInicio y fechaFin'
            });
        }

        const resultado = await compararSucursales(fechaInicio, fechaFin);

        res.json(resultado);

    } catch (error) {
        console.error('Error comparativo:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al comparar sucursales',
            detalle: error.message
        });
    }
};

// 5. TENDENCIAS MENSUALES
const obtenerTendenciasMensuales = async (req, res) => {
    try {
        const { mesesAtras = 12 } = req.body;

        const resultado = await analizarTendenciasMensuales(parseInt(mesesAtras));

        res.json(resultado);

    } catch (error) {
        console.error('Error tendencias:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al analizar tendencias mensuales',
            detalle: error.message
        });
    }
};

// 6. SEGMENTACIÓN GÉNERO Y TALLA
const obtenerSegmentacionGeneroTalla = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.body;

        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                error: true,
                mensaje: 'Debe proporcionar fechaInicio y fechaFin'
            });
        }

        const resultado = await analizarSegmentacionGeneroTalla(fechaInicio, fechaFin);

        res.json(resultado);

    } catch (error) {
        console.error('Error segmentación:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al analizar segmentación por género y talla',
            detalle: error.message
        });
    }
};

// 7. DASHBOARD EJECUTIVO
const obtenerDashboardEjecutivo = async (req, res) => {
    try {
        const { fechaInicio, fechaFin, sucursal } = req.body;

        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                error: true,
                mensaje: 'Debe proporcionar fechaInicio y fechaFin'
            });
        }

        const resultado = await generarDashboardEjecutivo(fechaInicio, fechaFin, sucursal);

        res.json(resultado);

    } catch (error) {
        console.error('Error dashboard:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al generar dashboard ejecutivo',
            detalle: error.message
        });
    }
};

// 8. ESTRATEGIA DE DESCUENTOS 
const obtenerEstrategiaDescuentos = async (req, res) => {
    try {
        const resultado = await generarEstrategiaDescuentos();

        res.json(resultado);

    } catch (error) {
        console.error('Error estrategia descuentos:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al generar estrategia de descuentos',
            detalle: error.message
        });
    }
};

// 9. CHAT INTELIGENTE 
const procesarChatInteligente = async (req, res) => {
    try {
        const { pregunta, contexto } = req.body;

        if (!pregunta) {
            return res.status(400).json({
                error: true,
                mensaje: 'Debe proporcionar una pregunta'
            });
        }

        const resultado = await consultaChatInteligente(pregunta, contexto || {});

        res.json(resultado);

    } catch (error) {
        console.error('Error chat:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error en chat inteligente',
            detalle: error.message
        });
    }
};

module.exports = {
    obtenerRotacionProductos,
    obtenerSobreStock,
    obtenerReabastecimientoInteligente,
    obtenerComparativoSucursales,
    obtenerTendenciasMensuales,
    obtenerSegmentacionGeneroTalla,
    obtenerDashboardEjecutivo,
    obtenerEstrategiaDescuentos,
    procesarChatInteligente,
    consultaChatInteligente
};