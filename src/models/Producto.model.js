const mongoose = require('mongoose');

// Esquema del producto
const productoSchema = new mongoose.Schema({
    codigo: {
        type: String,
        required: [true, 'El código del producto es obligatorio'],
        unique: true,
        trim: true,
        uppercase: true
    },
    nombre: {
        type: String,
        required: [true, 'El nombre del producto es obligatorio'],
        trim: true
    },
    descripcion: {
        type: String,
        trim: true
    },
    categoria: {
        type: String,
        required: [true, 'La categoría es obligatoria'],
        enum: [
            'ABRIGO',
            'BERMUDA',
            'BUZOS',
            'BUZO',
            'CAMISAS',
            'FALDA',
            'HOGAR',
            'JEANS TERMINADOS',
            'PANTALONES',
            'PIJAMAS',
            'POLOS',
            'ROPA DE BAÑO',
            'ROPA INTERIOR',
            'TERCERAS PIEZAS',
            'TSHIRT',
            'TSHIRT TERMINADA',
            'TERMINADAS',
            'VESTIDOS'
        ]
    },
    genero: {
        type: String,
        required: [true, 'El género es obligatorio'],
        enum: ['Mujer', 'Hombre', 'Niño', 'Niña', 'Unisex']
    },
    talla: {
        type: String,
        required: [true, 'La talla es obligatoria'],
        enum: ['XXS', 'XS', 'S', 'M', 'L', 'XL', '4', '6', '8', '10', '12', '14', '16']
    },
    color: {
        type: String,
        trim: true
    },
    precioCompra: {
        type: Number,
        required: [true, 'El precio de compra es obligatorio'],
        min: [0, 'El precio de compra no puede ser negativo']
    },
    precioVenta: {
        type: Number,
        required: [true, 'El precio de venta es obligatorio'],
        min: [0, 'El precio de venta no puede ser negativo']
    },
    stockActual: {
        type: Number,
        required: true,
        default: 0,
        min: [0, 'El stock no puede ser negativo']
    },
    stockMinimo: {
        type: Number,
        default: 5,
        min: [0, 'El stock mínimo no puede ser negativo']
    },
    sucursal: {
        type: String,
        required: [true, 'La sucursal es obligatoria'],
        trim: true
    },
    proveedor: {
        type: String,
        trim: true
    },
    imagen: {
        type: String, // URL de la imagen
        default: null
    },
    activo: {
        type: Boolean,
        default: true
    },
    // Campo calculado para saber si hay alerta de stock bajo
    alertaStock: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true // Crea createdAt y updatedAt automáticamente
});

// Índices para mejorar el rendimiento de las consultas
productoSchema.index({ codigo: 1 });
productoSchema.index({ categoria: 1, genero: 1 });
productoSchema.index({ sucursal: 1 });
productoSchema.index({ activo: 1 });

// Middleware pre-save para actualizar alerta de stock
productoSchema.pre('save', function(next) {
    // Verificar si el stock actual es menor o igual al stock mínimo
    this.alertaStock = this.stockActual <= this.stockMinimo;
    next();
});

// Método virtual para calcular margen de ganancia
productoSchema.virtual('margenGanancia').get(function() {
    if (this.precioCompra === 0) return 0;
    return ((this.precioVenta - this.precioCompra) / this.precioCompra * 100).toFixed(2);
});

// Asegurar que los virtuals se incluyan en JSON
productoSchema.set('toJSON', { virtuals: true });
productoSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Producto', productoSchema);