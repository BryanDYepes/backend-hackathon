const {
    obtenerTendencias,
    identificarSobreStock,
    sugerirReabastecimiento,
    analizarRentabilidad,
    obtenerHorariosPico
} = require('../services/analytics.service');

// @desc    Obtener tendencias de ventas
// @route   GET /api/analytics/tendencias
// @access  Private (Admin/Gerente)
const obtenerTendenciasVentas = async (req, res) => {
    try {
        const { meses = 6 } = req.query;
        
        const tendencias = await obtenerTendencias(parseInt(meses));
        
        res.json({
            success: true,
            mensaje: 'Tendencias calculadas con promedio móvil de 3 meses',
            data: tendencias
        });
        
    } catch (error) {
        console.error('Error al obtener tendencias:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener tendencias',
            detalle: error.message
        });
    }
};

// @desc    Identificar productos con sobre-stock
// @route   GET /api/analytics/sobre-stock
// @access  Private (Admin/Gerente)
const obtenerProductosSobreStock = async (req, res) => {
    try {
        const { meses = 3 } = req.query;
        
        const productos = await identificarSobreStock(parseInt(meses));
        
        res.json({
            success: true,
            total: productos.length,
            mensaje: 'Productos con más de 6 meses de inventario',
            data: productos
        });
        
    } catch (error) {
        console.error('Error al identificar sobre-stock:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al identificar sobre-stock',
            detalle: error.message
        });
    }
};

// @desc    Obtener sugerencias de reabastecimiento
// @route   GET /api/analytics/sugerencias-reabastecimiento
// @access  Private (Admin/Gerente)
const obtenerSugerenciasReabastecimiento = async (req, res) => {
    try {
        const { dias = 30 } = req.query;
        
        const sugerencias = await sugerirReabastecimiento(parseInt(dias));
        
        res.json({
            success: true,
            total: sugerencias.length,
            mensaje: `Sugerencias basadas en proyección de ${dias} días`,
            data: sugerencias
        });
        
    } catch (error) {
        console.error('Error al generar sugerencias:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al generar sugerencias de reabastecimiento',
            detalle: error.message
        });
    }
};

// @desc    Obtener análisis de rentabilidad
// @route   GET /api/analytics/rentabilidad
// @access  Private (Admin/Gerente)
const obtenerAnalisisRentabilidad = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.query;
        
        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                error: true,
                mensaje: 'Debe proporcionar fechaInicio y fechaFin'
            });
        }
        
        const analisis = await analizarRentabilidad(fechaInicio, fechaFin);
        
        // Calcular totales
        const totales = analisis.reduce((acc, item) => ({
            totalIngresos: acc.totalIngresos + item.totalIngresos,
            totalCostos: acc.totalCostos + item.costoTotal,
            totalUtilidad: acc.totalUtilidad + item.utilidadBruta
        }), { totalIngresos: 0, totalCostos: 0, totalUtilidad: 0 });
        
        const margenGeneral = totales.totalIngresos > 0 
            ? ((totales.totalUtilidad / totales.totalIngresos) * 100).toFixed(2)
            : 0;
        
        res.json({
            success: true,
            periodo: {
                inicio: new Date(fechaInicio).toLocaleDateString('es-CO'),
                fin: new Date(fechaFin).toLocaleDateString('es-CO')
            },
            resumen: {
                ...totales,
                margenGeneralPorcentaje: parseFloat(margenGeneral)
            },
            data: analisis
        });
        
    } catch (error) {
        console.error('Error al analizar rentabilidad:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al analizar rentabilidad',
            detalle: error.message
        });
    }
};

// @desc    Obtener horarios pico de ventas
// @route   GET /api/analytics/horarios-pico
// @access  Private
const obtenerAnalisisHorarios = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.query;
        
        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                error: true,
                mensaje: 'Debe proporcionar fechaInicio y fechaFin'
            });
        }
        
        const horarios = await obtenerHorariosPico(fechaInicio, fechaFin);
        
        // Identificar los 3 horarios con más ventas
        const top3Horarios = [...horarios]
            .sort((a, b) => b.cantidadVentas - a.cantidadVentas)
            .slice(0, 3);
        
        res.json({
            success: true,
            periodo: {
                inicio: new Date(fechaInicio).toLocaleDateString('es-CO'),
                fin: new Date(fechaFin).toLocaleDateString('es-CO')
            },
            horariosPico: top3Horarios,
            todosLosHorarios: horarios
        });
        
    } catch (error) {
        console.error('Error al analizar horarios:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al analizar horarios',
            detalle: error.message
        });
    }
};

module.exports = {
    obtenerTendenciasVentas,
    obtenerProductosSobreStock,
    obtenerSugerenciasReabastecimiento,
    obtenerAnalisisRentabilidad,
    obtenerAnalisisHorarios
};