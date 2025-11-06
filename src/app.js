const path = require('path');
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
app.use(express.static(path.join(__dirname, 'public'))); // sirve /public

const imagenesPermitidas = [
  'https://d1fufvy4xao6k9.cloudfront.net',
  'https://uniformesyarutex.com',
  'https://gentefashiongroup.com',
  'https://solco.com.ar',
  'https://cdn0.matrimonio.com.co',
  'https://boral.com.co',
  'https://www.atributo.co',
  'https://www.oxap.com.co',
  'https://marketingpersonalco.vtexassets.com',
  'https://www.gef.co',
  'https://tottoco.vtexassets.com',
  'https://encrypted-tbn0.gstatic.com',
  'https://www.hurlintongnf.co',
  'https://estilofit.com.co',
  'https://www.sevenseven.com',
  'https://tennis.vtexassets.com',
  'https://www.ostu.com',
  'https://img.kwcdn.com',
  'https://cdn.baguer.co',
  'https://m.media-amazon.com',
  'https://armatura.com.co',
  'https://lukshop.vtexassets.com',
  'https://www.apostolqc.com',
  'https://superdrycolombia.vtexassets.com',
  'https://chevignon.vtexassets.com',
  'https://calvincolombia.vtexassets.com',
  'https://kidsrepublic.com.co',
  'https://colorkids.com.co',
  'https://ae-pic-a1.aliexpress-media.com',
  'https://i.pinimg.com',
  'https://daisagirls.com'
];

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", ...imagenesPermitidas]
      }
    }
  })
);


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
app.use('/api/sucursales', require('./routes/sucursal.routes'));
app.use('/api/productos', require('./routes/producto.routes'));
app.use('/api/ventas', require('./routes/venta.routes'));
app.use('/api/reportes', require('./routes/reporte.routes'));
app.use('/api/analytics', require('./routes/analytics.routes'));
app.use('/api/inventario', require('./routes/inventario.routes'));
// Panel del producto
app.get('/panel/producto/:id', (req, res) => {
  // Servimos HTML mínimo, JS externo hace fetch
  res.send(`
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>Producto - Panel</title>
      <style>
        body{font-family: Arial, Helvetica, sans-serif; padding:20px; max-width:720px; margin:auto;}
        .card{border:1px solid #ddd; padding:20px; border-radius:8px;}
        img.product-img{max-width:200px; display:block; margin-bottom:10px;}
        .label{font-weight:700;}
      </style>
    </head>
    <body>
      <div id="root" data-id="${req.params.id}">
        <div class="card" id="card">
          <h2>Cargando producto...</h2>
        </div>
      </div>

      <script src="/js/panel.js"></script>
    </body>
    </html>
  `);
});



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
        console.log(`Servidor corriendo en puerto ${PORT}`);
        console.log(`Ambiente: ${process.env.NODE_ENV || 'desarrollo'}`);
    });
}

module.exports = app;