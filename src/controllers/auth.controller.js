const Usuario = require('../models/Usuario.model');
const jwt = require('jsonwebtoken');

// Función auxiliar para generar JWT
const generarToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d' // Token válido por 30 días
    });
};

// @desc    Registrar nuevo usuario
// @route   POST /api/auth/registro
// @access  Public
const registrarUsuario = async (req, res) => {
    try {
        const { nombre, email, password, rol } = req.body;
        
        // Validar que vengan los campos requeridos
        if (!nombre || !email || !password) {
            return res.status(400).json({
                error: true,
                mensaje: 'Por favor complete todos los campos obligatorios'
            });
        }
        
        // Verificar si el usuario ya existe
        const usuarioExiste = await Usuario.findOne({ email });
        
        if (usuarioExiste) {
            return res.status(400).json({
                error: true,
                mensaje: 'El email ya está registrado'
            });
        }
        
        // Crear el usuario
        const usuario = await Usuario.create({
            nombre,
            email,
            password,
            rol: rol || 'vendedor' // Por defecto vendedor
        });
        
        // Generar token
        const token = generarToken(usuario._id);
        
        res.status(201).json({
            success: true,
            mensaje: 'Usuario registrado exitosamente',
            data: {
                id: usuario._id,
                nombre: usuario.nombre,
                email: usuario.email,
                rol: usuario.rol,
                token
            }
        });
        
    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al registrar usuario',
            detalle: error.message
        });
    }
};

// @desc    Login de usuario
// @route   POST /api/auth/login
// @access  Public
const loginUsuario = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validar campos
        if (!email || !password) {
            return res.status(400).json({
                error: true,
                mensaje: 'Por favor ingrese email y contraseña'
            });
        }
        
        // Buscar usuario por email (incluir password que está oculto por defecto)
        const usuario = await Usuario.findOne({ email }).select('+password');
        
        if (!usuario) {
            return res.status(401).json({
                error: true,
                mensaje: 'Credenciales inválidas'
            });
        }
        
        // Verificar si el usuario está activo
        if (!usuario.activo) {
            return res.status(401).json({
                error: true,
                mensaje: 'Usuario inactivo. Contacte al administrador'
            });
        }
        
        // Verificar contraseña
        const passwordCorrecto = await usuario.compararPassword(password);
        
        if (!passwordCorrecto) {
            return res.status(401).json({
                error: true,
                mensaje: 'Credenciales inválidas'
            });
        }
        
        // Actualizar último acceso
        usuario.ultimoAcceso = new Date();
        await usuario.save();
        
        // Generar token
        const token = generarToken(usuario._id);
        
        res.json({
            success: true,
            mensaje: 'Login exitoso',
            data: {
                id: usuario._id,
                nombre: usuario.nombre,
                email: usuario.email,
                rol: usuario.rol,
                token
            }
        });
        
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al iniciar sesión',
            detalle: error.message
        });
    }
};

// @desc    Obtener perfil del usuario autenticado
// @route   GET /api/auth/perfil
// @access  Private
const obtenerPerfil = async (req, res) => {
    try {
        // req.usuario ya viene del middleware de autenticación
        const usuario = await Usuario.findById(req.usuario._id);
        
        res.json({
            success: true,
            data: usuario
        });
        
    } catch (error) {
        console.error('Error al obtener perfil:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener perfil',
            detalle: error.message
        });
    }
};

// @desc    Actualizar perfil del usuario
// @route   PUT /api/auth/perfil
// @access  Private
const actualizarPerfil = async (req, res) => {
    try {
        const { nombre, email } = req.body;
        
        const usuario = await Usuario.findById(req.usuario._id);
        
        if (!usuario) {
            return res.status(404).json({
                error: true,
                mensaje: 'Usuario no encontrado'
            });
        }
        
        // Actualizar campos si vienen en el body
        if (nombre) usuario.nombre = nombre;
        if (email) usuario.email = email;
        
        await usuario.save();
        
        res.json({
            success: true,
            mensaje: 'Perfil actualizado exitosamente',
            data: usuario
        });
        
    } catch (error) {
        console.error('Error al actualizar perfil:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al actualizar perfil',
            detalle: error.message
        });
    }
};

module.exports = {
    registrarUsuario,
    loginUsuario,
    obtenerPerfil,
    actualizarPerfil
};