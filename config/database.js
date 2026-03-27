const mongoose = require('mongoose');

/**
 * Establece la conexión con MongoDB.
 * La URI se lee desde la variable de entorno MONGO_URI definida en .env
 */
async function conectarDB() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB conectado: ${process.env.MONGO_URI}`);
}

module.exports = conectarDB;
