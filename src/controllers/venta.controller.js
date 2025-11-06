const Venta = require('../models/Venta.model');
const Producto = require('../models/Producto.model');
const mongoose = require('mongoose');

// @desc    Crear nueva venta
// @route   POST /api/ventas
// @access  Private
const crearVenta = async (req, res) => {
    // Usar sesión de MongoDB para transacciones
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const {
            sucursal,
            items,
            descuento,
            metodoPago,
            observaciones,
            cliente
        } = req.body;
        
        // Validaciones básicas
        if (!sucursal || !items || items.length === 0 || !metodoPago) {
            await session.abortTransaction();
            return res.status(400).json({
                error: true,
                mensaje: 'Por favor complete todos los campos obligatorios'
            });
        }
        
        // Validar y preparar items de la venta
        const itemsVenta = [];
        
        for (const item of items) {
            // Buscar el producto
            const producto = await Producto.findById(item.producto).session(session);
            
            if (!producto) {
                await session.abortTransaction();
                return res.status(404).json({
                    error: true,
                    mensaje: `Producto con ID ${item.producto} no encontrado`
                });
            }
            
            // Verificar stock disponible
            if (producto.stockActual < item.cantidad) {
                await session.abortTransaction();
                return res.status(400).json({
                    error: true,
                    mensaje: `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stockActual}`
                });
            }
            
            // Calcular subtotal del item
            const subtotal = item.cantidad * producto.precioVenta;
            
            // Preparar item para la venta
            itemsVenta.push({
                producto: producto._id,
                nombreProducto: producto.nombre,
                codigoProducto: producto.codigo,
                categoria: producto.categoria,
                genero: producto.genero,
                talla: producto.talla,
                cantidad: item.cantidad,
                precioUnitario: producto.precioVenta,
                subtotal
            });
            
            // Reducir stock del producto
            producto.stockActual -= item.cantidad;
            await producto.save({ session });
        }
        
        // Generar número de venta único
        const numeroVenta = await Venta.generarNumeroVenta();
        
        // Crear la venta
        const venta = new Venta({
            numeroVenta,
            sucursal,
            vendedor: req.usuario._id,
            nombreVendedor: req.usuario.nombre,
            items: itemsVenta,
            descuento: descuento || 0,
            metodoPago,
            observaciones,
            cliente
        });
        
        await venta.save({ session });
        
        // Confirmar la transacción
        await session.commitTransaction();
        
        res.status(201).json({
            success: true,
            mensaje: 'Venta registrada exitosamente',
            data: venta
        });
        
    } catch (error) {
        // Revertir cambios si hay error
        await session.abortTransaction();
        console.error('Error al crear venta:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al registrar venta',
            detalle: error.message
        });
    } finally {
        session.endSession();
    }
};

// @desc    Obtener todas las ventas con filtros
// @route   GET /api/ventas
// @access  Private
const obtenerVentas = async (req, res) => {
    try {
        const {
            sucursal,
            vendedor,
            estadoVenta,
            metodoPago,
            fechaInicio,
            fechaFin,
            page = 1,
            limit = 50
        } = req.query;
        
        // Construir filtros
        const filtros = {};
        
        if (sucursal) filtros.sucursal = mongoose.Types.ObjectId(sucursal);
        if (vendedor) filtros.vendedor = vendedor;
        if (estadoVenta) filtros.estadoVenta = estadoVenta;
        if (metodoPago) filtros.metodoPago = metodoPago;
        
        // Filtro por rango de fechas
        if (fechaInicio || fechaFin) {
            filtros.fecha = {};
            if (fechaInicio) filtros.fecha.$gte = new Date(fechaInicio);
            if (fechaFin) {
                const fechaFinAjustada = new Date(fechaFin);
                fechaFinAjustada.setHours(23, 59, 59, 999);
                filtros.fecha.$lte = fechaFinAjustada;
            }
        }
        
        // Paginación
        const skip = (page - 1) * limit;
        
        const ventas = await Venta.find(filtros)
            .populate('vendedor', 'nombre email')
            .sort({ fecha: -1 })
            .limit(parseInt(limit))
            .skip(skip);
        
        const total = await Venta.countDocuments(filtros);
        
        res.json({
            success: true,
            data: ventas,
            paginacion: {
                total,
                pagina: parseInt(page),
                limite: parseInt(limit),
                totalPaginas: Math.ceil(total / limit)
            }
        });
        
    } catch (error) {
        console.error('Error al obtener ventas:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener ventas',
            detalle: error.message
        });
    }
};

// @desc    Obtener una venta por ID
// @route   GET /api/ventas/:id
// @access  Private
const obtenerVentaPorId = async (req, res) => {
    try {
        const venta = await Venta.findById(req.params.id)
            .populate('vendedor', 'nombre email rol')
            .populate('items.producto');
        
        if (!venta) {
            return res.status(404).json({
                error: true,
                mensaje: 'Venta no encontrada'
            });
        }
        
        res.json({
            success: true,
            data: venta
        });
        
    } catch (error) {
        console.error('Error al obtener venta:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener venta',
            detalle: error.message
        });
    }
};

// @desc    Buscar venta por número
// @route   GET /api/ventas/numero/:numeroVenta
// @access  Private
const obtenerVentaPorNumero = async (req, res) => {
    try {
        const venta = await Venta.findOne({ 
            numeroVenta: req.params.numeroVenta.toUpperCase() 
        })
            .populate('vendedor', 'nombre email')
            .populate('items.producto');
        
        if (!venta) {
            return res.status(404).json({
                error: true,
                mensaje: 'Venta no encontrada'
            });
        }
        
        res.json({
            success: true,
            data: venta
        });
        
    } catch (error) {
        console.error('Error al buscar venta:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al buscar venta',
            detalle: error.message
        });
    }
};

// @desc    Cancelar una venta
// @route   PATCH /api/ventas/:id/cancelar
// @access  Private (Admin/Gerente)
const cancelarVenta = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const { motivo } = req.body;
        
        const venta = await Venta.findById(req.params.id).session(session);
        
        if (!venta) {
            await session.abortTransaction();
            return res.status(404).json({
                error: true,
                mensaje: 'Venta no encontrada'
            });
        }
        
        if (venta.estadoVenta === 'Cancelada') {
            await session.abortTransaction();
            return res.status(400).json({
                error: true,
                mensaje: 'La venta ya está cancelada'
            });
        }
        
        // Devolver el stock a los productos
        for (const item of venta.items) {
            const producto = await Producto.findById(item.producto).session(session);
            
            if (producto) {
                producto.stockActual += item.cantidad;
                await producto.save({ session });
            }
        }
        
        // Actualizar estado de la venta
        venta.estadoVenta = 'Cancelada';
        venta.observaciones = `${venta.observaciones || ''}\nCANCELADA: ${motivo || 'Sin motivo especificado'} - ${new Date().toLocaleString('es-CO')}`;
        await venta.save({ session });
        
        await session.commitTransaction();
        
        res.json({
            success: true,
            mensaje: 'Venta cancelada exitosamente',
            data: venta
        });
        
    } catch (error) {
        await session.abortTransaction();
        console.error('Error al cancelar venta:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al cancelar venta',
            detalle: error.message
        });
    } finally {
        session.endSession();
    }
};

// @desc    Obtener ventas del día actual
// @route   GET /api/ventas/hoy
// @access  Private
const obtenerVentasDelDia = async (req, res) => {
    try {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        
        const mañana = new Date(hoy);
        mañana.setDate(mañana.getDate() + 1);
        
        const ventas = await Venta.find({
            fecha: {
                $gte: hoy,
                $lt: mañana
            },
            estadoVenta: 'Completada'
        })
            .populate('vendedor', 'nombre')
            .sort({ fecha: -1 });
        
        // Calcular totales del día
        const totalVentas = ventas.length;
        const totalIngresos = ventas.reduce((sum, venta) => sum + venta.total, 0);
        
        res.json({
            success: true,
            resumen: {
                totalVentas,
                totalIngresos,
                fecha: hoy.toLocaleDateString('es-CO')
            },
            data: ventas
        });
        
    } catch (error) {
        console.error('Error al obtener ventas del día:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener ventas del día',
            detalle: error.message
        });
    }
};

// @desc    Obtener mis ventas (del vendedor autenticado)
// @route   GET /api/ventas/mis-ventas
// @access  Private
const obtenerMisVentas = async (req, res) => {
    try {
        const { fechaInicio, fechaFin, page = 1, limit = 20 } = req.query;
        
        const filtros = {
            vendedor: req.usuario._id,
            estadoVenta: 'Completada'
        };
        
        // Filtro por fechas si se proporcionan
        if (fechaInicio || fechaFin) {
            filtros.fecha = {};
            if (fechaInicio) filtros.fecha.$gte = new Date(fechaInicio);
            if (fechaFin) {
                const fechaFinAjustada = new Date(fechaFin);
                fechaFinAjustada.setHours(23, 59, 59, 999);
                filtros.fecha.$lte = fechaFinAjustada;
            }
        }
        
        const skip = (page - 1) * limit;
        
        const ventas = await Venta.find(filtros)
            .sort({ fecha: -1 })
            .limit(parseInt(limit))
            .skip(skip);
        
        const total = await Venta.countDocuments(filtros);
        
        // Calcular estadísticas del vendedor
        const totalVendido = ventas.reduce((sum, venta) => sum + venta.total, 0);
        const cantidadVentas = ventas.length;
        
        res.json({
            success: true,
            estadisticas: {
                totalVentas: cantidadVentas,
                totalVendido,
                promedioVenta: cantidadVentas > 0 ? (totalVendido / cantidadVentas).toFixed(2) : 0
            },
            data: ventas,
            paginacion: {
                total,
                pagina: parseInt(page),
                limite: parseInt(limit),
                totalPaginas: Math.ceil(total / limit)
            }
        });
        
    } catch (error) {
        console.error('Error al obtener mis ventas:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener mis ventas',
            detalle: error.message
        });
    }
};

module.exports = {
    crearVenta,
    obtenerVentas,
    obtenerVentaPorId,
    obtenerVentaPorNumero,
    cancelarVenta,
    obtenerVentasDelDia,
    obtenerMisVentas
};