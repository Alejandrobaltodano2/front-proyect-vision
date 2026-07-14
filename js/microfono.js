/**
 * microfono.js — Grabación de audio en WAV puro desde el navegador.
 *
 * FIX: la versión anterior aplicaba DOS etapas de amplificación apiladas
 * (un GainNode fijo de 2.5x + una normalización final de hasta 15x). Sobre
 * una voz con volumen ya razonable, esa combinación saturaba la señal por
 * completo (clipping duro, muestras pegadas en ±32767), lo que suena como
 * un pitido/ruido distorsionado para el reconocedor — no como voz baja, sino
 * como voz "quemada". Esta versión usa UNA sola etapa de normalización, con
 * un techo de ganancia mucho más conservador y un limitador real que nunca
 * deja que la señal toque el límite absoluto de 16 bits.
 */


// ── Constantes de grabación ───────────────────
const SAMPLE_RATE    = 16000   // Hz — óptimo para Google STT / Whisper
const BUFFER_SIZE    = 4096    // muestras por chunk del ScriptProcessor

// Normalización sobre las muestras Float32 ya grabadas, usando el
// percentil 95 como referencia del nivel real de voz (ignora clics o
// golpes aislados que inflarían un cálculo basado en el pico absoluto).
const NIVEL_OBJETIVO_NORM  = 0.5    // 50% del rango — deja bastante margen
const GANANCIA_MAXIMA_NORM = 6.0    // techo conservador; antes era 15x, que
                                     // sobre voz ya audible saturaba la señal
const PERCENTIL_REFERENCIA = 0.95
const NIVEL_MINIMO_CON_SENAL = 0.01 // por debajo de esto, no hay voz real


/** Solicita acceso al micrófono y configura el analizador. */
async function iniciarMic() {
  Estado.micStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      sampleRate:   SAMPLE_RATE,
      channelCount: 1,           // mono
      echoCancellation:   true,
      noiseSuppression:   false, // puede over-suprimir voz normal casi a cero
      autoGainControl:    true,  // dejamos que el navegador ayude un poco;
                                  // la normalización de abajo es la que
                                  // realmente corrige el nivel final
    }
  })

  Estado.audioCtx  = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate: SAMPLE_RATE
  })
  Estado.analyser  = Estado.audioCtx.createAnalyser()
  Estado.analyser.fftSize = 256

  const source = Estado.audioCtx.createMediaStreamSource(Estado.micStream)
  source.connect(Estado.analyser)

  Estado.micActive = true
  document.getElementById('dot-mic').className = 'dot green'

  _dibujarWaveform()
}


/** Inicia la captura PCM con ScriptProcessorNode. */
function iniciarGrabacion() {
  Estado.audioChunks = []   // aquí guardamos Float32Arrays de muestras

  // SIN GainNode fijo esta vez — una sola etapa de corrección, aplicada
  // después en _normalizarFloat(), es más fácil de razonar y de calibrar
  // que dos ganancias apiladas.
  Estado.scriptProcessor = Estado.audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 1)

  Estado.scriptProcessor.onaudioprocess = e => {
    const samples = new Float32Array(e.inputBuffer.getChannelData(0))
    Estado.audioChunks.push(samples)
  }

  const source = Estado.audioCtx.createMediaStreamSource(Estado.micStream)
  source.connect(Estado.scriptProcessor)
  Estado.scriptProcessor.connect(Estado.audioCtx.destination)

  Estado._grabSource = source
}


/**
 * Detiene la grabación, ensambla las muestras PCM y construye un Blob WAV.
 * @returns {Promise<Blob>} - Blob con audio WAV listo para enviar.
 */
function detenerGrabacion() {
  return new Promise(resolve => {
    if (!Estado.scriptProcessor) { resolve(null); return }

    Estado.scriptProcessor.disconnect()
    if (Estado._grabSource) Estado._grabSource.disconnect()

    const totalSamples = Estado.audioChunks.reduce((n, c) => n + c.length, 0)
    const pcm = new Float32Array(totalSamples)
    let offset = 0
    for (const chunk of Estado.audioChunks) {
      pcm.set(chunk, offset)
      offset += chunk.length
    }

    const pcmNormalizado = _normalizarFloat(pcm)
    const wavBlob = _pcmAWavBlob(pcmNormalizado, Estado.audioCtx.sampleRate)
    resolve(wavBlob)
  })
}


/** Detiene el micrófono y libera todos los recursos de audio. */
function pararMic() {
  if (Estado.scriptProcessor) {
    try { Estado.scriptProcessor.disconnect() } catch {}
    Estado.scriptProcessor = null
  }
  if (Estado.micStream) {
    Estado.micStream.getTracks().forEach(t => t.stop())
  }
  cancelAnimationFrame(Estado.waveAnimId)
  Estado.micActive = false
  document.getElementById('dot-mic').className = 'dot'
  _limpiarWaveform()
}


/**
 * Envía el blob WAV al servidor junto con metadata de la sesión.
 * @param {Blob}   blob        - Audio WAV grabado.
 * @param {object} preguntaObj - Pregunta actual con { id, respuesta }.
 * @returns {Promise<object>}  - Respuesta JSON del servidor.
 */
async function enviarAudio(blob, preguntaObj) {
  const form = new FormData()
  form.append('audio',              blob,                  'audio.wav')
  form.append('respuesta_esperada', preguntaObj.respuesta)
  form.append('pregunta_id',        preguntaObj.id)
  form.append('frames_total',       Estado.framesTotal)
  form.append('frames_mirando',     Estado.framesMirando)

  const frameUrl = capturarFrameActual()
  if (frameUrl) form.append('frame', frameUrl)

  try {
    const res = await authFetch(`${server_preguntas}/api/evaluacion/transcribir`, { method: 'POST', body: form })
    const url = URL.createObjectURL(blob);
    console.log("url:", url)
    return await res.json()
  } catch (e) {
    return { error: e.message, transcripcion: '', porcentaje: 0, faltantes: [] }
  }
}


// ══════════════════════════════════════════════
// NORMALIZACIÓN (una sola etapa, con limitador real)
// ══════════════════════════════════════════════

/**
 * Normaliza un Float32Array de muestras PCM usando el percentil 95 como
 * referencia del nivel típico de voz. Aplica un techo de ganancia
 * conservador y un limitador suave (tanh) para que, incluso en el peor
 * caso, la señal nunca llegue a saturar a ±1.0 de forma dura.
 */
function _normalizarFloat(pcm) {
  if (pcm.length === 0) return pcm

  const abs = new Float32Array(pcm.length)
  for (let i = 0; i < pcm.length; i++) abs[i] = Math.abs(pcm[i])

  const ordenado = Array.from(abs).sort((a, b) => a - b)
  const idx = Math.min(ordenado.length - 1, Math.floor(ordenado.length * PERCENTIL_REFERENCIA))
  const referencia = ordenado[idx]

  if (referencia < NIVEL_MINIMO_CON_SENAL) {
    console.warn('[mic-norm] Audio prácticamente sin señal, se omite normalización.')
    return pcm
  }

  let ganancia = NIVEL_OBJETIVO_NORM / referencia
  ganancia = Math.min(ganancia, GANANCIA_MAXIMA_NORM)

  if (ganancia <= 1.05) {
    console.log(`[mic-norm] Nivel ya adecuado (referencia: ${(referencia * 100).toFixed(1)}%), sin amplificar`)
    return pcm
  }

  console.log(`[mic-norm] Aplicando ganancia x${ganancia.toFixed(2)} (referencia: ${(referencia * 100).toFixed(1)}%)`)

  const salida = new Float32Array(pcm.length)
  for (let i = 0; i < pcm.length; i++) {
    const v = pcm[i] * ganancia
    // Limitador: por debajo de 0.85 no toca nada; por encima, comprime
    // suavemente en vez de recortar en seco, y nunca deja pasar de ±0.98.
    if (Math.abs(v) <= 0.85) {
      salida[i] = v
    } else {
      const signo = Math.sign(v)
      const exceso = Math.abs(v) - 0.85
      salida[i] = signo * (0.85 + 0.13 * Math.tanh(exceso / 0.13))
    }
  }
  return salida
}


// ══════════════════════════════════════════════
// CONSTRUCCIÓN WAV MANUAL (sin dependencias)
// ══════════════════════════════════════════════

/**
 * Convierte muestras PCM Float32 a un Blob WAV válido.
 * @param {Float32Array} pcm        - Muestras en rango -1.0 a 1.0.
 * @param {number}       sampleRate - Frecuencia de muestreo en Hz.
 * @returns {Blob}
 */
function _pcmAWavBlob(pcm, sampleRate) {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * bitsPerSample / 8
  const blockAlign = numChannels * bitsPerSample / 8
  const dataSize = pcm.length * 2
  const bufferSize = 44 + dataSize

  const buffer = new ArrayBuffer(bufferSize)
  const view   = new DataView(buffer)

  _writeStr(view, 0,  'RIFF')
  view.setUint32(4,  bufferSize - 8, true)
  _writeStr(view, 8,  'WAVE')

  _writeStr(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20,  1, true)
  view.setUint16(22, numChannels,  true)
  view.setUint32(24, sampleRate,   true)
  view.setUint32(28, byteRate,     true)
  view.setUint16(32, blockAlign,   true)
  view.setUint16(34, bitsPerSample, true)

  _writeStr(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  const int16Offset = 44
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]))
    view.setInt16(int16Offset + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

function _writeStr(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}


// ── Waveform (sin cambios) ────────────────────

function _dibujarWaveform() {
  const wc   = document.getElementById('waveform')
  const wctx = wc.getContext('2d')
  wc.width   = wc.offsetWidth
  wc.height  = wc.offsetHeight
  const buf  = new Uint8Array(Estado.analyser.frequencyBinCount)

  function frame() {
    Estado.waveAnimId = requestAnimationFrame(frame)
    Estado.analyser.getByteTimeDomainData(buf)
    wctx.clearRect(0, 0, wc.width, wc.height)
    wctx.strokeStyle = '#e8b84b'
    wctx.lineWidth   = 1.5
    wctx.beginPath()
    const sw = wc.width / buf.length
    for (let i = 0; i < buf.length; i++) {
      const y = (buf[i] / 128) * (wc.height / 2)
      i === 0 ? wctx.moveTo(0, y) : wctx.lineTo(i * sw, y)
    }
    wctx.stroke()
  }
  frame()
}

function _limpiarWaveform() {
  const wc   = document.getElementById('waveform')
  const wctx = wc.getContext('2d')
  wctx.clearRect(0, 0, wc.width, wc.height)
}