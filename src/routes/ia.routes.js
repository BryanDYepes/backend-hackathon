// routes/ia.routes.js
const express = require('express');
const router = express.Router();
const {
    obtenerRotacionProductos,
    obtenerSobreStock,
    obtenerReabastecimientoInteligente,
    obtenerComparativoSucursales,
    //obtenercompararSucursales,
    obtenerTendenciasMensuales,
    obtenerSegmentacionGeneroTalla,
    obtenerDashboardEjecutivo,
    obtenerEstrategiaDescuentos,
    procesarChatInteligente
} = require('../controllers/ia.controller');

// const { proteger, autorizarRoles } = require('../middleware/auth.middleware');

// RUTAS CRÍTICAS (INDISPENSABLES)

// 1. Análisis de rotación de inventario t
router.post('/rotacion-productos', obtenerRotacionProductos);

// 2. Identificación de sobre-stock t
router.post('/sobre-stock', obtenerSobreStock);

// 3. Reabastecimiento inteligente t
router.post('/reabastecimiento-inteligente', obtenerReabastecimientoInteligente);

// 4. Comparativo entre sucursales t
router.post('/comparativo-sucursales', obtenerComparativoSucursales,);

// 5. Análisis de tendencias mensuales t 
router.post('/tendencias-mensuales', obtenerTendenciasMensuales);

// 6. Segmentación por género y talla t 
router.post('/segmentacion-genero-talla', obtenerSegmentacionGeneroTalla);

// 7. Dashboard ejecutivott
router.post('/dashboard-ejecutivo', obtenerDashboardEjecutivo);

// RUTAS INNOVADORAS (WOW FACTOR)

// 8. Estrategia dinámica de descuentos
router.post('/estrategia-descuentos', obtenerEstrategiaDescuentos);

// 9. Chatbot inteligente
router.post('/chat-inteligente', procesarChatInteligente);

// RUTAS PROTEGIDAS (DESCOMENTAR EN PRODUCCIÓN)

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