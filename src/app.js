const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
require('dotenv').config();

const conectarDB = require('./config/db');

// Inicialización de express
const app = express();

// Conexión a la base de datos
conectarDB();

// Middlewares globales
app.use(helmet()); // Seguridad básica en headers HTTP
app.use(cors()); // Permitir solicitudes desde el frontend
app.use(express.json()); // Parsear JSON en el body
app.use(express.urlencoded({ extended: true })); // Para form-data
app.use(morgan('dev')); // Logging de peticiones HTTP en desarrollo

// Ruta de prueba para verificar que el servidor está funcionando
app.get('/', (req, res) => {
    res.json({ 
        mensaje: 'API funcionando correctamente',
        version: '1.0.0',
        ambiente: process.env.NODE_ENV || 'desarrollo'
    });
});

// Rutas de la aplicación
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/productos', require('./routes/producto.routes'));
app.use('/api/ventas', require('./routes/venta.routes'));
app.use('/api/reportes', require('./routes/reporte.routes'));
app.use('/api/analytics', require('./routes/analytics.routes'));
app.use('/api/inventario', require('./routes/inventario.routes'));
app.use('/api/sucursales', require('./routes/sucursal.routes'));

// ========================================
// RUTA DE INTELIGENCIA ARTIFICIAL (NUEVA)
// ========================================
app.use('/api/ia', require('./routes/ia.routes'));

// Manejo de rutas no encontradas
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Ruta no encontrada',
        mensaje: 'La ruta solicitada no existe en esta API'
    });
});

// Middleware de manejo de errores global
app.use((err, req, res, next) => {
    console.error('Error capturado:', err.stack);
    
    res.status(err.status || 500).json({
        error: true,
        mensaje: err.message || 'Error interno del servidor',
        ...(process.env.NODE_ENV === 'desarrollo' && { stack: err.stack })
    });
});

// Puerto del servidor
const PORT = process.env.PORT || 5000;

// Iniciar el servidor solo si no estamos en ambiente de testing
if (process.env.NODE_ENV !== 'trix_database') {
    app.listen(PORT, () => {
        console.log(`✅ Servidor corriendo en puerto ${PORT}`);
        console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'desarrollo'}`);
        console.log(`🤖 Rutas IA disponibles en: http://localhost:${PORT}/api/ia`);
    });
}

module.exports = app;