const {
    obtenerResumenMovimientos,
    obtenerProductosConMasMovimientos,
    detectarDiscrepancias,
    calcularIndiceRotacion,
    analisisABC
} = require('../services/inventario.service');

// @desc    Obtener resumen de movimientos por tipo
// @route   GET /api/inventario/resumen-movimientos
// @access  Private (Admin/Gerente)
const obtenerResumen = async (req, res) => {
    try {
        const { fechaInicio, fechaFin, sucursal } = req.query;
        
        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                error: true,
                mensaje: 'Debe proporcionar fechaInicio y fechaFin'
            });
        }
        
        const resumen = await obtenerResumenMovimientos(fechaInicio, fechaFin, sucursal);
        
        // Calcular totales
        const totales = resumen.reduce((acc, item) => ({
            totalMovimientos: acc.totalMovimientos + item.numeroMovimientos,
            totalCantidad: acc.totalCantidad + item.cantidad,
            totalValor: acc.totalValor + item.valorTotal
        }), { totalMovimientos: 0, totalCantidad: 0, totalValor: 0 });
        
        res.json({
            success: true,
            periodo: {
                inicio: new Date(fechaInicio).toLocaleDateString('es-CO'),
                fin: new Date(fechaFin).toLocaleDateString('es-CO')
            },
            totales,
            detalles: resumen
        });
        
    } catch (error) {
        console.error('Error al obtener resumen:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener resumen de movimientos',
            detalle: error.message
        });
    }
};

// @desc    Obtener productos con más movimientos
// @route   GET /api/inventario/productos-mas-movimientos
// @access  Private (Admin/Gerente)
const obtenerProductosActivos = async (req, res) => {
    try {
        const { fechaInicio, fechaFin, limite = 20 } = req.query;
        
        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                error: true,
                mensaje: 'Debe proporcionar fechaInicio y fechaFin'
            });
        }
        
        const productos = await obtenerProductosConMasMovimientos(
            fechaInicio, 
            fechaFin, 
            parseInt(limite)
        );
        
        res.json({
            success: true,
            periodo: {
                inicio: new Date(fechaInicio).toLocaleDateString('es-CO'),
                fin: new Date(fechaFin).toLocaleDateString('es-CO')
            },
            data: productos
        });
        
    } catch (error) {
        console.error('Error al obtener productos activos:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener productos con más movimientos',
            detalle: error.message
        });
    }
};

// @desc    Detectar discrepancias en inventario
// @route   GET /api/inventario/discrepancias
// @access  Private (Admin/Gerente)
const obtenerDiscrepancias = async (req, res) => {
    try {
        const { sucursal } = req.query;
        
        const discrepancias = await detectarDiscrepancias(sucursal);
        
        res.json({
            success: true,
            total: discrepancias.length,
            mensaje: discrepancias.length > 0 
                ? 'Se encontraron discrepancias que requieren atención'
                : 'No se encontraron discrepancias',
            data: discrepancias
        });
        
    } catch (error) {
        console.error('Error al detectar discrepancias:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al detectar discrepancias',
            detalle: error.message
        });
    }
};

// @desc    Calcular índice de rotación
// @route   GET /api/inventario/indice-rotacion
// @access  Private (Admin/Gerente)
const obtenerIndiceRotacion = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.query;
        
        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                error: true,
                mensaje: 'Debe proporcionar fechaInicio y fechaFin'
            });
        }
        
        const rotacion = await calcularIndiceRotacion(fechaInicio, fechaFin);
        
        // Estadísticas generales
        const estadisticas = {
            altaRotacion: rotacion.filter(p => p.clasificacion === 'Alta rotación').length,
            mediaRotacion: rotacion.filter(p => p.clasificacion === 'Media rotación').length,
            bajaRotacion: rotacion.filter(p => p.clasificacion === 'Baja rotación').length,
            total: rotacion.length
        };
        
        res.json({
            success: true,
            periodo: {
                inicio: new Date(fechaInicio).toLocaleDateString('es-CO'),
                fin: new Date(fechaFin).toLocaleDateString('es-CO')
            },
            estadisticas,
            data: rotacion
        });
        
    } catch (error) {
        console.error('Error al calcular rotación:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al calcular índice de rotación',
            detalle: error.message
        });
    }
};

// @desc    Análisis ABC de inventario
// @route   GET /api/inventario/analisis-abc
// @access  Private (Admin/Gerente)
const obtenerAnalisisABC = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.query;
        
        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                error: true,
                mensaje: 'Debe proporcionar fechaInicio y fechaFin'
            });
        }
        
        const analisis = await analisisABC(fechaInicio, fechaFin);
        
        res.json({
            success: true,
            periodo: {
                inicio: new Date(fechaInicio).toLocaleDateString('es-CO'),
                fin: new Date(fechaFin).toLocaleDateString('es-CO')
            },
            resumen: {
                ...analisis.resumen,
                descripcion: {
                    A: 'Productos que representan el 80% del valor (alta prioridad)',
                    B: 'Productos que representan el 15% del valor (prioridad media)',
                    C: 'Productos que representan el 5% del valor (baja prioridad)'
                }
            },
            data: analisis.clasificacion
        });
        
    } catch (error) {
        console.error('Error en análisis ABC:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al realizar análisis ABC',
            detalle: error.message
        });
    }
};

module.exports = {
    obtenerResumen,
    obtenerProductosActivos,
    obtenerDiscrepancias,
    obtenerIndiceRotacion,
    obtenerAnalisisABC
};