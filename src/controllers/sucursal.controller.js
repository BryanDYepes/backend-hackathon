const Sucursal = require('../models/Sucursal.model');
const Producto = require('../models/Producto.model');
const Venta = require('../models/Venta.model');
const Usuario = require('../models/Usuario.model');

// @desc    Obtener todas las sucursales
// @route   GET /api/sucursales
// @access  Private
const obtenerSucursales = async (req, res) => {
    try {
        const { estado, ciudad, page = 1, limit = 50 } = req.query;

        // Construir filtros
        const filtros = {};
        if (estado) filtros.estado = estado;
        if (ciudad) filtros['direccion.ciudad'] = ciudad;

        const skip = (page - 1) * limit;

        const sucursales = await Sucursal.find(filtros)
            .populate('gerente', 'nombre email telefono')
            .sort({ nombre: 1 })
            .limit(parseInt(limit))
            .skip(skip);

        const total = await Sucursal.countDocuments(filtros);

        res.json({
            success: true,
            data: sucursales,
            paginacion: {
                total,
                pagina: parseInt(page),
                limite: parseInt(limit),
                totalPaginas: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Error al obtener sucursales:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener sucursales',
            detalle: error.message
        });
    }
};

// @desc    Obtener una sucursal por ID
// @route   GET /api/sucursales/:id
// @access  Private
const obtenerSucursalPorId = async (req, res) => {
    try {
        const sucursal = await Sucursal.findById(req.params.id)
            .populate('gerente', 'nombre email telefono rol');

        if (!sucursal) {
            return res.status(404).json({
                error: true,
                mensaje: 'Sucursal no encontrada'
            });
        }

        // Obtener estadísticas básicas de la sucursal
        const totalProductos = await Producto.countDocuments({
            sucursal: sucursal._id,
            activo: true
        });

        const totalStockUnidades = await Producto.aggregate([
            {
                $match: {
                    sucursal: sucursal._id,
                    activo: true
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$stockActual' }
                }
            }
        ]);

        // Ventas del mes actual
        const inicioMes = new Date();
        inicioMes.setDate(1);
        inicioMes.setHours(0, 0, 0, 0);

        const ventasMes = await Venta.countDocuments({
            sucursal: sucursal._id,
            estadoVenta: 'Completada',
            fecha: { $gte: inicioMes }
        });

        res.json({
            success: true,
            data: {
                ...sucursal.toObject(),
                estadisticas: {
                    totalProductos,
                    totalStockUnidades: totalStockUnidades[0]?.total || 0,
                    ventasMesActual: ventasMes
                }
            }
        });

    } catch (error) {
        console.error('Error al obtener sucursal:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener sucursal',
            detalle: error.message
        });
    }
};

// @desc    Buscar sucursal por código
// @route   GET /api/sucursales/codigo/:codigo
// @access  Private
const obtenerSucursalPorCodigo = async (req, res) => {
    try {
        const sucursal = await Sucursal.findOne({
            codigo: req.params.codigo.toUpperCase()
        }).populate('gerente', 'nombre email');

        if (!sucursal) {
            return res.status(404).json({
                error: true,
                mensaje: 'Sucursal no encontrada'
            });
        }

        res.json({
            success: true,
            data: sucursal
        });

    } catch (error) {
        console.error('Error al buscar sucursal:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al buscar sucursal',
            detalle: error.message
        });
    }
};

// @desc    Crear nueva sucursal
// @route   POST /api/sucursales
// @access  Private (Admin)
const crearSucursal = async (req, res) => {
    try {
        const {
            codigo,
            nombre,
            direccion,
            contacto,
            gerenteId,
            horario,
            capacidad,
            fechaApertura,
            observaciones
        } = req.body;

        // Validar campos obligatorios
        if (!codigo || !nombre || !direccion || !contacto) {
            return res.status(400).json({
                error: true,
                mensaje: 'Por favor complete todos los campos obligatorios'
            });
        }

        // Verificar si el código ya existe
        const sucursalExiste = await Sucursal.findOne({
            codigo: codigo.toUpperCase()
        });

        if (sucursalExiste) {
            return res.status(400).json({
                error: true,
                mensaje: 'Ya existe una sucursal con ese código'
            });
        }

        // Si se proporciona gerente, verificar que existe
        let nombreGerente = null;
        if (gerenteId) {
            const gerente = await Usuario.findById(gerenteId);
            if (!gerente) {
                return res.status(404).json({
                    error: true,
                    mensaje: 'Gerente no encontrado'
                });
            }
            nombreGerente = gerente.nombre;
        }

        // Crear la sucursal
        const sucursal = await Sucursal.create({
            codigo: codigo.toUpperCase(),
            nombre,
            direccion,
            contacto,
            gerente: gerenteId,
            nombreGerente,
            horario,
            capacidad,
            fechaApertura: fechaApertura || Date.now(),
            observaciones
        });

        res.status(201).json({
            success: true,
            mensaje: 'Sucursal creada exitosamente',
            data: sucursal
        });

    } catch (error) {
        console.error('Error al crear sucursal:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al crear sucursal',
            detalle: error.message
        });
    }
};

// @desc    Actualizar sucursal
// @route   PUT /api/sucursales/:id
// @access  Private (Admin)
const actualizarSucursal = async (req, res) => {
    try {
        const sucursal = await Sucursal.findById(req.params.id);

        if (!sucursal) {
            return res.status(404).json({
                error: true,
                mensaje: 'Sucursal no encontrada'
            });
        }

        // Si se actualiza el gerente, obtener su nombre
        if (req.body.gerenteId && req.body.gerenteId !== sucursal.gerente?.toString()) {
            const gerente = await Usuario.findById(req.body.gerenteId);
            if (gerente) {
                req.body.gerente = req.body.gerenteId;
                req.body.nombreGerente = gerente.nombre;
            }
        }

        // Actualizar campos
        const camposActualizables = [
            'nombre', 'direccion', 'contacto', 'gerente', 'nombreGerente',
            'horario', 'capacidad', 'estado', 'observaciones'
        ];

        camposActualizables.forEach(campo => {
            if (req.body[campo] !== undefined) {
                sucursal[campo] = req.body[campo];
            }
        });

        await sucursal.save();

        res.json({
            success: true,
            mensaje: 'Sucursal actualizada exitosamente',
            data: sucursal
        });

    } catch (error) {
        console.error('Error al actualizar sucursal:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al actualizar sucursal',
            detalle: error.message
        });
    }
};

// @desc    Eliminar sucursal (soft delete)
// @route   DELETE /api/sucursales/:id
// @access  Private (Admin)
const eliminarSucursal = async (req, res) => {
    try {
        const sucursal = await Sucursal.findById(req.params.id);

        if (!sucursal) {
            return res.status(404).json({
                error: true,
                mensaje: 'Sucursal no encontrada'
            });
        }

        // Verificar si tiene productos asociados
        const productosAsociados = await Producto.countDocuments({
            sucursal: sucursal._id,
            activo: true
        });

        if (productosAsociados > 0) {
            return res.status(400).json({
                error: true,
                mensaje: `No se puede eliminar la sucursal porque tiene ${productosAsociados} productos activos asociados`
            });
        }

        // Soft delete: marcar como inactiva
        sucursal.estado = 'Inactiva';
        await sucursal.save();

        res.json({
            success: true,
            mensaje: 'Sucursal desactivada exitosamente'
        });

    } catch (error) {
        console.error('Error al eliminar sucursal:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al eliminar sucursal',
            detalle: error.message
        });
    }
};

// @desc    Obtener estadísticas de una sucursal
// @route   GET /api/sucursales/:id/estadisticas
// @access  Private
const obtenerEstadisticasSucursal = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.query;

        const sucursal = await Sucursal.findById(req.params.id);

        if (!sucursal) {
            return res.status(404).json({
                error: true,
                mensaje: 'Sucursal no encontrada'
            });
        }

        // Definir rango de fechas
        const inicio = fechaInicio ? new Date(fechaInicio) : new Date(new Date().setDate(1));
        inicio.setHours(0, 0, 0, 0);

        const fin = fechaFin ? new Date(fechaFin) : new Date();
        fin.setHours(23, 59, 59, 999);

        // Estadísticas de inventario
        const inventario = await Producto.aggregate([
            {
                $match: {
                    sucursal: sucursal._id,
                    activo: true
                }
            },
            {
                $group: {
                    _id: null,
                    totalProductos: { $sum: 1 },
                    totalUnidades: { $sum: '$stockActual' },
                    valorInventario: {
                        $sum: { $multiply: ['$stockActual', '$precioCompra'] }
                    },
                    productosStockBajo: {
                        $sum: { $cond: ['$alertaStock', 1, 0] }
                    }
                }
            }
        ]);

        // Estadísticas de ventas
        const ventas = await Venta.aggregate([
            {
                $match: {
                    sucursal: sucursal._id,
                    estadoVenta: 'Completada',
                    fecha: { $gte: inicio, $lte: fin }
                }
            },
            {
                $group: {
                    _id: null,
                    totalVentas: { $sum: 1 },
                    totalIngresos: { $sum: '$total' },
                    promedioVenta: { $avg: '$total' }
                }
            }
        ]);

        // Top 5 productos más vendidos en esta sucursal
        const topProductos = await Venta.aggregate([
            {
                $match: {
                    sucursal: sucursal._id,
                    estadoVenta: 'Completada',
                    fecha: { $gte: inicio, $lte: fin }
                }
            },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.producto',
                    nombreProducto: { $first: '$items.nombreProducto' },
                    cantidadVendida: { $sum: '$items.cantidad' },
                    totalIngresos: { $sum: '$items.subtotal' }
                }
            },
            { $sort: { cantidadVendida: -1 } },
            { $limit: 5 }
        ]);

        res.json({
            success: true,
            sucursal: {
                nombre: sucursal._id,
                codigo: sucursal.codigo
            },
            periodo: {
                inicio: inicio.toLocaleDateString('es-CO'),
                fin: fin.toLocaleDateString('es-CO')
            },
            inventario: inventario[0] || {
                totalProductos: 0,
                totalUnidades: 0,
                valorInventario: 0,
                productosStockBajo: 0
            },
            ventas: ventas[0] || {
                totalVentas: 0,
                totalIngresos: 0,
                promedioVenta: 0
            },
            topProductos
        });

    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener estadísticas de la sucursal',
            detalle: error.message
        });
    }
};

// @desc    Comparar rendimiento entre sucursales
// @route   GET /api/sucursales/comparar-rendimiento
// @access  Private (Admin/Gerente)
const compararRendimiento = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.query;

        const inicio = fechaInicio ? new Date(fechaInicio) : new Date(new Date().setDate(1));
        inicio.setHours(0, 0, 0, 0);

        const fin = fechaFin ? new Date(fechaFin) : new Date();
        fin.setHours(23, 59, 59, 999);

        // Obtener ventas por sucursal
        const ventasPorSucursal = await Venta.aggregate([
            {
                $match: {
                    estadoVenta: 'Completada',
                    fecha: { $gte: inicio, $lte: fin }
                }
            },
            {
                $group: {
                    _id: '$sucursal',
                    totalVentas: { $sum: 1 },
                    totalIngresos: { $sum: '$total' },
                    promedioVenta: { $avg: '$total' }
                }
            },
            { $sort: { totalIngresos: -1 } }
        ]);

        // Obtener info de inventario por sucursal
        const inventarioPorSucursal = await Producto.aggregate([
            {
                $match: { activo: true }
            },
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
                    _id: '$sucursalInfo.nombre',
                    totalProductos: { $sum: 1 },
                    valorInventario: {
                        $sum: { $multiply: ['$stockActual', '$precioCompra'] }
                    }
                }
            }
        ]);

        // Combinar datos
        const comparativo = ventasPorSucursal.map(venta => {
            const inventario = inventarioPorSucursal.find(
                inv => inv._id === venta._id
            ) || { totalProductos: 0, valorInventario: 0 };

            return {
                sucursal: venta._id,
                ventas: {
                    total: venta.totalVentas,
                    ingresos: venta.totalIngresos,
                    promedio: venta.promedioVenta
                },
                inventario: {
                    totalProductos: inventario.totalProductos,
                    valorInventario: inventario.valorInventario
                },
                eficiencia: inventario.valorInventario > 0
                    ? ((venta.totalIngresos / inventario.valorInventario) * 100).toFixed(2)
                    : 0
            };
        });

        res.json({
            success: true,
            periodo: {
                inicio: inicio.toLocaleDateString('es-CO'),
                fin: fin.toLocaleDateString('es-CO')
            },
            data: comparativo
        });

    } catch (error) {
        console.error('Error al comparar rendimiento:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al comparar rendimiento de sucursales',
            detalle: error.message
        });
    }
};

module.exports = {
    obtenerSucursales,
    obtenerSucursalPorId,
    obtenerSucursalPorCodigo,
    crearSucursal,
    actualizarSucursal,
    eliminarSucursal,
    obtenerEstadisticasSucursal,
    compararRendimiento
};