const mongoose = require('mongoose');

// Esquema de la sucursal
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
    ciudad: {
        type: String,
        required: [true, 'La ciudad es obligatoria'],
        trim: true
    },
    direccion: {
        type: String,
        required: [true, 'La dirección es obligatoria'],
        trim: true
    },
    telefono: {
        type: String,
        required: [true, 'El teléfono es obligatorio'],
        trim: true
    },
    email: {
        type: String,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Por favor ingrese un email válido']
    },
    // Información del gerente de sucursal
    gerente: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario'
    },
    nombreGerente: {
        type: String,
        trim: true
    },
    // Horarios de atención
    horario: {
        apertura: {
            type: String,
            default: '09:00'
        },
        cierre: {
            type: String,
            default: '18:00'
        },
        diasAtencion: {
            type: [String],
            default: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
        }
    },
    // Capacidad y área
    metrosCuadrados: {
        type: Number,
        min: 0
    },
    capacidadAlmacenamiento: {
        type: Number,
        min: 0,
        default: 1000
    },
    // Estado de la sucursal
    activo: {
        type: Boolean,
        default: true
    },
    fechaApertura: {
        type: Date,
        default: Date.now
    },
    // Estadísticas (se actualizan periódicamente)
    estadisticas: {
        totalProductos: {
            type: Number,
            default: 0
        },
        valorInventario: {
            type: Number,
            default: 0
        },
        ventasMesActual: {
            type: Number,
            default: 0
        },
        ultimaActualizacion: {
            type: Date
        }
    },
    // Configuración específica
    configuracion: {
        aceptaTarjeta: {
            type: Boolean,
            default: true
        },
        tieneParqueadero: {
            type: Boolean,
            default: false
        },
        delivery: {
            type: Boolean,
            default: false
        },
        pickupStore: {
            type: Boolean,
            default: false
        }
    },
    // Notas adicionales
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
sucursalSchema.index({ activo: 1 });
sucursalSchema.index({ nombre: 'text' });

// Método para obtener información resumida
sucursalSchema.methods.getResumen = function() {
    return {
        codigo: this.codigo,
        nombre: this.nombre,
        ciudad: this.ciudad,
        direccion: this.direccion,
        telefono: this.telefono,
        activo: this.activo
    };
};

// Método estático para obtener sucursales activas
sucursalSchema.statics.obtenerActivas = function() {
    return this.find({ activo: true }).sort({ nombre: 1 });
};

// Método estático para obtener sucursales por ciudad
sucursalSchema.statics.obtenerPorCiudad = function(ciudad) {
    return this.find({ ciudad, activo: true }).sort({ nombre: 1 });
};

// Virtual para obtener horario formateado
sucursalSchema.virtual('horarioFormateado').get(function() {
    return `${this.horario.apertura} - ${this.horario.cierre}`;
});

// Asegurar que los virtuals se incluyan en JSON
sucursalSchema.set('toJSON', { virtuals: true });
sucursalSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Sucursal', sucursalSchema);