const mongoose = require('mongoose');

// Esquema para los items de la venta
const itemVentaSchema = new mongoose.Schema({
    producto: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Producto',
        required: true
    },
    nombreProducto: {
        type: String,
        required: true
    },
    codigoProducto: {
        type: String,
        required: true
    },
    categoria: {
        type: String,
        required: true
    },
    genero: {
        type: String,
        required: true
    },
    talla: {
        type: String,
        required: true
    },
    cantidad: {
        type: Number,
        required: true,
        min: [1, 'La cantidad debe ser al menos 1']
    },
    precioUnitario: {
        type: Number,
        required: true,
        min: [0, 'El precio no puede ser negativo']
    },
    subtotal: {
        type: Number,
        required: true
    }
}, { _id: false });

// Esquema principal de la venta
const ventaSchema = new mongoose.Schema({
    numeroVenta: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },
    fecha: {
        type: Date,
        default: Date.now,
        required: true
    },
    sucursal: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sucursal',
        required: [true, 'La sucursal es obligatoria']
    },
    vendedor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    nombreVendedor: {
        type: String,
        required: true
    },
    items: [itemVentaSchema],
    subtotal: {
        type: Number,
        default: 0,
        min: 0
    },
    descuento: {
        type: Number,
        default: 0,
        min: [0, 'El descuento no puede ser negativo']
    },
    total: {
        type: Number,
        default: 0,
        min: 0
    },
    metodoPago: {
        type: String,
        enum: ['Efectivo', 'Tarjeta', 'Transferencia', 'Mixto'],
        required: true
    },
    estadoVenta: {
        type: String,
        enum: ['Completada', 'Cancelada', 'Pendiente'],
        default: 'Completada'
    },
    observaciones: {
        type: String,
        trim: true
    },
    // Información del cliente (opcional)
    cliente: {
        nombre: { type: String, trim: true },
        telefono: { type: String, trim: true },
        email: { type: String, trim: true }
    }
}, {
    timestamps: true
});

// Índices para mejorar rendimiento
ventaSchema.index({ numeroVenta: 1 });
ventaSchema.index({ fecha: -1 });
ventaSchema.index({ sucursal: 1, fecha: -1 });
ventaSchema.index({ vendedor: 1 });
ventaSchema.index({ estadoVenta: 1 });

// Middleware pre-validate para calcular totales antes de la validación
ventaSchema.pre('validate', function (next) {
    // Calcular subtotal sumando los subtotales de cada item
    if (this.items && this.items.length > 0) {
        this.subtotal = this.items.reduce((sum, item) => sum + item.subtotal, 0);

        // Calcular total aplicando descuento
        this.total = this.subtotal - (this.descuento || 0);
    }

    next();
});

// Método para generar número de venta único
ventaSchema.statics.generarNumeroVenta = async function () {
    const fecha = new Date();
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');

    // Formato: VTA-YYYYMMDD-XXXX
    const prefijo = `VTA-${año}${mes}${dia}`;

    // Buscar la última venta del día
    const ultimaVenta = await this.findOne({
        numeroVenta: { $regex: `^${prefijo}` }
    }).sort({ numeroVenta: -1 });

    let consecutivo = 1;

    if (ultimaVenta) {
        // Extraer el consecutivo y sumarle 1
        const ultimoConsecutivo = parseInt(ultimaVenta.numeroVenta.split('-')[2]);
        consecutivo = ultimoConsecutivo + 1;
    }

    return `${prefijo}-${String(consecutivo).padStart(4, '0')}`;
};

module.exports = mongoose.model('Venta', ventaSchema);