const Usuario = require('../models/Usuario.model');
const Sucursal = require('../models/Sucursal.model');
const jwt = require('jsonwebtoken');

// Función auxiliar para generar JWT
const generarToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

// @desc    Registrar nuevo usuario
// @route   POST /api/auth/registro
// @access  Public
const registrarUsuario = async (req, res) => {
    try {
        const { nombre, email, password, rol, sucursal } = req.body;

        // Validar campos requeridos
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

        // Validar sucursal si se envía
        let sucursalAsignada = null;
        if (sucursal) {
            const sucursalEncontrada = await Sucursal.findById(sucursal);
            if (!sucursalEncontrada) {
                return res.status(404).json({
                    error: true,
                    mensaje: 'Sucursal no encontrada'
                });
            }
            sucursalAsignada = sucursalEncontrada._id;
        }

        // Crear usuario
        const usuario = await Usuario.create({
            nombre,
            email,
            password,
            rol: rol || 'vendedor',
            sucursal: sucursalAsignada
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
                sucursal: sucursalAsignada,
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

        if (!email || !password) {
            return res.status(400).json({
                error: true,
                mensaje: 'Por favor ingrese email y contraseña'
            });
        }

        const usuario = await Usuario.findOne({ email })
            .select('+password')
            .populate('sucursal', 'nombre codigo estado');

        if (!usuario) {
            return res.status(401).json({
                error: true,
                mensaje: 'Credenciales inválidas'
            });
        }

        if (!usuario.activo) {
            return res.status(401).json({
                error: true,
                mensaje: 'Usuario inactivo. Contacte al administrador'
            });
        }

        const passwordCorrecto = await usuario.compararPassword(password);
        if (!passwordCorrecto) {
            return res.status(401).json({
                error: true,
                mensaje: 'Credenciales inválidas'
            });
        }

        usuario.ultimoAcceso = new Date();
        await usuario.save();

        const token = generarToken(usuario._id);

        res.json({
            success: true,
            mensaje: 'Login exitoso',
            data: {
                id: usuario._id,
                nombre: usuario.nombre,
                email: usuario.email,
                rol: usuario.rol,
                sucursal: usuario.sucursal,
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
        const usuario = await Usuario.findById(req.usuario._id)
            .populate('sucursal', 'nombre codigo direccion estado');

        if (!usuario) {
            return res.status(404).json({
                error: true,
                mensaje: 'Usuario no encontrado'
            });
        }

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
        const { nombre, email, sucursal } = req.body;

        const usuario = await Usuario.findById(req.usuario._id);
        if (!usuario) {
            return res.status(404).json({
                error: true,
                mensaje: 'Usuario no encontrado'
            });
        }

        if (nombre) usuario.nombre = nombre;
        if (email) usuario.email = email;

        // Si se envía una nueva sucursal, validar que exista
        if (sucursal) {
            const sucursalValida = await Sucursal.findById(sucursal);
            if (!sucursalValida) {
                return res.status(404).json({
                    error: true,
                    mensaje: 'Sucursal no encontrada'
                });
            }
            usuario.sucursal = sucursalValida._id;
        }

        await usuario.save();

        // Retornar con populate para mostrar la info actualizada de la sucursal
        const usuarioActualizado = await Usuario.findById(usuario._id)
            .populate('sucursal', 'nombre codigo estado');

        res.json({
            success: true,
            mensaje: 'Perfil actualizado exitosamente',
            data: usuarioActualizado
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
