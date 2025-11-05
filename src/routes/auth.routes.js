const express = require('express');
const router = express.Router();
const {
    registrarUsuario,
    loginUsuario,
    obtenerPerfil,
    actualizarPerfil
} = require('../controllers/auth.controller');
const { protegerRuta } = require('../middlewares/auth.middleware');

// Rutas públicas (sin autenticación)
router.post('/registro', registrarUsuario);
router.post('/login', loginUsuario);

// Rutas protegidas (requieren autenticación)
router.get('/perfil', protegerRuta, obtenerPerfil);
router.put('/perfil', protegerRuta, actualizarPerfil);

module.exports = router;