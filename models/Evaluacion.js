const mongoose = require('mongoose');

/**
 * Modelo: Evaluacion
 * Almacena el resultado de cada intento de evaluación de un estudiante.
 * Se crea al finalizar cada evaluación automáticamente.
 */
const evaluacionSchema = new mongoose.Schema({
    // Referencia al usuario que realizó la evaluación
    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
    },
    // Campos desnormalizados para consultas rápidas sin hacer populate
    numeroWhatsapp: { type: String, required: true },
    nombreUsuario:  { type: String, required: true },

    // Detalle pregunta a pregunta
    respuestas: [
        {
            preguntaId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Pregunta' },
            enunciado:         String,
            respuestaUsuario:  String,  // Letra que respondió el estudiante (A/B/C/D)
            respuestaCorrecta: String,  // Letra correcta
            esCorrecta:        Boolean,
        },
    ],

    // Resumen de resultados
    correctas:   { type: Number, required: true },
    total:       { type: Number, required: true },
    porcentaje:  { type: Number, required: true }, // 0-100

    fecha: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Evaluacion', evaluacionSchema);
