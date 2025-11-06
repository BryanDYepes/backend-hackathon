const Sucursal = require('../models/Sucursal.model');
const Producto = require('../models/Producto.model');
const Venta = require('../models/Venta.model');
const {
    obtenerEstadisticasSucursal,
    compararSucursales
} = require('../services/sucursal.service');

// @desc    Obtener todas las sucursales
// @route   GET /api/sucursales
// @access  Private
const obtenerSucursales = async (req, res) => {
    try {
        const { activo, ciudad, page = 1, limit = 50 } = req.query;
        
        const filtros = {};
        if (activo !== undefined) filtros.activo = activo === 'true';
        if (ciudad) filtros.ciudad = ciudad;
        
        const skip = (page - 1) * limit;
        
        const sucursales = await Sucursal.find(filtros)
            .populate('gerente', 'nombre email')
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
            .populate('gerente', 'nombre email telefono');
        
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
        console.error('Error al obtener sucursal:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener sucursal',
            detalle: error.message
        });
    }
};

// @desc    Obtener sucursal por código
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
            ciudad,
            direccion,
            telefono,
            email,
            gerente,
            nombreGerente,
            horario,
            metrosCuadrados,
            capacidadAlmacenamiento,
            configuracion,
            observaciones
        } = req.body;
        
        // Validar campos obligatorios
        if (!codigo || !nombre || !ciudad || !direccion || !telefono) {
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
        
        // Crear la sucursal
        const sucursal = await Sucursal.create({
            codigo: codigo.toUpperCase(),
            nombre,
            ciudad,
            direccion,
            telefono,
            email,
            gerente,
            nombreGerente,
            horario,
            metrosCuadrados,
            capacidadAlmacenamiento,
            configuracion,
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
// @access  Private (Admin/Gerente)
const actualizarSucursal = async (req, res) => {
    try {
        const sucursal = await Sucursal.findById(req.params.id);
        
        if (!sucursal) {
            return res.status(404).json({
                error: true,
                mensaje: 'Sucursal no encontrada'
            });
        }
        
        // Campos actualizables
        const camposActualizables = [
            'nombre', 'ciudad', 'direccion', 'telefono', 'email',
            'gerente', 'nombreGerente', 'horario', 'metrosCuadrados',
            'capacidadAlmacenamiento', 'activo', 'configuracion', 'observaciones'
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
        const productosCount = await Producto.countDocuments({ 
            sucursal: sucursal.nombre,
            activo: true
        });
        
        if (productosCount > 0) {
            return res.status(400).json({
                error: true,
                mensaje: `No se puede eliminar. La sucursal tiene ${productosCount} productos activos asociados`
            });
        }
        
        // Soft delete
        sucursal.activo = false;
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
const obtenerEstadisticas = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.query;
        
        const sucursal = await Sucursal.findById(req.params.id);
        
        if (!sucursal) {
            return res.status(404).json({
                error: true,
                mensaje: 'Sucursal no encontrada'
            });
        }
        
        const estadisticas = await obtenerEstadisticasSucursal(
            sucursal.nombre,
            fechaInicio,
            fechaFin
        );
        
        res.json({
            success: true,
            sucursal: {
                codigo: sucursal.codigo,
                nombre: sucursal.nombre,
                ciudad: sucursal.ciudad
            },
            ...estadisticas
        });
        
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener estadísticas',
            detalle: error.message
        });
    }
};

// @desc    Obtener listado de ciudades con sucursales
// @route   GET /api/sucursales/ciudades/listado
// @access  Private
const obtenerCiudades = async (req, res) => {
    try {
        const ciudades = await Sucursal.distinct('ciudad', { activo: true });
        
        // Contar sucursales por ciudad
        const ciudadesConConteo = await Promise.all(
            ciudades.map(async (ciudad) => {
                const count = await Sucursal.countDocuments({ 
                    ciudad, 
                    activo: true 
                });
                return { ciudad, sucursales: count };
            })
        );
        
        res.json({
            success: true,
            total: ciudades.length,
            data: ciudadesConConteo.sort((a, b) => b.sucursales - a.sucursales)
        });
        
    } catch (error) {
        console.error('Error al obtener ciudades:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al obtener ciudades',
            detalle: error.message
        });
    }
};

// @desc    Comparar rendimiento entre sucursales
// @route   GET /api/sucursales/comparativo
// @access  Private (Admin/Gerente)
const obtenerComparativo = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.query;
        
        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                error: true,
                mensaje: 'Debe proporcionar fechaInicio y fechaFin'
            });
        }
        
        const comparativo = await compararSucursales(fechaInicio, fechaFin);
        
        res.json({
            success: true,
            periodo: {
                inicio: new Date(fechaInicio).toLocaleDateString('es-CO'),
                fin: new Date(fechaFin).toLocaleDateString('es-CO')
            },
            data: comparativo
        });
        
    } catch (error) {
        console.error('Error al comparar sucursales:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al comparar sucursales',
            detalle: error.message
        });
    }
};

// @desc    Actualizar estadísticas de sucursal
// @route   PATCH /api/sucursales/:id/actualizar-estadisticas
// @access  Private (Sistema)
const actualizarEstadisticasSucursal = async (req, res) => {
    try {
        const sucursal = await Sucursal.findById(req.params.id);
        
        if (!sucursal) {
            return res.status(404).json({
                error: true,
                mensaje: 'Sucursal no encontrada'
            });
        }
        
        // Calcular total de productos
        const totalProductos = await Producto.countDocuments({
            sucursal: sucursal.nombre,
            activo: true
        });
        
        // Calcular valor del inventario
        const valorInventario = await Producto.aggregate([
            {
                $match: {
                    sucursal: sucursal.nombre,
                    activo: true
                }
            },
            {
                $group: {
                    _id: null,
                    valor: { $sum: { $multiply: ['$stockActual', '$precioCompra'] } }
                }
            }
        ]);
        
        // Calcular ventas del mes actual
        const inicioMes = new Date();
        inicioMes.setDate(1);
        inicioMes.setHours(0, 0, 0, 0);
        
        const ventasMes = await Venta.aggregate([
            {
                $match: {
                    sucursal: sucursal.nombre,
                    estadoVenta: 'Completada',
                    fecha: { $gte: inicioMes }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$total' }
                }
            }
        ]);
        
        // Actualizar estadísticas
        sucursal.estadisticas = {
            totalProductos,
            valorInventario: valorInventario[0]?.valor || 0,
            ventasMesActual: ventasMes[0]?.total || 0,
            ultimaActualizacion: new Date()
        };
        
        await sucursal.save();
        
        res.json({
            success: true,
            mensaje: 'Estadísticas actualizadas',
            data: sucursal.estadisticas
        });
        
    } catch (error) {
        console.error('Error al actualizar estadísticas:', error);
        res.status(500).json({
            error: true,
            mensaje: 'Error al actualizar estadísticas',
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
    obtenerEstadisticas,
    obtenerCiudades,
    obtenerComparativo,
    actualizarEstadisticasSucursal
};