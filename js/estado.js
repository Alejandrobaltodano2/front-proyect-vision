/**
 * estado.js — Estado global de la aplicación.
 *
 * Una sola fuente de verdad para todas las variables
 * mutables. Los módulos leen y escriben directamente
 * sobre este objeto en lugar de variables sueltas.
 */

const Estado = {
  // ── Dispositivos ────────────────────────────
  camStream:     null,   // MediaStream de la cámara
  micStream:     null,   // MediaStream del micrófono
  mediaRecorder: null,   // instancia de MediaRecorder
  audioChunks:   [],     // fragmentos de audio grabados
  audioCtx:      null,   // AudioContext para el analizador
  analyser:      null,   // AnalyserNode para el waveform
  waveAnimId:    null,   // ID de requestAnimationFrame
  detectionLoop: null,   // ID de setInterval para detección

  // ── Flags ───────────────────────────────────
  camRunning:    false,  // cámara activa
  micActive:     false,  // micrófono activo
  evalRunning:   false,  // evaluación en curso
  stopRequested: false,  // el usuario pidió detener

  // ── Métricas de atención ────────────────────
  framesTotal:   0,      // total de frames analizados
  framesMirando: 0,      // frames con contacto visual confirmado

  // ── Sesión actual ───────────────────────────
  preguntas:  [],        // lista cargada del servidor o fallback
  resultados: [],        // { pregunta, transcripcion, porcentaje, faltantes, mirando_pct }
  idxActual:  0,         // índice de la pregunta en curso

  /** Reinicia solo los contadores de sesión (no los dispositivos). */
  reiniciarSesion() {
    this.framesTotal   = 0
    this.framesMirando = 0
    this.resultados    = []
    this.idxActual     = 0
    this.evalRunning   = false
    this.stopRequested = false
  },
}