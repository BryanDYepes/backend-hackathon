const express = require('express');
const router = express.Router();
const {
    obtenerSucursales,
    obtenerSucursalPorId,
    obtenerSucursalPorCodigo,
    crearSucursal,
    actualizarSucursal,
    eliminarSucursal,
    obtenerEstadisticasSucursal,
    compararRendimiento
} = require('../controllers/sucursal.controller');
const { protegerRuta, verificarRol } = require('../middlewares/auth.middleware');

// Todas las rutas requieren autenticación
router.use(protegerRuta);

// Rutas de consulta (todos los usuarios autenticados)
router.get('/', obtenerSucursales);
router.get('/comparar-rendimiento', verificarRol('admin', 'gerente'), compararRendimiento);
router.get('/codigo/:codigo', obtenerSucursalPorCodigo);
router.get('/:id', obtenerSucursalPorId);
router.get('/:id/estadisticas', obtenerEstadisticasSucursal);

// Rutas de modificación (solo admin)
router.post('/', verificarRol('admin'), crearSucursal);
router.put('/:id', verificarRol('admin'), actualizarSucursal);
router.delete('/:id', verificarRol('admin'), eliminarSucursal);

module.exports = router;