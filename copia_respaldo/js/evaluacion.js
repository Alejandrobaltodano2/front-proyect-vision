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
  if (!Estado.camRunning) await iniciarCamara()
  if (!Estado.micActive)  await iniciarMic()

  Estado.preguntas = await _cargarPreguntas()

  Estado.reiniciarSesion()
  Estado.evalRunning = true

  document.getElementById('btn-eval').disabled        = true
  document.getElementById('btn-stop').disabled        = false
  document.getElementById('report').style.display     = 'none'
  construirDots(Estado.preguntas.length)

  for (let i = 0; i < Estado.preguntas.length; i++) {
    if (Estado.stopRequested) break
    Estado.idxActual = i
    await _procesarPregunta(Estado.preguntas[i], i)
  }

  await _finalizarEvaluacion()
}

function detenerEvaluacion() {
  Estado.stopRequested = true
  window.speechSynthesis.cancel()
  document.getElementById('btn-stop').disabled = true
  setStatus('Evaluación detenida por el usuario', 'red')
}


// ── Privados ──────────────────────────────────

async function _cargarPreguntas() {
    const res = await authFetch(`${server_preguntas}/preguntas`);
    if (!res.ok) {
        throw new Error("No se pudieron cargar las preguntas");
    }
    const data = await res.json();
    return data;
}

async function _procesarPregunta(pregObj, idx) {
  const total = Estado.preguntas.length

  marcarDot(idx, 'current', total)
  setStatus(`[${idx + 1}/${total}] Preparando pregunta…`, 'blue')

  setPreguntaActual(`${idx + 1}. ${pregObj.pregunta}`, true)

  setStatus(`🔊 Hablando pregunta ${idx + 1}…`, 'amber')
  await _hablar(`Pregunta ${idx + 1}: ${pregObj.pregunta}`)

  if (Estado.stopRequested) return

  await sleep(DELAY_ANTES_GRABAR)
  setStatus('🎤 Escuchando tu respuesta… habla ahora', 'green')
  document.getElementById('dot-mic').className = 'dot green pulse'
  iniciarGrabacion()

  const duracion = pregObj.duracion_ms || DURACION_ESCUCHA_DEFAULT
  await sleep(duracion)

  document.getElementById('dot-mic').className = 'dot green'
  setStatus('⏳ Procesando respuesta…', 'blue')
  const blob = await detenerGrabacion()

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
      pregunta:          pregObj.pregunta,
      respuestaEsperada: pregObj.respuesta || '',
      transcripcion:     data.transcripcion || '',
      porcentaje:        data.porcentaje    || 0,
      faltantes:         data.faltantes     || [],
      mirando_pct:       pct_attn,
    })

    marcarDot(idx, data.porcentaje >= 50 ? 'done' : 'failed', total)

  } else {
    marcarDot(idx, 'failed', total)
    Estado.resultados.push({
      pregunta: pregObj.pregunta, respuestaEsperada: pregObj.respuesta || '',
      transcripcion: '', porcentaje: 0, faltantes: [], mirando_pct: 0,
    })
  }

  setPreguntaActual('', false)

  if (!Estado.stopRequested && idx < total - 1) {
    setStatus('✔ Respuesta procesada — siguiente pregunta en breve…', 'green')
    await _hablar('Siguiente pregunta.')
    await sleep(DELAY_ENTRE_PREGUNTAS)
  }
}

/** Cierra la sesión, detiene el mic y muestra el reporte + el modal de sugerencias. */
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

  const sugerencias = await _obtenerSugerencias()

  mostrarReporte(pct_avg, pct_attn, Estado.resultados)
  mostrarModalSugerencias(sugerencias)
}

/**
 * Manda el detalle de toda la entrevista al backend para que calcule las
 * sugerencias de mejora. Si falla, el reporte se muestra igual sin sugerencias.
 * @returns {Promise<object[]>}
 */
async function _obtenerSugerencias() {
  try {
    const cuerpo = {
      resultados: Estado.resultados.map(r => ({
        pregunta:          r.pregunta,
        respuestaEsperada: r.respuestaEsperada || '',
        transcripcion:     r.transcripcion,
        porcentaje:        r.porcentaje,
        atencionPct:       r.mirando_pct,
      })),
    }

    const res = await authFetch(`${server_preguntas}/api/evaluacion/resumen`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(cuerpo),
    })

    if (!res.ok) return []

    const data = await res.json()
    return data.sugerencias || []

  } catch (e) {
    console.warn('No se pudieron obtener sugerencias:', e.message)
    return []
  }
}

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