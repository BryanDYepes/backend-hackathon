const express = require('express');
const router = express.Router();
const {
    obtenerTendenciasVentas,
    obtenerProductosSobreStock,
    obtenerSugerenciasReabastecimiento,
    obtenerAnalisisRentabilidad,
    obtenerAnalisisHorarios
} = require('../controllers/analytics.controller');
const { protegerRuta, verificarRol } = require('../middlewares/auth.middleware');

// Todas las rutas requieren autenticación y rol admin o gerente
router.use(protegerRuta);
router.use(verificarRol('admin', 'gerente'));

router.get('/tendencias', obtenerTendenciasVentas);
router.get('/sobre-stock', obtenerProductosSobreStock);
router.get('/sugerencias-reabastecimiento', obtenerSugerenciasReabastecimiento);
router.get('/rentabilidad', obtenerAnalisisRentabilidad);
router.get('/horarios-pico', obtenerAnalisisHorarios);

module.exports = router;