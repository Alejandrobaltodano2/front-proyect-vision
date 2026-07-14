/**
 * evaluacion.js — Flujo principal de la evaluación.
 *
 * Orquesta el ciclo completo:
 *   iniciarEvaluacion → [por cada pregunta: hablar → grabar → enviar] → finalizarEvaluacion
 *
 * Depende de: config.js, estado.js, ui.js, camara.js, microfono.js
 */


/** Punto de entrada: carga preguntas, prepara la sesión e itera. */
async function iniciarEvaluacion() {
  // Asegurar que cámara y micrófono estén activos
  if (!Estado.camRunning) await iniciarCamara()
  if (!Estado.micActive)  await iniciarMic()

  // Cargar preguntas del servidor (con fallback a las de config.js)
  Estado.preguntas = await _cargarPreguntas()

  // Preparar estado de sesión
  Estado.reiniciarSesion()
  Estado.evalRunning = true

  // Preparar UI
  document.getElementById('btn-eval').disabled        = true
  document.getElementById('btn-stop').disabled        = false
  document.getElementById('report').style.display     = 'none'
  construirDots(Estado.preguntas.length)

  // Iterar preguntas
  for (let i = 0; i < Estado.preguntas.length; i++) {
    if (Estado.stopRequested) break
    Estado.idxActual = i
    await _procesarPregunta(Estado.preguntas[i], i)
  }

  await _finalizarEvaluacion()
}

/** Solicita detener la evaluación en el próximo ciclo. */
function detenerEvaluacion() {
  Estado.stopRequested = true
  window.speechSynthesis.cancel()
  document.getElementById('btn-stop').disabled = true
  setStatus('Evaluación detenida por el usuario', 'red')
}


// ── Privados ──────────────────────────────────

/**
 * Intenta obtener preguntas del servidor; usa PREGUNTAS_FALLBACK si falla.
 * @returns {Promise<object[]>}
 */
async function _cargarPreguntas() {

    const res = await fetch(`${server_preguntas}/preguntas`);

    if (!res.ok) {
        throw new Error("No se pudieron cargar las preguntas");
    }

    const data = await res.json();


    return data;
}

/**
 * Procesa una pregunta completa:
 *   mostrar → hablar → grabar → enviar → guardar resultado.
 * @param {object} pregObj - Objeto con { id, pregunta, respuesta, duracion_ms }.
 * @param {number} idx     - Índice actual (base 0).
 */
async function _procesarPregunta(pregObj, idx) {
  const total = Estado.preguntas.length

  // 1. Marcar progreso
  marcarDot(idx, 'current', total)
  setStatus(`[${idx + 1}/${total}] Preparando pregunta…`, 'blue')

  // 2. Mostrar texto de la pregunta
  setPreguntaActual(`${idx + 1}. ${pregObj.pregunta}`, true)

  // 3. TTS habla la pregunta
  setStatus(`🔊 Hablando pregunta ${idx + 1}…`, 'amber')
  await _hablar(`Pregunta ${idx + 1}: ${pregObj.pregunta}`)

  if (Estado.stopRequested) return

  // 4. Pausa breve → activar grabación
  await sleep(DELAY_ANTES_GRABAR)
  setStatus('🎤 Escuchando tu respuesta… habla ahora', 'green')
  document.getElementById('dot-mic').className = 'dot green pulse'
  iniciarGrabacion()

  // 5. Esperar duración configurada
  const duracion = pregObj.duracion_ms || DURACION_ESCUCHA_DEFAULT
  await sleep(duracion)

  // 6. Detener grabación
  document.getElementById('dot-mic').className = 'dot green'
  setStatus('⏳ Procesando respuesta…', 'blue')
  const blob = await detenerGrabacion()

  // 7. Enviar al servidor y mostrar resultados
  if (blob && blob.size > 1000) {
    const data = await enviarAudio(blob, pregObj)

    setTranscripcion(data.transcripcion)

    if (data.porcentaje !== undefined) {
      setResultado(data.porcentaje, data.faltantes || [])
    }

    const pct_attn = Estado.framesTotal > 0
      ? Math.round(Estado.framesMirando / Estado.framesTotal * 100)
      : 0

    Estado.resultados.push({
      pregunta:      pregObj.pregunta,
      transcripcion: data.transcripcion || '',
      porcentaje:    data.porcentaje    || 0,
      faltantes:     data.faltantes     || [],
      mirando_pct:   pct_attn,
    })

    marcarDot(idx, data.porcentaje >= 50 ? 'done' : 'failed', total)

  } else {
    marcarDot(idx, 'failed', total)
    Estado.resultados.push({
      pregunta: pregObj.pregunta, transcripcion: '',
      porcentaje: 0, faltantes: [], mirando_pct: 0,
    })
  }

  setPreguntaActual('', false)

  // 8. Pausa entre preguntas
  if (!Estado.stopRequested && idx < total - 1) {
    setStatus('✔ Respuesta procesada — siguiente pregunta en breve…', 'green')
    await _hablar('Siguiente pregunta.')
    await sleep(DELAY_ENTRE_PREGUNTAS)
  }
}

/** Cierra la sesión, detiene el mic y muestra el reporte. */
async function _finalizarEvaluacion() {
  Estado.evalRunning = false
  pararMic()

  document.getElementById('btn-eval').textContent = '↺ Nueva evaluación'
  document.getElementById('btn-eval').disabled    = false
  document.getElementById('btn-stop').disabled    = true

  const pct_attn = Estado.framesTotal > 0
    ? Math.round(Estado.framesMirando / Estado.framesTotal * 100)
    : 0

  const pct_avg = Estado.resultados.length
    ? Math.round(Estado.resultados.reduce((s, r) => s + r.porcentaje, 0) / Estado.resultados.length)
    : 0

  setStatus(`✔ Evaluación finalizada — acierto promedio: ${pct_avg}%`, 'green')
  await _hablar(`Evaluación finalizada. Tu porcentaje de acierto fue de ${pct_avg} por ciento.`)

  mostrarReporte(pct_avg, pct_attn, Estado.resultados)
}

/**
 * Habla un texto con la API SpeechSynthesis y espera a que termine.
 * @param {string} texto - Texto a pronunciar.
 * @returns {Promise<void>}
 */
function _hablar(texto) {
  return new Promise(resolve => {
    window.speechSynthesis.cancel()

    const utter   = new SpeechSynthesisUtterance(texto)
    utter.lang    = IDIOMA
    utter.rate    = 0.92
    utter.pitch   = 1
    utter.volume  = 1

    setSpeakingRing(true, texto)

    utter.onend   = () => { setSpeakingRing(false); resolve() }
    utter.onerror = () => { setSpeakingRing(false); resolve() }

    window.speechSynthesis.speak(utter)
  })
}