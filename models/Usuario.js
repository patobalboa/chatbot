const mongoose = require('mongoose');

/**
 * Modelo: Usuario
 * Representa a cada estudiante que interactúa con el chatbot.
 * Se registra automáticamente al enviar su primer mensaje.
 */
const usuarioSchema = new mongoose.Schema({
    // Número de WhatsApp en formato whatsapp-web.js (ej: "521234567890@c.us")
    numero: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    nombre: {
        type: String,
        required: true,
        trim: true,
    },
    fechaRegistro: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Usuario', usuarioSchema);
