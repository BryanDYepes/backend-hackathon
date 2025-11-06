const mongoose = require('mongoose');

// Esquema para registrar movimientos de inventario
const movimientoInventarioSchema = new mongoose.Schema({
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
    tipoMovimiento: {
        type: String,
        enum: [
            'ENTRADA',           // Compra o ingreso de mercancía
            'SALIDA',            // Venta o salida
            'AJUSTE_POSITIVO',   // Corrección que aumenta stock
            'AJUSTE_NEGATIVO',   // Corrección que disminuye stock
            'TRANSFERENCIA_ENTRADA',  // Llega de otra sucursal
            'TRANSFERENCIA_SALIDA',   // Se envía a otra sucursal
            'DEVOLUCION',        // Devolución de cliente
            'MERMA',             // Pérdida o daño de producto
            'INVENTARIO_INICIAL' // Carga inicial de inventario
        ],
        required: true
    },
    cantidad: {
        type: Number,
        required: true,
        min: [1, 'La cantidad debe ser mayor a 0']
    },
    stockAnterior: {
        type: Number,
        required: true
    },
    stockNuevo: {
        type: Number,
        required: true
    },
    sucursal: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sucursal',
        required: true
    },
    // Para transferencias
    sucursalDestino: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sucursal'
    },
    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    nombreUsuario: {
        type: String,
        required: true
    },
    motivo: {
        type: String,
        trim: true
    },
    observaciones: {
        type: String,
        trim: true
    },
    // Referencia a venta si el movimiento es por venta
    venta: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Venta'
    },
    // Costo unitario en el momento del movimiento (para valoración)
    costoUnitario: {
        type: Number,
        min: 0
    },
    valorTotal: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Índices para mejorar rendimiento
movimientoInventarioSchema.index({ producto: 1, createdAt: -1 });
movimientoInventarioSchema.index({ sucursal: 1, createdAt: -1 });
movimientoInventarioSchema.index({ tipoMovimiento: 1 });
movimientoInventarioSchema.index({ usuario: 1 });

// Middleware pre-save para calcular valor total
movimientoInventarioSchema.pre('save', function (next) {
    if (this.costoUnitario) {
        this.valorTotal = this.cantidad * this.costoUnitario;
    }
    next();
});

module.exports = mongoose.model('MovimientoInventario', movimientoInventarioSchema);