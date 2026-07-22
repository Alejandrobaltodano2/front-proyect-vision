/**
 * app.js — Arranque de la aplicación.
 *
 * Este es el último archivo en cargarse.
 * Solo hace dos cosas:
 *   1. Conectar los botones del HTML con las funciones de los módulos.
 *   2. Exponer la utilidad `sleep` usada en evaluacion.js.
 *
 * No contiene lógica de negocio.
 */

// ── Utilidad global ───────────────────────────
/**
 * Promesa que resuelve después de `ms` milisegundos.
 * @param {number} ms
 * @returns {Promise<void>}
 */
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))


// ── Conexión de botones ───────────────────────
document.addEventListener('DOMContentLoaded', () => {

  document.getElementById('btn-cam')
    .addEventListener('click', toggleCamera)

  document.getElementById('btn-reset')
    .addEventListener('click', resetAll)

  document.getElementById('btn-eval')
    .addEventListener('click', iniciarEvaluacion)

  document.getElementById('btn-stop')
    .addEventListener('click', detenerEvaluacion)

})


// ── Reset global ──────────────────────────────
/**
 * Devuelve la aplicación a su estado inicial:
 * detiene dispositivos, limpia métricas y reinicia la UI.
 */
function resetAll() {
  Estado.stopRequested = true
  window.speechSynthesis.cancel()

  pararCamara()
  pararMic()

  Estado.reiniciarSesion()

  resetUI()
}