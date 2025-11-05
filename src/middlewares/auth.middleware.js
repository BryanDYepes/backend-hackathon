const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario.model');

// Middleware para proteger rutas
const protegerRuta = async (req, res, next) => {
    let token;
    
    // Verificar si el token viene en el header Authorization
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Obtener el token del header
            token = req.headers.authorization.split(' ')[1];
            
            // Verificar y decodificar el token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Buscar el usuario y agregarlo al request (sin password)
            req.usuario = await Usuario.findById(decoded.id).select('-password');
            
            if (!req.usuario) {
                return res.status(401).json({
                    error: true,
                    mensaje: 'Usuario no encontrado'
                });
            }
            
            // Verificar si el usuario está activo
            if (!req.usuario.activo) {
                return res.status(401).json({
                    error: true,
                    mensaje: 'Usuario inactivo. Contacte al administrador'
                });
            }
            
            next();
            
        } catch (error) {
            console.error('Error en autenticación:', error.message);
            return res.status(401).json({
                error: true,
                mensaje: 'Token inválido o expirado'
            });
        }
    }
    
    if (!token) {
        return res.status(401).json({
            error: true,
            mensaje: 'Acceso no autorizado, token no proporcionado'
        });
    }
};

// Middleware para verificar roles específicos
const verificarRol = (...rolesPermitidos) => {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({
                error: true,
                mensaje: 'No autenticado'
            });
        }
        
        if (!rolesPermitidos.includes(req.usuario.rol)) {
            return res.status(403).json({
                error: true,
                mensaje: 'No tienes permisos para acceder a este recurso'
            });
        }
        
        next();
    };
};

module.exports = { protegerRuta, verificarRol };