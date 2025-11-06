const Usuario = require('../models/Usuario.model');

const usuariosData = [
    {
        nombre: 'Administrador Principal',
        email: 'admin@retail.com',
        password: 'admin123',
        rol: 'admin',
        activo: true
    },
    {
        nombre: 'Carlos Gerente',
        email: 'gerente@retail.com',
        password: 'gerente123',
        rol: 'gerente',
        activo: true
    },
    {
        nombre: 'María Vendedora',
        email: 'vendedor@retail.com',
        password: 'vendedor123',
        rol: 'vendedor',
        activo: true
    },
    {
        nombre: 'Ana López',
        email: 'ana.lopez@retail.com',
        password: 'vendedor123',
        rol: 'vendedor',
        activo: true
    },
    {
        nombre: 'Juan Martínez',
        email: 'juan.martinez@retail.com',
        password: 'vendedor123',
        rol: 'vendedor',
        activo: true
    },
    {
        nombre: 'Laura Rodríguez',
        email: 'laura.rodriguez@retail.com',
        password: 'gerente123',
        rol: 'gerente',
        activo: true
    },
    {
        nombre: 'Pedro Sánchez',
        email: 'pedro.sanchez@retail.com',
        password: 'vendedor123',
        rol: 'vendedor',
        activo: true
    }
];

const crearUsuarios = async () => {
    try {
        const usuarios = await Usuario.create(usuariosData);
        return usuarios;
    } catch (error) {
        throw new Error('Error al crear usuarios: ' + error.message);
    }
};

module.exports = { crearUsuarios };