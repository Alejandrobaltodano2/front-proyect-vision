/**
 * camara.js — Control de la cámara y detección de atención.
 *
 * Responsabilidades:
 *   - Solicitar acceso a la cámara.
 *   - Renderizar el feed de video.
 *   - Enviar frames al servidor para detectar rostro y ojos.
 *   - Actualizar métricas de atención en Estado.
 */

const video  = document.getElementById('video')
const canvas = document.getElementById('canvas')
const ctx2d  = canvas.getContext('2d')


/** Alterna entre encender y apagar la cámara. */
async function toggleCamera() {
  Estado.camRunning ? pararCamara() : await iniciarCamara()
}

/** Solicita acceso a la cámara e inicia el bucle de detección. */
async function iniciarCamara() {
  try {
    Estado.camStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
      audio: false,
    })

    video.srcObject      = Estado.camStream
    video.style.display  = 'block'

    document.getElementById('cam-ph').style.display     = 'none'
    document.getElementById('attn-badge').style.display = 'block'
    document.getElementById('btn-cam').textContent      = '■ Detener cámara'
    document.getElementById('badge-cam').textContent    = 'Activa'
    document.getElementById('badge-cam').style.color    = 'var(--green)'

    Estado.camRunning    = true
    Estado.detectionLoop = setInterval(_analizarFrame, 600)

  } catch (e) {
    setStatus('No se pudo acceder a la cámara: ' + e.message, 'red')
  }
}

/** Detiene la cámara y limpia recursos. */
function pararCamara() {
  if (Estado.camStream) {
    Estado.camStream.getTracks().forEach(t => t.stop())
  }
  clearInterval(Estado.detectionLoop)

  video.style.display = 'none'
  document.getElementById('cam-ph').style.display     = 'flex'
  document.getElementById('attn-badge').style.display = 'none'
  document.getElementById('btn-cam').textContent      = '▶ Cámara'
  document.getElementById('badge-cam').textContent    = 'Inactiva'
  document.getElementById('badge-cam').style.color    = 'var(--dim)'
  document.getElementById('dot-cam').className        = 'dot'

  Estado.camRunning = false
}

/**
 * Captura un frame del video, lo envía al servidor /detect
 * y actualiza las métricas de atención en Estado y en la UI.
 * @private
 */
async function _analizarFrame() {
  if (!Estado.camRunning || !video.videoWidth) return

  // Capturar frame (espejado para coincidir con lo que ve el usuario)
  canvas.width  = video.videoWidth
  canvas.height = video.videoHeight
  ctx2d.save()
  ctx2d.scale(-1, 1)
  ctx2d.drawImage(video, -canvas.width, 0)
  ctx2d.restore()

  const dataUrl = canvas.toDataURL('image/jpeg', 0.45)

  try {
      const res  = await authFetch(`${server_preguntas}/api/deteccion/detect`, {      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ frame: dataUrl }),
    })
    const data = await res.json()

    setAttencionUI(data.mirando, data.estado)

    Estado.framesTotal++
    if (data.mirando) Estado.framesMirando++

  } catch {
    // Servidor no disponible: contamos el frame pero no actualizamos badge
    Estado.framesTotal++
  }

  setBarraAtencion(Estado.framesTotal, Estado.framesMirando)
}

/**
 * Captura el frame actual del video y devuelve su data URL.
 * Útil para adjuntarlo al envío de audio.
 * @returns {string|null}
 */
function capturarFrameActual() {
  if (!Estado.camRunning || !video.videoWidth) return null

  canvas.width  = video.videoWidth
  canvas.height = video.videoHeight
  ctx2d.save()
  ctx2d.scale(-1, 1)
  ctx2d.drawImage(video, -canvas.width, 0)
  ctx2d.restore()

  return canvas.toDataURL('image/jpeg', 0.45)
}