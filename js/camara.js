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


async function toggleCamera() {
  Estado.camRunning ? pararCamara() : await iniciarCamara()
}

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

const UMBRAL_FALLOS_CONSECUTIVOS = 3

async function _analizarFrame() {
  if (!Estado.camRunning || !video.videoWidth) return

  canvas.width  = video.videoWidth
  canvas.height = video.videoHeight
  ctx2d.save()
  ctx2d.scale(-1, 1)
  ctx2d.drawImage(video, -canvas.width, 0)
  ctx2d.restore()

  const dataUrl = canvas.toDataURL('image/jpeg', 0.45)

  try {
    const res  = await authFetch(`${server_preguntas}/api/deteccion/detect`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ frame: dataUrl }),
    })
    const data = await res.json()

    if (data.mirando) {
      Estado.fallosConsecutivos = 0
      setAttencionUI(true, data.estado)
    } else {
      Estado.fallosConsecutivos++
      const mostrarComoNoMirando = Estado.fallosConsecutivos >= UMBRAL_FALLOS_CONSECUTIVOS
      setAttencionUI(!mostrarComoNoMirando, data.estado)
    }

    Estado.framesTotal++
    if (data.mirando) Estado.framesMirando++

  } catch {
    Estado.framesTotal++
  }
}

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