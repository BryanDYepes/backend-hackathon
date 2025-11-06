const express = require('express');
const router = express.Router();
const {
    registrarEntrada,
    registrarSalida,
    registrarAjuste,
    registrarTransferencia,
    registrarMerma,
    obtenerMovimientos,
    obtenerMovimientosProducto,
    obtenerValoracionInventario
} = require('../controllers/inventario.controller');
const { protegerRuta, verificarRol } = require('../middlewares/auth.middleware');

const {
    obtenerResumen,
    obtenerProductosActivos,
    obtenerDiscrepancias,
    obtenerIndiceRotacion,
    obtenerAnalisisABC
} = require('../controllers/inventario-avanzado.controller');

// Todas las rutas requieren autenticación
router.use(protegerRuta);

// Rutas de consulta (todos los usuarios autenticados)
router.get('/movimientos', obtenerMovimientos);
router.get('/movimientos/producto/:productoId', obtenerMovimientosProducto);
router.get('/valoracion', verificarRol('admin', 'gerente'), obtenerValoracionInventario);

// Rutas de modificación (solo admin y gerente)
router.post('/entrada', verificarRol('admin', 'gerente'), registrarEntrada);
router.post('/salida', verificarRol('admin', 'gerente'), registrarSalida);
router.post('/ajuste', verificarRol('admin', 'gerente'), registrarAjuste);
router.post('/transferencia', verificarRol('admin', 'gerente'), registrarTransferencia);
router.post('/merma', verificarRol('admin', 'gerente'), registrarMerma);

// Rutas de análisis avanzado (solo admin y gerente)
router.get('/resumen-movimientos', verificarRol('admin', 'gerente'), obtenerResumen);
router.get('/productos-mas-movimientos', verificarRol('admin', 'gerente'), obtenerProductosActivos);
router.get('/discrepancias', verificarRol('admin', 'gerente'), obtenerDiscrepancias);
router.get('/indice-rotacion', verificarRol('admin', 'gerente'), obtenerIndiceRotacion);
router.get('/analisis-abc', verificarRol('admin', 'gerente'), obtenerAnalisisABC);

module.exports = router;