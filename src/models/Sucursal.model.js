const mongoose = require('mongoose');

// Esquema de sucursal
const sucursalSchema = new mongoose.Schema({
    codigo: {
        type: String,
        required: [true, 'El código de la sucursal es obligatorio'],
        unique: true,
        trim: true,
        uppercase: true
    },
    nombre: {
        type: String,
        required: [true, 'El nombre de la sucursal es obligatorio'],
        trim: true
    },
    direccion: {
        calle: {
            type: String,
            required: [true, 'La dirección es obligatoria'],
            trim: true
        },
        ciudad: {
            type: String,
            required: [true, 'La ciudad es obligatoria'],
            trim: true
        },
        departamento: {
            type: String,
            required: [true, 'El departamento es obligatorio'],
            trim: true
        },
        codigoPostal: {
            type: String,
            trim: true
        }
    },
    contacto: {
        telefono: {
            type: String,
            required: [true, 'El teléfono es obligatorio'],
            trim: true
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, 'Por favor ingrese un email válido']
        },
        whatsapp: {
            type: String,
            trim: true
        }
    },
    gerente: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario'
    },
    nombreGerente: {
        type: String,
        trim: true
    },
    horario: {
        apertura: {
            type: String, // Formato: "08:00"
            default: "08:00"
        },
        cierre: {
            type: String, // Formato: "20:00"
            default: "20:00"
        },
        diasLaborales: {
            type: [String],
            enum: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
            default: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
        }
    },
    capacidad: {
        metrosCuadrados: {
            type: Number,
            min: 0
        },
        capacidadAlmacenamiento: {
            type: Number, // Cantidad aproximada de productos
            min: 0
        }
    },
    estado: {
        type: String,
        enum: ['Activa', 'Inactiva', 'En mantenimiento'],
        default: 'Activa'
    },
    fechaApertura: {
        type: Date,
        default: Date.now
    },
    observaciones: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Índices para mejorar rendimiento
sucursalSchema.index({ codigo: 1 });
sucursalSchema.index({ ciudad: 1 });
sucursalSchema.index({ estado: 1 });

// Método virtual para obtener dirección completa
sucursalSchema.virtual('direccionCompleta').get(function() {
    return `${this.direccion.calle}, ${this.direccion.ciudad}, ${this.direccion.departamento}`;
});

// Asegurar que los virtuals se incluyan en JSON
sucursalSchema.set('toJSON', { virtuals: true });
sucursalSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Sucursal', sucursalSchema);