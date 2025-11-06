const Producto = require('../models/Producto.model');
const MovimientoInventario = require('../models/MovimientoInventario.model');
const Sucursal = require('../models/Sucursal.model');
const mongoose = require('mongoose');

// @desc    Registrar entrada de inventario (compra)
// @route   POST /api/inventario/entrada
// @access  Private (Admin/Gerente)
const registrarEntrada = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            productoId,
            cantidad,
            motivo,
            observaciones,
            costoUnitario
        } = req.body;

        // Validaciones
        if (!productoId || !cantidad) {
            await session.abortTransaction();
            return res.status(400).json({
                error: true,
                mensaje: 'ProductoId y cantidad son obligatorios'
            });
        }

        // Buscar el producto con populate de sucursal
        const producto = await Producto.findById(productoId)
            .populate('sucursal')
            .session(session);

        if (!producto) {
            await session.abortTransaction();
            return res.status(404).json({
                error: true,
                mensaje: 'Producto no encontrado'
            });
        }

        // Guardar stock anterior
        const stockAnterior = producto.stockActual;

        // Actualizar stock del producto
        producto.stockActual += parseInt(cantidad);

        // Si viene costo unitario, actualizar precio de compra
        if (costoUnitario && costoUnitario > 0) {
            producto.precioCompra = costoUnitario;
        }

        await producto.save({ session });

        // Registrar movimiento
        const movimiento = await MovimientoInventario.create([{
            producto: producto._id,
            nombreProducto: producto.nombre,
            codigoProducto: producto.codigo,
            tipoMovimiento: 'ENTRADA',
            cantidad: parseInt(cantidad),
            stockAnterior,
            stockNuevo: producto.stockActual,
            sucursal: producto.sucursal._id,
            usuario: req.usuario._id,
            nombreUsuario: req.usuario.nombre,
            motivo: motivo || 'Entrada de mercancía',
            observaciones,
            costoUnitario: costoUnitario || producto.precioCompra
        }], { session });

        await session.commitTransaction();

        // Formatear respuesta con sucursal
        const productoRespuesta = producto.toObject();
        productoRespuesta.sucursal = producto.sucursal ? {
            id: producto.sucursal._id,
            nombre: producto.sucursal.nombre
        } : null;

        res.status(201).json({
            success: true,
            mensaje: 'Entrada de inventario registrada exitosamente',
            data: {
                producto: productoRespuesta,
                movimiento: movimiento[0]
            }
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Error al registrar entrada:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al registrar entrada de inventario',
            detalle: error.message
        });
    } finally {
        session.endSession();
    }
};

// @desc    Registrar salida de inventario (no venta)
// @route   POST /api/inventario/salida
// @access  Private (Admin/Gerente)
const registrarSalida = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            productoId,
            cantidad,
            motivo,
            observaciones
        } = req.body;

        if (!productoId || !cantidad || !motivo) {
            await session.abortTransaction();
            return res.status(400).json({
                error: true,
                mensaje: 'ProductoId, cantidad y motivo son obligatorios'
            });
        }

        const producto = await Producto.findById(productoId)
            .populate('sucursal')
            .session(session);

        if (!producto) {
            await session.abortTransaction();
            return res.status(404).json({
                error: true,
                mensaje: 'Producto no encontrado'
            });
        }

        // Verificar stock suficiente
        if (producto.stockActual < cantidad) {
            await session.abortTransaction();
            return res.status(400).json({
                error: true,
                mensaje: `Stock insuficiente. Disponible: ${producto.stockActual}`
            });
        }

        const stockAnterior = producto.stockActual;
        producto.stockActual -= parseInt(cantidad);
        await producto.save({ session });

        const movimiento = await MovimientoInventario.create([{
            producto: producto._id,
            nombreProducto: producto.nombre,
            codigoProducto: producto.codigo,
            tipoMovimiento: 'SALIDA',
            cantidad: parseInt(cantidad),
            stockAnterior,
            stockNuevo: producto.stockActual,
            sucursal: producto.sucursal._id,
            usuario: req.usuario._id,
            nombreUsuario: req.usuario.nombre,
            motivo,
            observaciones,
            costoUnitario: producto.precioCompra
        }], { session });

        await session.commitTransaction();

        const productoRespuesta = producto.toObject();
        productoRespuesta.sucursal = producto.sucursal ? {
            id: producto.sucursal._id,
            nombre: producto.sucursal.nombre
        } : null;

        res.status(201).json({
            success: true,
            mensaje: 'Salida de inventario registrada exitosamente',
            data: {
                producto: productoRespuesta,
                movimiento: movimiento[0]
            }
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Error al registrar salida:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al registrar salida de inventario',
            detalle: error.message
        });
    } finally {
        session.endSession();
    }
};

// @desc    Registrar ajuste de inventario
// @route   POST /api/inventario/ajuste
// @access  Private (Admin/Gerente)
const registrarAjuste = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            productoId,
            stockReal,
            motivo,
            observaciones
        } = req.body;

        if (!productoId || stockReal === undefined || !motivo) {
            await session.abortTransaction();
            return res.status(400).json({
                error: true,
                mensaje: 'ProductoId, stockReal y motivo son obligatorios'
            });
        }

        const producto = await Producto.findById(productoId)
            .populate('sucursal')
            .session(session);

        if (!producto) {
            await session.abortTransaction();
            return res.status(404).json({
                error: true,
                mensaje: 'Producto no encontrado'
            });
        }

        const stockAnterior = producto.stockActual;
        const diferencia = parseInt(stockReal) - stockAnterior;

        // No hacer nada si no hay diferencia
        if (diferencia === 0) {
            await session.abortTransaction();
            return res.status(400).json({
                error: true,
                mensaje: 'El stock real es igual al stock actual, no hay ajuste necesario'
            });
        }

        // Determinar tipo de ajuste
        const tipoMovimiento = diferencia > 0 ? 'AJUSTE_POSITIVO' : 'AJUSTE_NEGATIVO';

        producto.stockActual = parseInt(stockReal);
        await producto.save({ session });

        const movimiento = await MovimientoInventario.create([{
            producto: producto._id,
            nombreProducto: producto.nombre,
            codigoProducto: producto.codigo,
            tipoMovimiento,
            cantidad: Math.abs(diferencia),
            stockAnterior,
            stockNuevo: producto.stockActual,
            sucursal: producto.sucursal._id,
            usuario: req.usuario._id,
            nombreUsuario: req.usuario.nombre,
            motivo,
            observaciones: `${observaciones || ''}\nDiferencia: ${diferencia}`,
            costoUnitario: producto.precioCompra
        }], { session });

        await session.commitTransaction();

        const productoRespuesta = producto.toObject();
        productoRespuesta.sucursal = producto.sucursal ? {
            id: producto.sucursal._id,
            nombre: producto.sucursal.nombre
        } : null;

        res.status(201).json({
            success: true,
            mensaje: 'Ajuste de inventario registrado exitosamente',
            data: {
                producto: productoRespuesta,
                movimiento: movimiento[0],
                diferencia
            }
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Error al registrar ajuste:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al registrar ajuste de inventario',
            detalle: error.message
        });
    } finally {
        session.endSession();
    }
};

// @desc    Registrar transferencia entre sucursales
// @route   POST /api/inventario/transferencia
// @access  Private (Admin/Gerente)
const registrarTransferencia = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            productoId,
            cantidad,
            sucursalDestino,
            observaciones
        } = req.body;

        if (!productoId || !cantidad || !sucursalDestino) {
            await session.abortTransaction();
            return res.status(400).json({
                error: true,
                mensaje: 'ProductoId, cantidad y sucursalDestino son obligatorios'
            });
        }

        // Verificar que la sucursal destino existe
        const sucursalDestinoDoc = await Sucursal.findById(sucursalDestino).session(session);
        if (!sucursalDestinoDoc) {
            await session.abortTransaction();
            return res.status(404).json({
                error: true,
                mensaje: 'Sucursal destino no encontrada'
            });
        }

        const producto = await Producto.findById(productoId)
            .populate('sucursal')
            .session(session);

        if (!producto) {
            await session.abortTransaction();
            return res.status(404).json({
                error: true,
                mensaje: 'Producto no encontrado'
            });
        }

        // Verificar que la sucursal destino sea diferente
        if (producto.sucursal._id.toString() === sucursalDestino) {
            await session.abortTransaction();
            return res.status(400).json({
                error: true,
                mensaje: 'La sucursal destino debe ser diferente a la origen'
            });
        }

        // Verificar stock suficiente
        if (producto.stockActual < cantidad) {
            await session.abortTransaction();
            return res.status(400).json({
                error: true,
                mensaje: `Stock insuficiente. Disponible: ${producto.stockActual}`
            });
        }

        const stockAnterior = producto.stockActual;
        producto.stockActual -= parseInt(cantidad);
        await producto.save({ session });

        // Registrar salida en sucursal origen
        await MovimientoInventario.create([{
            producto: producto._id,
            nombreProducto: producto.nombre,
            codigoProducto: producto.codigo,
            tipoMovimiento: 'TRANSFERENCIA_SALIDA',
            cantidad: parseInt(cantidad),
            stockAnterior,
            stockNuevo: producto.stockActual,
            sucursal: producto.sucursal._id,
            sucursalDestino: sucursalDestinoDoc._id,
            usuario: req.usuario._id,
            nombreUsuario: req.usuario.nombre,
            motivo: `Transferencia a ${sucursalDestinoDoc.nombre}`,
            observaciones,
            costoUnitario: producto.precioCompra
        }], { session });

        // Buscar o crear producto en sucursal destino
        let productoDestino = await Producto.findOne({
            codigo: producto.codigo,
            sucursal: sucursalDestinoDoc._id
        }).session(session);

        if (!productoDestino) {
            // Crear producto en sucursal destino si no existe
            productoDestino = await Producto.create([{
                codigo: producto.codigo,
                nombre: producto.nombre,
                descripcion: producto.descripcion,
                categoria: producto.categoria,
                genero: producto.genero,
                talla: producto.talla,
                color: producto.color,
                precioCompra: producto.precioCompra,
                precioVenta: producto.precioVenta,
                stockActual: parseInt(cantidad),
                stockMinimo: producto.stockMinimo,
                sucursal: sucursalDestinoDoc._id,
                proveedor: producto.proveedor,
                imagen: producto.imagen
            }], { session });

            productoDestino = productoDestino[0];

            // Registrar entrada en sucursal destino
            await MovimientoInventario.create([{
                producto: productoDestino._id,
                nombreProducto: productoDestino.nombre,
                codigoProducto: productoDestino.codigo,
                tipoMovimiento: 'TRANSFERENCIA_ENTRADA',
                cantidad: parseInt(cantidad),
                stockAnterior: 0,
                stockNuevo: parseInt(cantidad),
                sucursal: sucursalDestinoDoc._id,
                usuario: req.usuario._id,
                nombreUsuario: req.usuario.nombre,
                motivo: `Transferencia desde ${producto.sucursal.nombre}`,
                observaciones,
                costoUnitario: producto.precioCompra
            }], { session });
        } else {
            // Actualizar stock en sucursal destino
            const stockAnteriorDestino = productoDestino.stockActual;
            productoDestino.stockActual += parseInt(cantidad);
            await productoDestino.save({ session });

            await MovimientoInventario.create([{
                producto: productoDestino._id,
                nombreProducto: productoDestino.nombre,
                codigoProducto: productoDestino.codigo,
                tipoMovimiento: 'TRANSFERENCIA_ENTRADA',
                cantidad: parseInt(cantidad),
                stockAnterior: stockAnteriorDestino,
                stockNuevo: productoDestino.stockActual,
                sucursal: sucursalDestinoDoc._id,
                usuario: req.usuario._id,
                nombreUsuario: req.usuario.nombre,
                motivo: `Transferencia desde ${producto.sucursal.nombre}`,
                observaciones,
                costoUnitario: producto.precioCompra
            }], { session });
        }

        await session.commitTransaction();

        // Formatear respuesta
        const productoOrigenRespuesta = producto.toObject();
        productoOrigenRespuesta.sucursal = producto.sucursal ? {
            id: producto.sucursal._id,
            nombre: producto.sucursal.nombre
        } : null;

        const productoDestinoRespuesta = productoDestino.toObject();
        productoDestinoRespuesta.sucursal = {
            id: sucursalDestinoDoc._id,
            nombre: sucursalDestinoDoc.nombre
        };

        res.status(201).json({
            success: true,
            mensaje: 'Transferencia registrada exitosamente',
            data: {
                productoOrigen: productoOrigenRespuesta,
                productoDestino: productoDestinoRespuesta
            }
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Error al registrar transferencia:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al registrar transferencia',
            detalle: error.message
        });
    } finally {
        session.endSession();
    }
};

// @desc    Registrar merma o pérdida
// @route   POST /api/inventario/merma
// @access  Private (Admin/Gerente)
const registrarMerma = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            productoId,
            cantidad,
            motivo,
            observaciones
        } = req.body;

        if (!productoId || !cantidad || !motivo) {
            await session.abortTransaction();
            return res.status(400).json({
                error: true,
                mensaje: 'ProductoId, cantidad y motivo son obligatorios'
            });
        }

        const producto = await Producto.findById(productoId)
            .populate('sucursal')
            .session(session);

        if (!producto) {
            await session.abortTransaction();
            return res.status(404).json({
                error: true,
                mensaje: 'Producto no encontrado'
            });
        }

        if (producto.stockActual < cantidad) {
            await session.abortTransaction();
            return res.status(400).json({
                error: true,
                mensaje: `Stock insuficiente. Disponible: ${producto.stockActual}`
            });
        }

        const stockAnterior = producto.stockActual;
        producto.stockActual -= parseInt(cantidad);
        await producto.save({ session });

        const movimiento = await MovimientoInventario.create([{
            producto: producto._id,
            nombreProducto: producto.nombre,
            codigoProducto: producto.codigo,
            tipoMovimiento: 'MERMA',
            cantidad: parseInt(cantidad),
            stockAnterior,
            stockNuevo: producto.stockActual,
            sucursal: producto.sucursal._id,
            usuario: req.usuario._id,
            nombreUsuario: req.usuario.nombre,
            motivo,
            observaciones,
            costoUnitario: producto.precioCompra
        }], { session });

        await session.commitTransaction();

        const productoRespuesta = producto.toObject();
        productoRespuesta.sucursal = producto.sucursal ? {
            id: producto.sucursal._id,
            nombre: producto.sucursal.nombre
        } : null;

        res.status(201).json({
            success: true,
            mensaje: 'Merma registrada exitosamente',
            data: {
                producto: productoRespuesta,
                movimiento: movimiento[0]
            }
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Error al registrar merma:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al registrar merma',
            detalle: error.message
        });
    } finally {
        session.endSession();
    }
};

// @desc    Obtener historial de movimientos
// @route   GET /api/inventario/movimientos
// @access  Private
const obtenerMovimientos = async (req, res) => {
    try {
        const {
            productoId,
            sucursal,
            tipoMovimiento,
            fechaInicio,
            fechaFin,
            page = 1,
            limit = 50
        } = req.query;

        const filtros = {};

        if (productoId) filtros.producto = productoId;
        if (sucursal) filtros.sucursal = sucursal;
        if (tipoMovimiento) filtros.tipoMovimiento = tipoMovimiento;

        // Filtro por fechas
        if (fechaInicio || fechaFin) {
            filtros.createdAt = {};
            if (fechaInicio) filtros.createdAt.$gte = new Date(fechaInicio);
            if (fechaFin) {
                const fechaFinAjustada = new Date(fechaFin);
                fechaFinAjustada.setHours(23, 59, 59, 999);
                filtros.createdAt.$lte = fechaFinAjustada;
            }
        }

        const skip = (page - 1) * limit;

        const movimientos = await MovimientoInventario.find(filtros)
            .populate('producto')
            .populate('usuario', 'nombre email')
            .populate('sucursal')
            .populate('sucursalDestino')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip);

        // Formatear respuesta con sucursales
        const movimientosFormateados = movimientos.map(m => {
            const mov = m.toObject();
            if (mov.sucursal) {
                mov.sucursal = {
                    id: mov.sucursal._id,
                    nombre: mov.sucursal.nombre
                };
            }
            if (mov.sucursalDestino) {
                mov.sucursalDestino = {
                    id: mov.sucursalDestino._id,
                    nombre: mov.sucursalDestino.nombre
                };
            }
            return mov;
        });

        const total = await MovimientoInventario.countDocuments(filtros);

        res.json({
            success: true,
            data: movimientosFormateados,
            paginacion: {
                total,
                pagina: parseInt(page),
                limite: parseInt(limit),
                totalPaginas: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Error al obtener movimientos:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener movimientos de inventario',
            detalle: error.message
        });
    }
};

// @desc    Obtener movimientos de un producto específico
// @route   GET /api/inventario/movimientos/producto/:productoId
// @access  Private
const obtenerMovimientosProducto = async (req, res) => {
    try {
        const { limit = 20 } = req.query;

        const movimientos = await MovimientoInventario.find({
            producto: req.params.productoId
        })
            .populate('usuario', 'nombre')
            .populate('sucursal')
            .populate('sucursalDestino')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        // Formatear respuesta con sucursales
        const movimientosFormateados = movimientos.map(m => {
            const mov = m.toObject();
            if (mov.sucursal) {
                mov.sucursal = {
                    id: mov.sucursal._id,
                    nombre: mov.sucursal.nombre
                };
            }
            if (mov.sucursalDestino) {
                mov.sucursalDestino = {
                    id: mov.sucursalDestino._id,
                    nombre: mov.sucursalDestino.nombre
                };
            }
            return mov;
        });

        res.json({
            success: true,
            total: movimientosFormateados.length,
            data: movimientosFormateados
        });

    } catch (error) {
        console.error('Error al obtener movimientos del producto:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener movimientos del producto',
            detalle: error.message
        });
    }
};

// @desc    Obtener valoración de inventario
// @route   GET /api/inventario/valoracion
// @access  Private (Admin/Gerente)
const obtenerValoracionInventario = async (req, res) => {
    try {
        const { sucursal } = req.query;

        const filtros = { activo: true };
        if (sucursal) filtros.sucursal = mongoose.Types.ObjectId(sucursal);

        const valoracion = await Producto.aggregate([
            { $match: filtros },
            {
                $lookup: {
                    from: 'sucursales',
                    localField: 'sucursal',
                    foreignField: '_id',
                    as: 'sucursalInfo'
                }
            },
            { $unwind: '$sucursalInfo' },
            {
                $group: {
                    _id: '$sucursal',
                    nombreSucursal: { $first: '$sucursalInfo.nombre' },
                    totalProductos: { $sum: 1 },
                    totalUnidades: { $sum: '$stockActual' },
                    valorCosto: {
                        $sum: { $multiply: ['$stockActual', '$precioCompra'] }
                    },
                    valorVenta: {
                        $sum: { $multiply: ['$stockActual', '$precioVenta'] }
                    }
                }
            },
            { $sort: { nombreSucursal: 1 } }
        ]);

        // Formatear con estructura sucursal {id, nombre}
        const valoracionFormateada = valoracion.map(v => ({
            sucursal: {
                id: v._id,
                nombre: v.nombreSucursal
            },
            totalProductos: v.totalProductos,
            totalUnidades: v.totalUnidades,
            valorCosto: v.valorCosto,
            valorVenta: v.valorVenta
        }));

        // Calcular totales generales
        const totales = valoracionFormateada.reduce((acc, item) => ({
            totalProductos: acc.totalProductos + item.totalProductos,
            totalUnidades: acc.totalUnidades + item.totalUnidades,
            valorCosto: acc.valorCosto + item.valorCosto,
            valorVenta: acc.valorVenta + item.valorVenta
        }), { totalProductos: 0, totalUnidades: 0, valorCosto: 0, valorVenta: 0 });

        const utilidadPotencial = totales.valorVenta - totales.valorCosto;
        const margenPotencial = totales.valorVenta > 0
            ? ((utilidadPotencial / totales.valorVenta) * 100).toFixed(2)
            : 0;

        res.json({
            success: true,
            totales: {
                ...totales,
                utilidadPotencial,
                margenPotencial: parseFloat(margenPotencial)
            },
            porSucursal: valoracionFormateada
        });

    } catch (error) {
        console.error('Error al obtener valoración:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener valoración de inventario',
            detalle: error.message
        });
    }
};

module.exports = {
    registrarEntrada,
    registrarSalida,
    registrarAjuste,
    registrarTransferencia,
    registrarMerma,
    obtenerMovimientos,
    obtenerMovimientosProducto,
    obtenerValoracionInventario
};