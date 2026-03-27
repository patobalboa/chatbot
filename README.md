# 🤖 ChatBot Educativo — Desarrollo de Algoritmos

ChatBot para WhatsApp orientado a estudiantes de la asignatura de **Desarrollo de Algoritmos**. Permite calcular el IMC, consultar dietas y rutinas de ejercicio, y realizar evaluaciones con preguntas de opción múltiple. El profesor gestiona el banco de preguntas directamente desde WhatsApp.

---

## 📋 Requisitos previos

- [Node.js](https://nodejs.org/) v18 o superior
- [MongoDB](https://www.mongodb.com/) local o en Docker
- Una cuenta de WhatsApp para el bot
- Una cuenta de WhatsApp del profesor (admin)

---

## 🚀 Instalación

```bash
# 1. Clona o descarga el proyecto
cd chatbot

# 2. Instala dependencias
npm install

# 3. Crea el archivo de configuración
cp .env.example .env   # o edita .env directamente
```

---

## ⚙️ Configuración (.env)

```env
# URI de conexión a MongoDB
MONGO_URI=mongodb://localhost:27017/chatbot_algoritmos

# Número del profesor (sin el signo +)
# Ejemplo México (52): 521234567890
# Ejemplo Colombia (57): 573001234567
ADMIN_NUMBER=56945255554

# Cantidad de preguntas por evaluación
NUM_PREGUNTAS=5
```

---

## 🐳 MongoDB con Docker

Si usas Docker para levantar MongoDB:

```bash
docker run -d --name mongodb \
  -p 27017:27017 \
  mongo:latest
```

---

## ▶️ Ejecución

**En Windows (CMD):**
```cmd
node index.js
```

**En WSL / Linux / macOS:**
```bash
node index.js
```

Al iniciar, se mostrará un **código QR** en la terminal. Escanéalo con WhatsApp en tu teléfono (el número que usará el bot).

---

## 📱 Flujo del estudiante

```
Primer mensaje → Registro con nombre
       ↓
   Menú principal:
   1️⃣  Calcular IMC     → pide altura → peso → edad → resultado
   2️⃣  Solicitar Dieta  → respuesta informativa
   3️⃣  Rutina de ejercicio → respuesta informativa
   4️⃣  Realizar Evaluación → preguntas aleatorias → resultado final
   Salir → cierra sesión
```

---

## 👨‍🏫 Comandos del profesor (admin)

El número configurado en `ADMIN_NUMBER` tiene acceso a los siguientes comandos desde WhatsApp:

| Comando       | Descripción                                      |
|---------------|--------------------------------------------------|
| `!ayuda`      | Lista todos los comandos disponibles             |
| `!agregar`    | Inicia el flujo para agregar una pregunta (7 pasos) |
| `!cancelar`   | Cancela cualquier operación en curso             |
| `!resultados` | Muestra los últimos 10 resultados de evaluaciones |
| `!broadcast`  | Envía una evaluación a todos los estudiantes registrados |

---

## 🗂️ Estructura del proyecto

```
chatbot/
├── index.js            # Lógica principal del bot y máquina de estados
├── package.json
├── .env                # Variables de entorno (no subir a Git)
├── config/
│   └── database.js     # Conexión a MongoDB con Mongoose
└── models/
    ├── Usuario.js      # Esquema de estudiantes registrados
    ├── Pregunta.js     # Banco de preguntas de opción múltiple
    └── Evaluacion.js   # Resultados de evaluaciones realizadas
```

---

## 🗄️ Modelos de datos

### Usuario
| Campo         | Tipo   | Descripción                          |
|---------------|--------|--------------------------------------|
| numero        | String | Número WhatsApp (`@c.us`)            |
| nombre        | String | Nombre del estudiante                |
| fechaRegistro | Date   | Fecha de registro automático         |

### Pregunta
| Campo             | Tipo   | Descripción                          |
|-------------------|--------|--------------------------------------|
| enunciado         | String | Texto de la pregunta                 |
| opciones          | Object | Opciones A, B, C y D                 |
| respuestaCorrecta | String | Letra correcta (A/B/C/D)             |
| tema              | String | Categoría (por defecto: `General`)   |

### Evaluacion
| Campo        | Tipo   | Descripción                            |
|--------------|--------|----------------------------------------|
| usuario      | ObjectId | Referencia al Usuario               |
| respuestas   | Array  | Detalle de cada pregunta respondida    |
| correctas    | Number | Total de respuestas correctas          |
| porcentaje   | Number | Porcentaje de aciertos (0-100)         |
| fecha        | Date   | Fecha de realización                   |

---

## 🧮 Fórmula IMC

$$IMC = \frac{Peso\ (kg)}{Altura\ (m)^2}$$

| IMC          | Categoría    |
|--------------|--------------|
| < 18.5       | 🔵 Bajo peso  |
| 18.5 – 24.9  | 🟢 Peso normal|
| 25.0 – 29.9  | 🟡 Sobrepeso  |
| ≥ 30.0       | 🔴 Obesidad   |

---

## ⚠️ Solución de problemas

**PowerShell bloquea `npm`:**
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```
O usa CMD en lugar de PowerShell.

**El bot se queda colgado al iniciar:**
Verifica que MongoDB esté corriendo en el puerto 27017:
```bash
# Docker
docker ps | grep mongo

# WSL/Linux
sudo service mongodb start
```

**Chromium no encontrado (en WSL):**
```bash
sudo apt-get install -y chromium-browser
```

---

## 📄 Licencia

Proyecto educativo de uso libre.
