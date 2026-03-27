/**
 * =============================================================
 *  CHATBOT EDUCATIVO - Desarrollo de Algoritmos  v2.0
 *  Implementación del diagrama de flujo en whatsapp-web.js
 *  con registro de usuarios en MongoDB y sistema de evaluación
 * =============================================================
 *
 * DIAGRAMA DE FLUJO IMPLEMENTADO:
 *
 *  [Inicio] → Espera mensaje → ¿Usuario en BD?
 *      NO → Pide nombre → Guarda en MongoDB
 *      SI → Carga nombre de BD
 *      ↓
 *  Muestra menú (Continuar = true):
 *    1. Calcular IMC     → pide altura → peso → edad → Calcula → guarda
 *    2. Solicitar Dieta  → respuesta informativa
 *    3. Rutina ejercicio → respuesta informativa
 *    4. Iniciar Evaluación → preguntas de BD → guarda resultado
 *    Salir → Continuar = false → FIN
 *
 * COMANDOS DEL PROFESOR (admin):
 *  !ayuda       → Lista de comandos disponibles
 *  !agregar     → Agregar pregunta al banco (flujo interactivo)
 *  !cancelar    → Cancelar operación en curso
 *  !resultados  → Ver últimos resultados de evaluaciones
 *  !broadcast   → Enviar evaluación a todos los estudiantes registrados
 *
 * FÓRMULA IMC: IMC = Peso(kg) / Altura(m)²
 */

// ─── Variables de entorno (.env) ────────────────────────────
require('dotenv').config();

// ─── Importación de librerías ────────────────────────────────
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode    = require('qrcode-terminal');
const conectarDB = require('./config/database');
const Usuario    = require('./models/Usuario');
const Pregunta   = require('./models/Pregunta');
const Evaluacion = require('./models/Evaluacion');

// ─── ID del administrador (profesor) ────────────────────────
// Se lee desde .env en formato completo: número@c.us
const ADMIN_ID = (process.env.ADMIN_ID || '').trim();

// ─── Cantidad de preguntas por evaluación ─────────────────────
const NUM_PREGUNTAS = parseInt(process.env.NUM_PREGUNTAS) || 5;

// ─── Estados posibles del chatbot (máquina de estados) ───────
const ESTADOS = {
    // Estados del estudiante
    ESPERANDO_NOMBRE:        'ESPERANDO_NOMBRE',   // Primera vez en el bot
    MENU:                    'MENU',               // Menú principal
    ESPERANDO_ALTURA:        'ESPERANDO_ALTURA',   // IMC paso 1
    ESPERANDO_PESO:          'ESPERANDO_PESO',     // IMC paso 2
    ESPERANDO_EDAD:          'ESPERANDO_EDAD',     // IMC paso 3
    EVALUACION_EN_CURSO:     'EVALUACION_EN_CURSO',// Respondiendo preguntas

    // Estados del administrador (profesor)
    ADMIN_AGREGAR_ENUNCIADO: 'ADMIN_AGREGAR_ENUNCIADO', // Paso 1: enunciado
    ADMIN_AGREGAR_OPC_A:     'ADMIN_AGREGAR_OPC_A',     // Paso 2: opción A
    ADMIN_AGREGAR_OPC_B:     'ADMIN_AGREGAR_OPC_B',     // Paso 3: opción B
    ADMIN_AGREGAR_OPC_C:     'ADMIN_AGREGAR_OPC_C',     // Paso 4: opción C
    ADMIN_AGREGAR_OPC_D:     'ADMIN_AGREGAR_OPC_D',     // Paso 5: opción D
    ADMIN_AGREGAR_CORRECTA:  'ADMIN_AGREGAR_CORRECTA',  // Paso 6: respuesta correcta
    ADMIN_AGREGAR_TEMA:      'ADMIN_AGREGAR_TEMA',      // Paso 7: tema (opcional)
};

// ─── Almacenamiento en memoria (una entrada por usuario) ──────
const estadoUsuario = new Map(); // idUsuario → estado actual
const datosUsuario  = new Map(); // idUsuario → datos temporales de la sesión

// ─── Funciones auxiliares ─────────────────────────────────────

/**
 * Devuelve la categoría según el valor del IMC (clasificación OMS).
 */
function obtenerCategoriaIMC(imc) {
    if (imc < 18.5) return '🔵 Bajo peso';
    if (imc < 25.0) return '🟢 Peso normal';
    if (imc < 30.0) return '🟡 Sobrepeso';
    return '🔴 Obesidad';
}

/**
 * Genera el mensaje del menú principal personalizado con el nombre.
 */
function mensajeMenu(nombre) {
    return (
        `👋 Hola *${nombre}*, ¿en qué te puedo ayudar?\n\n` +
        `1️⃣  Calcular tu IMC\n` +
        `2️⃣  Solicitar Dieta\n` +
        `3️⃣  Rutina de ejercicio\n\n` +
        `_Escribe *Salir* para terminar._`
    );
}

/**
 * Formatea y envía una pregunta de evaluación al usuario.
 * @param {object} client   - instancia del cliente de WhatsApp
 * @param {string} to       - número destino (idUsuario)
 * @param {object} pregunta - documento de MongoDB de tipo Pregunta
 * @param {number} indice   - índice 0-based dentro de la evaluación
 * @param {number} total    - total de preguntas en la evaluación
 */
async function enviarPregunta(client, to, pregunta, indice, total) {
    const texto =
        `📝 *Evaluación — Pregunta ${indice + 1} de ${total}*\n` +
        `─────────────────────\n` +
        `${pregunta.enunciado}\n\n` +
        `🅰️  ${pregunta.opciones.A}\n` +
        `🅱️  ${pregunta.opciones.B}\n` +
        `🅾️  ${pregunta.opciones.C}\n` +
        `🆔  ${pregunta.opciones.D}\n\n` +
        `_Responde con la letra: A, B, C o D_`;
    await client.sendMessage(to, texto);
}

/**
 * Selecciona N preguntas aleatorias del banco de preguntas en MongoDB.
 * Si hay menos preguntas que N, devuelve todas las disponibles.
 */
async function obtenerPreguntasAleatorias(n) {
    // $sample de MongoDB devuelve documentos aleatorios de forma eficiente
    return Pregunta.aggregate([{ $sample: { size: n } }]);
}

/**
 * Guarda el resultado de una evaluación en MongoDB.
 */
async function guardarEvaluacion(usuario, respuestas) {
    const correctas  = respuestas.filter(r => r.esCorrecta).length;
    const total      = respuestas.length;
    const porcentaje = Math.round((correctas / total) * 100);

    await Evaluacion.create({
        usuario:        usuario._id,
        numeroWhatsapp: usuario.numero,
        nombreUsuario:  usuario.nombre,
        respuestas,
        correctas,
        total,
        porcentaje,
    });

    return { correctas, total, porcentaje };
}

/**
 * Pausa la ejecución N milisegundos (útil para broadcast con delays).
 */
function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Configuración del cliente de WhatsApp ────────────────────
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
});

// ─── Evento: mostrar QR en la terminal ───────────────────────
client.on('qr', (qr) => {
    console.log('\n📱 Escanea el siguiente código QR con tu WhatsApp:\n');
    qrcode.generate(qr, { small: true });
});

// ─── Evento: cliente listo ────────────────────────────────────
client.on('ready', () => {
    console.log('✅ ¡ChatBot conectado y listo para recibir mensajes!');
    console.log(`👨‍🏫 ADMIN_ID configurado: "${ADMIN_ID}"`);
    console.log('ℹ️  El primer mensaje que recibas mostrará el ID real del número.');
});

// ─── Evento: mensaje recibido ─────────────────────────────────
client.on('message', async (mensaje) => {

    // Ignorar mensajes de grupos
    if (mensaje.from.endsWith('@g.us')) return;

    // Normalizar siempre al formato @c.us (evita el formato @lid de dispositivos vinculados)
    const contacto  = await mensaje.getContact();
    const idUsuario = contacto.id._serialized;
    const texto     = mensaje.body.trim();

    // Debug: muestra el ID real de quien escribe (útil para configurar ADMIN_ID)
    console.log(`📩 Mensaje de: ${idUsuario}`);

    // ════════════════════════════════════════════════════════
    //  BLOQUE DE COMANDOS DEL ADMINISTRADOR (PROFESOR)
    // ════════════════════════════════════════════════════════
    if (idUsuario === ADMIN_ID) {

        // Comando !cancelar — disponible en cualquier estado admin
        if (texto.toLowerCase() === '!cancelar') {
            estadoUsuario.delete(idUsuario);
            datosUsuario.delete(idUsuario);
            await mensaje.reply('❌ Operación cancelada.');
            return;
        }

        const estadoAdmin = estadoUsuario.get(idUsuario);

        // ── Si está en flujo de agregar pregunta, continuar ──
        if (estadoAdmin && estadoAdmin.startsWith('ADMIN_')) {
            await manejarFlujoPregunta(mensaje, idUsuario, texto);
            return;
        }

        // ── Comandos de acceso directo ──────────────────────
        switch (texto.toLowerCase()) {

            case '!ayuda':
                await mensaje.reply(
                    '👨‍🏫 *Comandos del Profesor*\n\n' +
                    '`!agregar`    → Agregar pregunta al banco\n' +
                    '`!resultados` → Ver últimos 10 resultados\n' +
                    '`!broadcast`  → Enviar evaluación a todos\n' +
                    '`!cancelar`   → Cancelar acción en curso\n\n' +
                    '_También puedes usar el menú de estudiante normalmente._'
                );
                return;

            case '!agregar':
                estadoUsuario.set(idUsuario, ESTADOS.ADMIN_AGREGAR_ENUNCIADO);
                datosUsuario.set(idUsuario, { preguntaTemp: {} });
                await mensaje.reply(
                    '📝 *Nueva Pregunta — Paso 1/7*\n\n' +
                    'Escribe el *enunciado* de la pregunta.\n\n' +
                    '_Escribe_ `!cancelar` _para abortar._'
                );
                return;

            case '!resultados':
                await cmdResultados(mensaje);
                return;

            case '!broadcast':
                await cmdBroadcast(mensaje);
                return;
        }
    }

    // ════════════════════════════════════════════════════════
    //  COMANDO !evaluacion — disponible para cualquier estudiante
    // ════════════════════════════════════════════════════════
    if (texto.toLowerCase() === '!evaluacion') {
        await iniciarEvaluacion(idUsuario, mensaje);
        return;
    }

    // ════════════════════════════════════════════════════════
    //  FLUJO NORMAL DEL ESTUDIANTE
    // ════════════════════════════════════════════════════════

    // ── Primera vez: verificar si ya está registrado en BD ──
    if (!estadoUsuario.has(idUsuario)) {
        try {
            const usuarioExistente = await Usuario.findOne({ numero: idUsuario });

            if (usuarioExistente) {
                // Ya registrado → cargar nombre y mostrar menú
                datosUsuario.set(idUsuario, { nombre: usuarioExistente.nombre });
                estadoUsuario.set(idUsuario, ESTADOS.MENU);
                await mensaje.reply(
                    `🤖 ¡Bienvenido de nuevo, *${usuarioExistente.nombre}*!\n\n` +
                    mensajeMenu(usuarioExistente.nombre)
                );
            } else {
                // Primera vez → pedir nombre para registrar
                estadoUsuario.set(idUsuario, ESTADOS.ESPERANDO_NOMBRE);
                await mensaje.reply(
                    '🤖 ¡Bienvenido al ChatBot de Desarrollo de Algoritmos!\n\n' +
                    'Por favor, ingresa tu *nombre completo* para registrarte.'
                );
            }
        } catch (err) {
            console.error('Error al consultar BD:', err);
            await mensaje.reply('⚠️ Error interno, intenta de nuevo en un momento.');
        }
        return;
    }

    const estadoActual = estadoUsuario.get(idUsuario);

    // ── Máquina de estados del estudiante ────────────────────
    switch (estadoActual) {

        // ── Estado 1: Registro — esperando nombre ─────────────
        case ESTADOS.ESPERANDO_NOMBRE: {
            const nombre = texto;

            try {
                // Guardar en MongoDB (upsert por si acaso)
                await Usuario.findOneAndUpdate(
                    { numero: idUsuario },
                    { numero: idUsuario, nombre },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
            } catch (err) {
                console.error('Error al registrar usuario:', err);
            }

            datosUsuario.set(idUsuario, { nombre });
            estadoUsuario.set(idUsuario, ESTADOS.MENU);

            await mensaje.reply(
                `✅ ¡Registro exitoso!\n\n` +
                mensajeMenu(nombre)
            );
            break;
        }

        // ── Estado 2: Menú principal ───────────────────────────
        case ESTADOS.MENU: {
            const { nombre } = datosUsuario.get(idUsuario);
            const respuesta  = texto.toLowerCase();

            // Salida: Continuar = False → FIN
            if (respuesta === 'salir') {
                estadoUsuario.delete(idUsuario);
                datosUsuario.delete(idUsuario);
                await mensaje.reply('¡Muchas gracias, nos vemos pronto! 👋😊');
                return;
            }

            switch (texto) {

                case '1': // Calcular IMC
                    estadoUsuario.set(idUsuario, ESTADOS.ESPERANDO_ALTURA);
                    await mensaje.reply(
                        '📏 *Cálculo de IMC*\n\n' +
                        'Ingresa tu *altura* en metros.\n' +
                        '➡️ Ejemplo: `1.75`'
                    );
                    break;

                case '2': // Dieta
                    await mensaje.reply(
                        '🥗 *Recomendación de Dieta*\n\n' +
                        '• Come frutas y verduras todos los días 🥦🍎\n' +
                        '• Bebe al menos 2 litros de agua 💧\n' +
                        '• Reduce azúcares y grasas saturadas 🚫\n' +
                        '• Incluye proteínas magras (pollo, pescado) 🍗\n' +
                        '• No te saltes el desayuno ☀️\n\n' +
                        '🐰 ¡Debes comer sano como conejo!\n\n' +
                        '─────────────────────\n' +
                        mensajeMenu(nombre)
                    );
                    break;

                case '3': // Rutina de ejercicio
                    await mensaje.reply(
                        '💪 *Rutina de Ejercicio Semanal*\n\n' +
                        '• Lunes:    Pecho y tríceps 🏋️\n' +
                        '• Martes:   Espalda y bíceps 💪\n' +
                        '• Miércoles: Piernas 🦵\n' +
                        '• Jueves:   Hombros y abdomen 🔄\n' +
                        '• Viernes:  Cardio 30 min 🏃\n' +
                        '• Sábado y Domingo: Descanso activo 😴\n\n' +
                        '🏋️ ¡Debes hacer más pesas!\n\n' +
                        '─────────────────────\n' +
                        mensajeMenu(nombre)
                    );
                    break;

                default:
                    await mensaje.reply(
                        '❓ No entendí tu respuesta, vuelve a responder.\n\n' +
                        mensajeMenu(nombre)
                    );
                    break;
            }
            break;
        }

        // ── Estado 3: IMC — Altura ─────────────────────────────
        case ESTADOS.ESPERANDO_ALTURA: {
            const altura = parseFloat(texto.replace(',', '.'));

            if (isNaN(altura) || altura < 0.5 || altura > 3.0) {
                await mensaje.reply(
                    '⚠️ Altura no válida.\n' +
                    'Ingresa tu altura en metros (entre 0.5 y 3.0)\n' +
                    '➡️ Ejemplo: `1.75`'
                );
                return;
            }

            const datos = datosUsuario.get(idUsuario);
            datosUsuario.set(idUsuario, { ...datos, altura });
            estadoUsuario.set(idUsuario, ESTADOS.ESPERANDO_PESO);

            await mensaje.reply(
                '⚖️ Ingresa tu *peso* en kilogramos.\n' +
                '➡️ Ejemplo: `70`'
            );
            break;
        }

        // ── Estado 4: IMC — Peso ───────────────────────────────
        case ESTADOS.ESPERANDO_PESO: {
            const peso = parseFloat(texto.replace(',', '.'));

            if (isNaN(peso) || peso < 10 || peso > 500) {
                await mensaje.reply(
                    '⚠️ Peso no válido.\n' +
                    'Ingresa tu peso en kilogramos (entre 10 y 500)\n' +
                    '➡️ Ejemplo: `70`'
                );
                return;
            }

            const datos = datosUsuario.get(idUsuario);
            datosUsuario.set(idUsuario, { ...datos, peso });
            estadoUsuario.set(idUsuario, ESTADOS.ESPERANDO_EDAD);

            await mensaje.reply(
                '🎂 Por último, ingresa tu *edad* en años.\n' +
                '➡️ Ejemplo: `25`'
            );
            break;
        }

        // ── Estado 5: IMC — Edad ───────────────────────────────
        case ESTADOS.ESPERANDO_EDAD: {
            const edad = parseInt(texto);

            if (isNaN(edad) || edad < 1 || edad > 120) {
                await mensaje.reply(
                    '⚠️ Edad no válida.\n' +
                    'Ingresa tu edad en años (entre 1 y 120)\n' +
                    '➡️ Ejemplo: `25`'
                );
                return;
            }

            // Fórmula: IMC = Peso(kg) / Altura(m)²
            const { nombre, altura, peso } = datosUsuario.get(idUsuario);
            const imc       = peso / (altura * altura);
            const imcTexto  = imc.toFixed(2);
            const categoria = obtenerCategoriaIMC(imc);

            estadoUsuario.set(idUsuario, ESTADOS.MENU);

            await mensaje.reply(
                `📊 *Resultado de tu IMC*\n` +
                `─────────────────────\n` +
                `👤 Nombre:  ${nombre}\n` +
                `📏 Altura:  ${altura} m\n` +
                `⚖️ Peso:    ${peso} kg\n` +
                `🎂 Edad:    ${edad} años\n` +
                `─────────────────────\n` +
                `🔢 *Tu IMC es: ${imcTexto}*\n` +
                `📌 Categoría: ${categoria}\n\n` +
                `_Fórmula: IMC = ${peso} / (${altura})² = ${imcTexto}_\n\n` +
                `─────────────────────\n` +
                mensajeMenu(nombre)
            );
            break;
        }

        // ── Estado 6: Evaluación en curso ─────────────────────
        case ESTADOS.EVALUACION_EN_CURSO: {
            await manejarRespuestaEvaluacion(idUsuario, mensaje, texto);
            break;
        }
    }
});

// ════════════════════════════════════════════════════════════
//  FUNCIONES DEL SISTEMA DE EVALUACIÓN
// ════════════════════════════════════════════════════════════

/**
 * Inicia la evaluación para un estudiante.
 * Obtiene preguntas aleatorias de la BD y envía la primera.
 */
async function iniciarEvaluacion(idUsuario, mensaje) {
    try {
        const preguntas = await obtenerPreguntasAleatorias(NUM_PREGUNTAS);

        if (preguntas.length === 0) {
            await mensaje.reply(
                '📭 Aún no hay preguntas en el banco.\n' +
                'Pídele a tu profesor que agregue preguntas con `!agregar`.'
            );
            return;
        }

        // Guardar el estado de la evaluación en memoria
        const datos = datosUsuario.get(idUsuario);
        datosUsuario.set(idUsuario, {
            ...datos,
            evalPreguntas:    preguntas,       // array de preguntas
            evalIndice:       0,               // pregunta actual
            evalRespuestas:   [],              // respuestas acumuladas
        });
        estadoUsuario.set(idUsuario, ESTADOS.EVALUACION_EN_CURSO);

        await mensaje.reply(
            `🎓 *¡Evaluación iniciada!*\n` +
            `Se te harán *${preguntas.length} preguntas*.\n` +
            `Responde con la letra A, B, C o D.\n` +
            `─────────────────────`
        );

        // Enviar la primera pregunta
        await enviarPregunta(client, idUsuario, preguntas[0], 0, preguntas.length);

    } catch (err) {
        console.error('Error al iniciar evaluación:', err);
        await mensaje.reply('⚠️ Error al cargar la evaluación. Intenta de nuevo.');
    }
}

/**
 * Procesa la respuesta de un estudiante durante la evaluación.
 */
async function manejarRespuestaEvaluacion(idUsuario, mensaje, texto) {
    const respuesta = texto.toUpperCase();

    // Validar que sea A, B, C o D
    if (!['A', 'B', 'C', 'D'].includes(respuesta)) {
        await mensaje.reply('⚠️ Por favor responde solo con *A*, *B*, *C* o *D*.');
        return;
    }

    const datos       = datosUsuario.get(idUsuario);
    const preguntas   = datos.evalPreguntas;
    const indice      = datos.evalIndice;
    const preguntaActual = preguntas[indice];

    // Registrar la respuesta
    const esCorrecta = respuesta === preguntaActual.respuestaCorrecta.toUpperCase();
    datos.evalRespuestas.push({
        preguntaId:        preguntaActual._id,
        enunciado:         preguntaActual.enunciado,
        respuestaUsuario:  respuesta,
        respuestaCorrecta: preguntaActual.respuestaCorrecta.toUpperCase(),
        esCorrecta,
    });

    const siguienteIndice = indice + 1;

    if (siguienteIndice < preguntas.length) {
        // Aún hay preguntas → actualizar índice y enviar la siguiente
        datosUsuario.set(idUsuario, { ...datos, evalIndice: siguienteIndice });
        const icono = esCorrecta ? '✅' : '❌';
        await mensaje.reply(`${icono} Respuesta registrada.`);
        await enviarPregunta(client, idUsuario, preguntas[siguienteIndice], siguienteIndice, preguntas.length);

    } else {
        // Evaluación finalizada → calcular y guardar resultado
        try {
            const usuarioDB = await Usuario.findOne({ numero: idUsuario });
            const { correctas, total, porcentaje } = await guardarEvaluacion(
                usuarioDB,
                datos.evalRespuestas
            );

            // Generar detalle de respuestas
            let detalle = '';
            datos.evalRespuestas.forEach((r, i) => {
                const icono = r.esCorrecta ? '✅' : '❌';
                detalle += `${icono} P${i + 1}: respondiste *${r.respuestaUsuario}* — correcta *${r.respuestaCorrecta}*\n`;
            });

            // Determinar emoji de calificación
            let emojiNota = '😞';
            if (porcentaje >= 90) emojiNota = '🏆';
            else if (porcentaje >= 70) emojiNota = '🎉';
            else if (porcentaje >= 50) emojiNota = '😐';

            // Volver al menú
            estadoUsuario.set(idUsuario, ESTADOS.MENU);
            const limpieza = { nombre: datos.nombre };
            datosUsuario.set(idUsuario, limpieza);

            await mensaje.reply(
                `${emojiNota} *Evaluación finalizada*\n` +
                `─────────────────────\n` +
                `✔️ Correctas: ${correctas} / ${total}\n` +
                `📊 Calificación: *${porcentaje}%*\n` +
                `─────────────────────\n` +
                `${detalle}\n` +
                `─────────────────────\n` +
                mensajeMenu(datos.nombre)
            );

        } catch (err) {
            console.error('Error al guardar evaluación:', err);
            await mensaje.reply('⚠️ No se pudo guardar tu resultado. Informa al profesor.');
            estadoUsuario.set(idUsuario, ESTADOS.MENU);
        }
    }
}

// ════════════════════════════════════════════════════════════
//  FUNCIONES DEL ADMINISTRADOR (PROFESOR)
// ════════════════════════════════════════════════════════════

/**
 * Maneja el flujo interactivo de creación de preguntas (estados ADMIN_*).
 */
async function manejarFlujoPregunta(mensaje, idUsuario, texto) {
    const estado = estadoUsuario.get(idUsuario);
    const datos  = datosUsuario.get(idUsuario);
    const pt     = datos.preguntaTemp;

    switch (estado) {

        case ESTADOS.ADMIN_AGREGAR_ENUNCIADO:
            pt.enunciado = texto;
            estadoUsuario.set(idUsuario, ESTADOS.ADMIN_AGREGAR_OPC_A);
            await mensaje.reply('✏️ *Paso 2/7* — Escribe el texto de la *opción A*:');
            break;

        case ESTADOS.ADMIN_AGREGAR_OPC_A:
            pt.opcA = texto;
            estadoUsuario.set(idUsuario, ESTADOS.ADMIN_AGREGAR_OPC_B);
            await mensaje.reply('✏️ *Paso 3/7* — Escribe el texto de la *opción B*:');
            break;

        case ESTADOS.ADMIN_AGREGAR_OPC_B:
            pt.opcB = texto;
            estadoUsuario.set(idUsuario, ESTADOS.ADMIN_AGREGAR_OPC_C);
            await mensaje.reply('✏️ *Paso 4/7* — Escribe el texto de la *opción C*:');
            break;

        case ESTADOS.ADMIN_AGREGAR_OPC_C:
            pt.opcC = texto;
            estadoUsuario.set(idUsuario, ESTADOS.ADMIN_AGREGAR_OPC_D);
            await mensaje.reply('✏️ *Paso 5/7* — Escribe el texto de la *opción D*:');
            break;

        case ESTADOS.ADMIN_AGREGAR_OPC_D:
            pt.opcD = texto;
            estadoUsuario.set(idUsuario, ESTADOS.ADMIN_AGREGAR_CORRECTA);
            await mensaje.reply(
                '✏️ *Paso 6/7* — ¿Cuál es la *respuesta correcta*?\n\n' +
                `🅰️  ${pt.opcA}\n` +
                `🅱️  ${pt.opcB}\n` +
                `🅾️  ${pt.opcC}\n` +
                `🆔  ${pt.opcD}\n\n` +
                '_Responde con la letra: A, B, C o D_'
            );
            break;

        case ESTADOS.ADMIN_AGREGAR_CORRECTA: {
            const correcta = texto.toUpperCase();
            if (!['A', 'B', 'C', 'D'].includes(correcta)) {
                await mensaje.reply('⚠️ Solo puedes escribir A, B, C o D.');
                return;
            }
            pt.respuestaCorrecta = correcta;
            estadoUsuario.set(idUsuario, ESTADOS.ADMIN_AGREGAR_TEMA);
            await mensaje.reply(
                '✏️ *Paso 7/7* — Escribe el *tema* de la pregunta.\n' +
                '_Ejemplo: Algoritmos de ordenamiento, Estructuras de datos…_\n\n' +
                '_O escribe_ `General` _para omitir._'
            );
            break;
        }

        case ESTADOS.ADMIN_AGREGAR_TEMA: {
            pt.tema = texto;

            try {
                await Pregunta.create({
                    enunciado:         pt.enunciado,
                    opciones:          { A: pt.opcA, B: pt.opcB, C: pt.opcC, D: pt.opcD },
                    respuestaCorrecta: pt.respuestaCorrecta,
                    tema:              pt.tema,
                    creadaPor:         idUsuario,
                });

                // Limpiar estado admin
                estadoUsuario.delete(idUsuario);
                datosUsuario.delete(idUsuario);

                await mensaje.reply(
                    `✅ *Pregunta guardada exitosamente*\n\n` +
                    `📌 *Tema:* ${pt.tema}\n` +
                    `❓ *Enunciado:* ${pt.enunciado}\n\n` +
                    `Usa \`!resultados\` para ver resultados o \`!broadcast\` para enviar eval.`
                );
            } catch (err) {
                console.error('Error al guardar pregunta:', err);
                await mensaje.reply('⚠️ Error al guardar la pregunta. Intenta de nuevo.');
                estadoUsuario.delete(idUsuario);
                datosUsuario.delete(idUsuario);
            }
            break;
        }
    }
}

/**
 * Comando !resultados — Muestra los últimos 10 resultados de evaluaciones.
 */
async function cmdResultados(mensaje) {
    try {
        const resultados = await Evaluacion.find()
            .sort({ fecha: -1 })
            .limit(10)
            .lean();

        if (resultados.length === 0) {
            await mensaje.reply('📭 Aún no hay evaluaciones registradas.');
            return;
        }

        let texto = `📊 *Últimos ${resultados.length} resultado(s)*\n`;
        texto += `─────────────────────\n`;

        for (const r of resultados) {
            const fecha = new Date(r.fecha).toLocaleDateString('es-MX', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
            });
            let emoji = '😞';
            if (r.porcentaje >= 90)      emoji = '🏆';
            else if (r.porcentaje >= 70) emoji = '🎉';
            else if (r.porcentaje >= 50) emoji = '😐';

            texto +=
                `${emoji} *${r.nombreUsuario}*\n` +
                `   ✔️ ${r.correctas}/${r.total} — ${r.porcentaje}%\n` +
                `   📅 ${fecha}\n\n`;
        }

        await mensaje.reply(texto);

    } catch (err) {
        console.error('Error al consultar resultados:', err);
        await mensaje.reply('⚠️ Error al obtener resultados.');
    }
}

/**
 * Comando !broadcast — Envía la evaluación a todos los estudiantes registrados.
 * Usa un delay de 1.5 s entre mensajes para evitar spam.
 */
async function cmdBroadcast(mensaje) {
    try {
        const preguntas = await obtenerPreguntasAleatorias(NUM_PREGUNTAS);

        if (preguntas.length === 0) {
            await mensaje.reply('📭 No hay preguntas en el banco. Agrega preguntas primero con `!agregar`.');
            return;
        }

        const estudiantes = await Usuario.find().lean();

        if (estudiantes.length === 0) {
            await mensaje.reply('📭 No hay estudiantes registrados aún.');
            return;
        }

        await mensaje.reply(
            `📡 *Iniciando broadcast*\n` +
            `Enviando evaluación a *${estudiantes.length}* estudiante(s)…`
        );

        let enviados = 0;
        for (const estudiante of estudiantes) {
            // No enviar al propio admin
            if (estudiante.numero === ADMIN_ID) continue;

            try {
                // Configurar estado del estudiante para la evaluación
                datosUsuario.set(estudiante.numero, {
                    nombre:           estudiante.nombre,
                    evalPreguntas:    preguntas,
                    evalIndice:       0,
                    evalRespuestas:   [],
                });
                estadoUsuario.set(estudiante.numero, ESTADOS.EVALUACION_EN_CURSO);

                // Mensaje de presentación
                await client.sendMessage(
                    estudiante.numero,
                    `📣 *Tu profesor ha iniciado una evaluación*\n` +
                    `Responde ${preguntas.length} preguntas a continuación.\n` +
                    `─────────────────────`
                );

                // Enviar primera pregunta
                await enviarPregunta(client, estudiante.numero, preguntas[0], 0, preguntas.length);

                enviados++;
                await esperar(1500); // Pausa para evitar bloqueos de WhatsApp

            } catch (errEstudiante) {
                console.error(`No se pudo enviar a ${estudiante.nombre}:`, errEstudiante);
            }
        }

        await mensaje.reply(`✅ Evaluación enviada a *${enviados}* estudiante(s).`);

    } catch (err) {
        console.error('Error en broadcast:', err);
        await mensaje.reply('⚠️ Error al enviar el broadcast.');
    }
}

// ─── Iniciar BD y luego el cliente de WhatsApp ───────────────
(async () => {
    try {
        await conectarDB();
        client.initialize();
    } catch (err) {
        console.error('❌ No se pudo conectar a MongoDB:', err.message);
        process.exit(1);
    }
})();
