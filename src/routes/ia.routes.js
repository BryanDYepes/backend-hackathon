// routes/ia.routes.js
const express = require('express');
const router = express.Router();
const {
    obtenerRotacionProductos,
    obtenerSobreStock,
    obtenerReabastecimientoInteligente,
    obtenerComparativoSucursales,
    obtenerTendenciasMensuales,
    obtenerSegmentacionGeneroTalla,
    obtenerDashboardEjecutivo,
    obtenerEstrategiaDescuentos,
    procesarChatInteligente
} = require('../controllers/ia.controller');

// Middleware de autenticación (ajustar según tu implementación)
// const { proteger, autorizarRoles } = require('../middleware/auth.middleware');

// ========================================
// RUTAS CRÍTICAS (INDISPENSABLES)
// ========================================

// 1. Análisis de rotación de inventario
router.post('/rotacion-productos', obtenerRotacionProductos);

// 2. Identificación de sobre-stock
router.post('/sobre-stock', obtenerSobreStock);

// 3. Reabastecimiento inteligente
router.post('/reabastecimiento-inteligente', obtenerReabastecimientoInteligente);

// 4. Comparativo entre sucursales
router.post('/comparativo-sucursales', obtenerComparativoSucursales);

// 5. Análisis de tendencias mensuales
router.post('/tendencias-mensuales', obtenerTendenciasMensuales);

// 6. Segmentación por género y talla
router.post('/segmentacion-genero-talla', obtenerSegmentacionGeneroTalla);

// 7. Dashboard ejecutivo
router.post('/dashboard-ejecutivo', obtenerDashboardEjecutivo);

// ========================================
// RUTAS INNOVADORAS (WOW FACTOR)
// ========================================

// 8. Estrategia dinámica de descuentos
router.post('/estrategia-descuentos', obtenerEstrategiaDescuentos);

// 9. Chatbot inteligente
router.post('/chat-inteligente', procesarChatInteligente);

// ========================================
// RUTAS PROTEGIDAS (DESCOMENTAR EN PRODUCCIÓN)
// ========================================

// router.post('/rotacion-productos', proteger, autorizarRoles('admin', 'gerente'), obtenerRotacionProductos);
// router.post('/sobre-stock', proteger, autorizarRoles('admin', 'gerente'), obtenerSobreStock);
// router.post('/reabastecimiento-inteligente', proteger, autorizarRoles('admin', 'gerente'), obtenerReabastecimientoInteligente);
// router.post('/comparativo-sucursales', proteger, autorizarRoles('admin'), obtenerComparativoSucursales);
// router.post('/tendencias-mensuales', proteger, obtenerTendenciasMensuales);
// router.post('/segmentacion-genero-talla', proteger, obtenerSegmentacionGeneroTalla);
// router.post('/dashboard-ejecutivo', proteger, autorizarRoles('admin', 'gerente'), obtenerDashboardEjecutivo);
// router.post('/estrategia-descuentos', proteger, autorizarRoles('admin', 'gerente'), obtenerEstrategiaDescuentos);
// router.post('/chat-inteligente', proteger, procesarChatInteligente);

module.exports = router;