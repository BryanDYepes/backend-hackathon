const express = require('express');
const router = express.Router();
const {
    crearVenta,
    obtenerVentas,
    obtenerVentaPorId,
    obtenerVentaPorNumero,
    cancelarVenta,
    obtenerVentasDelDia,
    obtenerMisVentas
} = require('../controllers/venta.controller');
const { protegerRuta, verificarRol } = require('../middlewares/auth.middleware');

// Todas las rutas requieren autenticación
router.use(protegerRuta);

// Rutas de consulta
router.get('/', obtenerVentas);
router.get('/hoy', obtenerVentasDelDia);
router.get('/mis-ventas', obtenerMisVentas);
router.get('/numero/:numeroVenta', obtenerVentaPorNumero);
router.get('/:id', obtenerVentaPorId);

// Rutas de creación y modificación
router.post('/', crearVenta);
router.patch('/:id/cancelar', verificarRol('admin', 'gerente','vendedor'), cancelarVenta);

module.exports = router;