/**
 * estado.js — Estado global de la aplicación.
 */

const Estado = {
  camStream:     null,
  micStream:     null,
  mediaRecorder: null,
  audioChunks:   [],
  audioCtx:      null,
  analyser:      null,
  waveAnimId:    null,
  detectionLoop: null,

  camRunning:    false,
  micActive:     false,
  evalRunning:   false,
  stopRequested: false,

  framesTotal:        0,
  framesMirando:      0,
  fallosConsecutivos: 0,

  preguntas:  [],
  resultados: [],
  idxActual:  0,

  reiniciarSesion() {
    this.framesTotal        = 0
    this.framesMirando      = 0
    this.fallosConsecutivos = 0
    this.resultados         = []
    this.idxActual          = 0
    this.evalRunning        = false
    this.stopRequested      = false
  },
}