const express = require('express');
const router = express.Router();
const {
    obtenerProductos,
    obtenerProductoPorId,
    obtenerProductoPorCodigo,
    crearProducto,
    actualizarProducto,
    eliminarProducto,
    actualizarStock,
    obtenerProductosStockBajo,
    buscarProductos
} = require('../controllers/producto.controller');
const { protegerRuta, verificarRol } = require('../middlewares/auth.middleware');

// Todas las rutas requieren autenticación
router.use(protegerRuta);

// Rutas de consulta (cualquier usuario autenticado)
router.get('/', obtenerProductos);
router.get('/alertas/stock-bajo', obtenerProductosStockBajo);
router.get('/buscar/:termino', buscarProductos);
router.get('/codigo/:codigo', obtenerProductoPorCodigo);
router.get('/:id', obtenerProductoPorId);

// Rutas de modificación (solo admin y gerente)
router.post('/', verificarRol('admin', 'gerente'), crearProducto);
router.put('/:id', verificarRol('admin', 'gerente'), actualizarProducto);
router.patch('/:id/stock', actualizarStock); // Cualquier usuario puede actualizar stock
router.delete('/:id', verificarRol('admin'), eliminarProducto);

module.exports = router;