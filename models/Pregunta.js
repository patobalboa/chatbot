const mongoose = require('mongoose');

/**
 * Modelo: Pregunta
 * Banco de preguntas para las evaluaciones.
 * El profesor las agrega mediante el comando !agregar desde WhatsApp.
 *
 * Ejemplo de documento:
 * {
 *   enunciado: "¿Cuál es la complejidad del algoritmo de burbuja?",
 *   opciones: { A: "O(n)", B: "O(n²)", C: "O(log n)", D: "O(1)" },
 *   respuestaCorrecta: "B",
 *   tema: "Complejidad algorítmica"
 * }
 */
const preguntaSchema = new mongoose.Schema({
    enunciado: {
        type: String,
        required: true,
        trim: true,
    },
    opciones: {
        A: { type: String, required: true },
        B: { type: String, required: true },
        C: { type: String, required: true },
        D: { type: String, required: true },
    },
    // Solo se admiten A, B, C o D como respuesta correcta
    respuestaCorrecta: {
        type: String,
        required: true,
        enum: ['A', 'B', 'C', 'D'],
        uppercase: true,
    },
    tema: {
        type: String,
        default: 'General',
        trim: true,
    },
    // Número WhatsApp del profesor que la creó
    creadaPor: {
        type: String,
    },
    fechaCreacion: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Pregunta', preguntaSchema);
