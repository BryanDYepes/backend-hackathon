const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Esquema del usuario
const usuarioSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: [true, 'El nombre es obligatorio'],
        trim: true,
        minlength: [3, 'El nombre debe tener al menos 3 caracteres']
    },
    email: {
        type: String,
        required: [true, 'El email es obligatorio'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Por favor ingrese un email válido']
    },
    password: {
        type: String,
        required: [true, 'La contraseña es obligatoria'],
        minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
        select: false // No se devuelve por defecto en las consultas
    },
    rol: {
        type: String,
        enum: ['admin', 'gerente', 'vendedor'],
        default: 'vendedor'
    },
    activo: {
        type: Boolean,
        default: true
    },
    ultimoAcceso: {
        type: Date
    }
}, {
    timestamps: true // Crea automáticamente createdAt y updatedAt
});

// Middleware para hashear la contraseña antes de guardar
usuarioSchema.pre('save', async function(next) {
    // Solo hashear si la contraseña fue modificada o es nueva
    if (!this.isModified('password')) {
        return next();
    }
    
    try {
        // Generar salt y hashear la contraseña
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Método para comparar contraseñas
usuarioSchema.methods.compararPassword = async function(passwordIngresado) {
    return await bcrypt.compare(passwordIngresado, this.password);
};

// Método para no devolver información sensible
usuarioSchema.methods.toJSON = function() {
    const usuario = this.toObject();
    delete usuario.password;
    return usuario;
};

module.exports = mongoose.model('Usuario', usuarioSchema);