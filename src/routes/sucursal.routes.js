const express = require('express');
const router = express.Router();
const {
    obtenerSucursales,
    obtenerSucursalPorId,
    obtenerSucursalPorCodigo,
    crearSucursal,
    actualizarSucursal,
    eliminarSucursal,
    obtenerEstadisticas,
    obtenerCiudades,
    obtenerComparativo,
    actualizarEstadisticasSucursal
} = require('../controllers/sucursal.controller');
const { protegerRuta, verificarRol } = require('../middlewares/auth.middleware');

// Todas las rutas requieren autenticación
router.use(protegerRuta);

// Rutas accesibles para todos los usuarios autenticados
router.get('/', obtenerSucursales);
router.get('/ciudades/listado', obtenerCiudades);
router.get('/codigo/:codigo', obtenerSucursalPorCodigo);
router.get('/:id', obtenerSucursalPorId);
router.get('/:id/estadisticas', obtenerEstadisticas);

// Rutas para admin y gerente
router.get('/comparativo', verificarRol('admin', 'gerente'), obtenerComparativo);
router.patch('/:id/actualizar-estadisticas', verificarRol('admin', 'gerente'), actualizarEstadisticasSucursal);

// Rutas de modificación (solo admin y gerente)
router.post('/', verificarRol('admin', 'gerente'), crearSucursal);
router.put('/:id', verificarRol('admin', 'gerente'), actualizarSucursal);

// Ruta solo para admin
router.delete('/:id', verificarRol('admin'), eliminarSucursal);

module.exports = router;