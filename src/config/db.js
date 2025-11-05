const mongoose = require('mongoose');

// Configuración de la conexión a MongoDB Atlas
const conectarDB = async () => {
    try {
        // Intento de conexión a la base de datos
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('Conexión exitosa a MongoDB Atlas');
        
        // Manejo de eventos de la conexión
        mongoose.connection.on('error', (err) => {
            console.error('Error en la conexión a MongoDB:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.warn('MongoDB desconectado');
        });
        
    } catch (error) {
        console.error('Error al conectar a la base de datos:', error.message);
        // En producción esto detiene el servidor si no hay BD
        process.exit(1);
    }
};

module.exports = conectarDB;