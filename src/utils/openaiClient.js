// utils/openaiClient.js
const OpenAI = require('openai');

// Verificar que la API key exista
if (!process.env.OPENAI_API_KEY) {
    console.error('⚠️  ERROR: OPENAI_API_KEY no está configurada en el archivo .env');
    console.error('Por favor, agrega la siguiente línea a tu archivo .env:');
    console.error('OPENAI_API_KEY=tu-clave-api-aqui');
}

// Inicializar el cliente de OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Exportar el cliente configurado
module.exports = openai;