const Producto = require('../models/Producto.model');

// @desc    Obtener todos los productos con filtros opcionales
// @route   GET /api/productos
// @access  Private
const obtenerProductos = async (req, res) => {
    try {
        const { 
            categoria, 
            genero, 
            talla, 
            sucursal, 
            activo,
            alertaStock,
            page = 1, 
            limit = 50 
        } = req.query;
        
        // Construir filtros dinámicamente
        const filtros = {};
        
        if (categoria) filtros.categoria = categoria;
        if (genero) filtros.genero = genero;
        if (talla) filtros.talla = talla;
        if (sucursal) filtros.sucursal = mongoose.Types.ObjectId(sucursal);
        if (activo !== undefined) filtros.activo = activo === 'true';
        if (alertaStock !== undefined) filtros.alertaStock = alertaStock === 'true';
        
        // Calcular paginación
        const skip = (page - 1) * limit;
        
        // Ejecutar consulta con paginación
        const productos = await Producto.find(filtros)
            .sort({ createdAt: -1 }) // Más recientes primero
            .limit(parseInt(limit))
            .skip(skip);
        
        // Contar total de documentos para la paginación
        const total = await Producto.countDocuments(filtros);
        
        res.json({
            success: true,
            data: productos,
            paginacion: {
                total,
                pagina: parseInt(page),
                limite: parseInt(limit),
                totalPaginas: Math.ceil(total / limit)
            }
        });
        
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener productos',
            detalle: error.message
        });
    }
};

// @desc    Obtener un producto por ID
// @route   GET /api/productos/:id
// @access  Private
const obtenerProductoPorId = async (req, res) => {
    try {
        const producto = await Producto.findById(req.params.id);
        
        if (!producto) {
            return res.status(404).json({
                error: true,
                mensaje: 'Producto no encontrado'
            });
        }
        
        res.json({
            success: true,
            data: producto
        });
        
    } catch (error) {
        console.error('Error al obtener producto:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener producto',
            detalle: error.message
        });
    }
};

// @desc    Buscar producto por código
// @route   GET /api/productos/codigo/:codigo
// @access  Private
const obtenerProductoPorCodigo = async (req, res) => {
    try {
        const producto = await Producto.findOne({ 
            codigo: req.params.codigo.toUpperCase() 
        });
        
        if (!producto) {
            return res.status(404).json({
                error: true,
                mensaje: 'Producto no encontrado'
            });
        }
        
        res.json({
            success: true,
            data: producto
        });
        
    } catch (error) {
        console.error('Error al buscar producto:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al buscar producto',
            detalle: error.message
        });
    }
};

// @desc    Crear nuevo producto
// @route   POST /api/productos
// @access  Private (Admin/Gerente)
const crearProducto = async (req, res) => {
    try {
        const {
            codigo,
            nombre,
            descripcion,
            categoria,
            genero,
            talla,
            color,
            precioCompra,
            precioVenta,
            stockActual,
            stockMinimo,
            sucursal,
            proveedor,
            imagen
        } = req.body;
        
        // Validar campos requeridos
        if (!codigo || !nombre || !categoria || !genero || !talla || !precioCompra || !precioVenta || !sucursal) {
            return res.status(400).json({
                error: true,
                mensaje: 'Por favor complete todos los campos obligatorios'
            });
        }
        
        // Verificar si el código ya existe
        const productoExiste = await Producto.findOne({ codigo: codigo.toUpperCase() });
        
        if (productoExiste) {
            return res.status(400).json({
                error: true,
                mensaje: 'Ya existe un producto con ese código'
            });
        }
        
        // Crear el producto
        const producto = await Producto.create({
            codigo: codigo.toUpperCase(),
            nombre,
            descripcion,
            categoria,
            genero,
            talla,
            color,
            precioCompra,
            precioVenta,
            stockActual: stockActual || 0,
            stockMinimo: stockMinimo || 5,
            sucursal,
            proveedor,
            imagen
        });
        
        res.status(201).json({
            success: true,
            mensaje: 'Producto creado exitosamente',
            data: producto
        });
        
    } catch (error) {
        console.error('Error al crear producto:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al crear producto',
            detalle: error.message
        });
    }
};

// @desc    Actualizar producto
// @route   PUT /api/productos/:id
// @access  Private (Admin/Gerente)
const actualizarProducto = async (req, res) => {
    try {
        const producto = await Producto.findById(req.params.id);
        
        if (!producto) {
            return res.status(404).json({
                error: true,
                mensaje: 'Producto no encontrado'
            });
        }
        
        // Campos que se pueden actualizar
        const camposActualizables = [
            'nombre', 'descripcion', 'categoria', 'genero', 'talla',
            'color', 'precioCompra', 'precioVenta', 'stockActual',
            'stockMinimo', 'sucursal', 'proveedor', 'imagen', 'activo'
        ];
        
        // Actualizar solo los campos que vienen en el body
        camposActualizables.forEach(campo => {
            if (req.body[campo] !== undefined) {
                producto[campo] = req.body[campo];
            }
        });
        
        await producto.save();
        
        res.json({
            success: true,
            mensaje: 'Producto actualizado exitosamente',
            data: producto
        });
        
    } catch (error) {
        console.error('Error al actualizar producto:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al actualizar producto',
            detalle: error.message
        });
    }
};

// @desc    Eliminar producto (soft delete)
// @route   DELETE /api/productos/:id
// @access  Private (Admin)
const eliminarProducto = async (req, res) => {
    try {
        const producto = await Producto.findById(req.params.id);
        
        if (!producto) {
            return res.status(404).json({
                error: true,
                mensaje: 'Producto no encontrado'
            });
        }
        
        // Soft delete: solo marcamos como inactivo
        producto.activo = false;
        await producto.save();
        
        res.json({
            success: true,
            mensaje: 'Producto eliminado exitosamente'
        });
        
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al eliminar producto',
            detalle: error.message
        });
    }
};

// @desc    Actualizar stock de un producto
// @route   PATCH /api/productos/:id/stock
// @access  Private
const actualizarStock = async (req, res) => {
    try {
        const { cantidad, operacion } = req.body; // operacion: 'incrementar' o 'decrementar'
        
        if (!cantidad || !operacion) {
            return res.status(400).json({
                error: true,
                mensaje: 'Debe proporcionar cantidad y operación'
            });
        }
        
        const producto = await Producto.findById(req.params.id);
        
        if (!producto) {
            return res.status(404).json({
                error: true,
                mensaje: 'Producto no encontrado'
            });
        }
        
        // Actualizar stock según la operación
        if (operacion === 'incrementar') {
            producto.stockActual += parseInt(cantidad);
        } else if (operacion === 'decrementar') {
            if (producto.stockActual < cantidad) {
                return res.status(400).json({
                    error: true,
                    mensaje: 'Stock insuficiente'
                });
            }
            producto.stockActual -= parseInt(cantidad);
        } else {
            return res.status(400).json({
                error: true,
                mensaje: 'Operación inválida. Use "incrementar" o "decrementar"'
            });
        }
        
        await producto.save();
        
        res.json({
            success: true,
            mensaje: 'Stock actualizado exitosamente',
            data: producto
        });
        
    } catch (error) {
        console.error('Error al actualizar stock:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al actualizar stock',
            detalle: error.message
        });
    }
};

// @desc    Obtener productos con stock bajo
// @route   GET /api/productos/alertas/stock-bajo
// @access  Private
const obtenerProductosStockBajo = async (req, res) => {
    try {
        const productos = await Producto.find({ 
            alertaStock: true,
            activo: true
        }).sort({ stockActual: 1 }); // Ordenar por stock más bajo primero
        
        res.json({
            success: true,
            total: productos.length,
            data: productos
        });
        
    } catch (error) {
        console.error('Error al obtener productos con stock bajo:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener productos con stock bajo',
            detalle: error.message
        });
    }
};

// @desc    Buscar productos por nombre (búsqueda parcial)
// @route   GET /api/productos/buscar/:termino
// @access  Private
const buscarProductos = async (req, res) => {
    try {
        const termino = req.params.termino;
        
        const productos = await Producto.find({
            $or: [
                { nombre: { $regex: termino, $options: 'i' } }, // i = case insensitive
                { descripcion: { $regex: termino, $options: 'i' } },
                { codigo: { $regex: termino, $options: 'i' } }
            ],
            activo: true
        }).limit(20);
        
        res.json({
            success: true,
            total: productos.length,
            data: productos
        });
        
    } catch (error) {
        console.error('Error al buscar productos:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al buscar productos',
            detalle: error.message
        });
    }
};

module.exports = {
    obtenerProductos,
    obtenerProductoPorId,
    obtenerProductoPorCodigo,
    crearProducto,
    actualizarProducto,
    eliminarProducto,
    actualizarStock,
    obtenerProductosStockBajo,
    buscarProductos
};