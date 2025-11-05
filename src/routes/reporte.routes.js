const express = require('express');
const router = express.Router();
const {
    obtenerDashboard,
    obtenerReporteVentas,
    obtenerReporteProductosMasVendidos,
    obtenerReporteRotacion,
    obtenerReportePorCategoria,
    obtenerReportePorGenero,
    obtenerReporteTallas,
    obtenerComparativo
} = require('../controllers/reporte.controller');
const { protegerRuta, verificarRol } = require('../middlewares/auth.middleware');

// Todas las rutas requieren autenticación
router.use(protegerRuta);

// Rutas accesibles para todos los usuarios autenticados
router.get('/dashboard', obtenerDashboard);
router.get('/productos-mas-vendidos', obtenerReporteProductosMasVendidos);
router.get('/por-categoria', obtenerReportePorCategoria);
router.get('/por-genero', obtenerReportePorGenero);
router.get('/tallas-mas-vendidas', obtenerReporteTallas);

// Rutas solo para admin y gerente
router.get('/ventas', verificarRol('admin', 'gerente'), obtenerReporteVentas);
router.get('/rotacion-inventario', verificarRol('admin', 'gerente'), obtenerReporteRotacion);
router.get('/comparativo', verificarRol('admin', 'gerente'), obtenerComparativo);

module.exports = router;