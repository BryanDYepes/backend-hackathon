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

app.get('/panel/producto/:id', (req, res) => {
  // Servimos un HTML simple, que consulta /api/productos/:id
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
      <div id="root">
        <div class="card" id="card">
          <h2>Cargando producto...</h2>
        </div>
      </div>

      <script>
        (async () => {
          const id = "${req.params.id}";
          try {
            const res = await fetch('/api/productos/' + id);
            if (!res.ok) throw new Error('No se encontró el producto');
            const json = await res.json();
            const p = json.data;
            const root = document.getElementById('card');
            root.innerHTML = \`
              <h1>\${p.nombre}</h1>
              \${p.imagen ? '<img class="product-img" src="'+p.imagen+'" alt="imagen"/>' : ''}
              <p><span class="label">Código:</span> \${p.codigo}</p>
              <p><span class="label">Descripción:</span> \${p.descripcion || '-'}</p>
              <p><span class="label">Categoría:</span> \${p.categoria || '-'}</p>
              <p><span class="label">Género:</span> \${p.genero || '-'}</p>
              <p><span class="label">Talla:</span> \${p.talla || '-'}</p>
              <p><span class="label">Color:</span> \${p.color || '-'}</p>
              <p><span class="label">Precio venta:</span> \${p.precioVenta || '-'}</p>
              <p><span class="label">Stock actual:</span> \${p.stockActual || 0}</p>
            \`;
          } catch (err) {
            document.getElementById('card').innerHTML = '<h2>Error cargando producto</h2><p>'+err.message+'</p>';
          }
        })();
      </script>
    </body>
    </html>
  `);
});

module.exports = app;