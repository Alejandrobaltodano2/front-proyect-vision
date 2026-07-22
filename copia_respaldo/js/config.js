/**
 * config.js — Constantes y configuración global.
 *
 * Todo valor que pueda cambiar según el entorno
 * vive aquí. Los demás módulos lo importan como
 * variables globales (sin módulos ES6 para máxima
 * compatibilidad con <script src="...">).
 */

// ── Servidor Python ───────────────────────────


const server_preguntas = 'http://localhost:8082'

// ── Idioma TTS + STT (BCP-47) ─────────────────
const IDIOMA = 'es-ES'

// ── Pausas de tiempo (ms) ─────────────────────
const DELAY_ANTES_GRABAR  = 800   // pausa entre fin de TTS y start de grabación
const DELAY_ENTRE_PREGUNTAS = 800 // pausa después de "Siguiente pregunta"

// ── Duración de escucha por defecto (ms) ──────
const DURACION_ESCUCHA_DEFAULT = 6000

// ── Preguntas de respaldo (si el servidor no responde) ──
const PREGUNTAS_FALLBACK = [
  {
    id:          1,
    pregunta:    '¿Cuál es la capital de Francia?',
    respuesta:   'París',
    duracion_ms: 5000,
  },
  {
    id:          2,
    pregunta:    '¿Qué es la fotosíntesis?',
    respuesta:   'proceso que convierte luz solar en glucosa',
    duracion_ms: 8000,
  },
  {
    id:          3,
    pregunta:    '¿Cuántos planetas hay en el sistema solar?',
    respuesta:   'ocho planetas',
    duracion_ms: 5000,
  },
]