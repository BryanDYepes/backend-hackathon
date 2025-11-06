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

// Importar los middlewares con los nombres correctos
const { protegerRuta, verificarRol } = require('../middlewares/auth.middleware');

// RUTAS PROTEGIDAS

router.post(
    '/rotacion-productos',
    protegerRuta,
    verificarRol('admin', 'gerente'),
    obtenerRotacionProductos
);

router.post(
    '/sobre-stock',
    protegerRuta,
    verificarRol('admin', 'gerente'),
    obtenerSobreStock
);

router.post(
    '/reabastecimiento-inteligente',
    protegerRuta,
    verificarRol('admin', 'gerente'),
    obtenerReabastecimientoInteligente
);

router.post(
    '/comparativo-sucursales',
    protegerRuta,
    verificarRol('admin', 'gerente'),
    obtenerComparativoSucursales
);

router.post(
    '/tendencias-mensuales',
    protegerRuta,
    obtenerTendenciasMensuales
);

router.post(
    '/segmentacion-genero-talla',
    protegerRuta,
    obtenerSegmentacionGeneroTalla
);

router.post(
    '/dashboard-ejecutivo',
    protegerRuta,
    verificarRol('admin', 'gerente'),
    obtenerDashboardEjecutivo
);

router.post(
    '/estrategia-descuentos',
    protegerRuta,
    verificarRol('admin', 'gerente'),
    obtenerEstrategiaDescuentos
);

router.post(
    '/chat-inteligente',
    protegerRuta,
    procesarChatInteligente
);

module.exports = router;
