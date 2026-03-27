require('dotenv').config();
const conectarDB = require('./config/database');
const Pregunta   = require('./models/Pregunta');

const preguntas = [
    {
        enunciado: '¿Qué representa una variable dentro de un algoritmo?',
        opciones: {
            A: 'Un conjunto de instrucciones',
            B: 'Un espacio de memoria que almacena datos',
            C: 'Una condición lógica',
            D: 'Un ciclo repetitivo',
        },
        respuestaCorrecta: 'B',
        tema: 'Concepto de Variable',
    },
    {
        enunciado: '¿Cuál es la principal diferencia entre un IF simple y un IF ELSE?',
        opciones: {
            A: 'El IF ELSE no evalúa condiciones',
            B: 'El IF simple ejecuta siempre dos caminos',
            C: 'El IF ELSE siempre ejecuta una acción, el IF simple no necesariamente',
            D: 'No hay diferencia',
        },
        respuestaCorrecta: 'C',
        tema: 'Estructura Condicional',
    },
    {
        enunciado: '¿Cuándo es más apropiado usar un ciclo WHILE?',
        opciones: {
            A: 'Cuando sabemos exactamente cuántas veces repetir',
            B: 'Cuando queremos ejecutar algo solo una vez',
            C: 'Cuando no sabemos cuántas veces se repetirá el proceso',
            D: 'Cuando no hay condiciones',
        },
        respuestaCorrecta: 'C',
        tema: 'Uso de Ciclos',
    },
    {
        enunciado: 'En un algoritmo de chatbot, ¿qué estructura es más adecuada para responder diferentes tipos de mensajes?',
        opciones: {
            A: 'Solo variables',
            B: 'Solo ciclos',
            C: 'Condicionales (IF / IF ELSE / anidados)',
            D: 'Ninguna',
        },
        respuestaCorrecta: 'C',
        tema: 'Lógica de Chatbot',
    },
    {
        enunciado: '¿Cuál es el orden correcto del modelo EPS?',
        opciones: {
            A: 'Proceso → Entrada → Salida',
            B: 'Entrada → Proceso → Salida',
            C: 'Salida → Entrada → Proceso',
            D: 'Entrada → Salida → Proceso',
        },
        respuestaCorrecta: 'B',
        tema: 'Estructura de un Algoritmo',
    },
];

(async () => {
    await conectarDB();
    const resultado = await Pregunta.insertMany(preguntas);
    console.log(`✅ ${resultado.length} preguntas insertadas correctamente.`);
    proceso();
})().catch(err => {
    console.error('❌ Error al insertar preguntas:', err.message);
    process.exit(1);
});

function proceso() {
    process.exit(0);
}
