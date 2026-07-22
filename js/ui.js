/**
 * ui.js — Funciones de actualización del DOM.
 *
 * Ninguna lógica de negocio aquí: solo leer el DOM
 * y escribir en él. Todos los demás módulos llaman
 * estas funciones para reflejar cambios en pantalla.
 */

// ── Mapa de colores CSS ───────────────────────
const COLOR = {
  green: 'var(--green)',
  blue:  'var(--blue)',
  red:   'var(--red)',
  amber: 'var(--amber)',
  dim:   'var(--soft)',
}

// ── Helpers internos ─────────────────────────
const el = id => document.getElementById(id)


/**
 * Actualiza el indicador de estado (punto + texto + footer).
 * @param {string} txt   - Mensaje a mostrar.
 * @param {string} color - Clave de COLOR (green|blue|red|amber|dim).
 */
function setStatus(txt, color) {
  const c = COLOR[color] || COLOR.dim
  el('status-txt').textContent = txt
  el('status-txt').style.color = c
  el('status-big').style.color = c
  el('footer-r').textContent   = '● ' + txt.slice(0, 50)
}

/**
 * Actualiza la barra de acierto y el porcentaje.
 * @param {number}   pct       - Porcentaje 0-100.
 * @param {string[]} faltantes - Palabras que no dijo el usuario.
 */
function setResultado(pct, faltantes) {
  const color = pct >= 80 ? COLOR.green : pct >= 50 ? 'var(--accent)' : COLOR.red

  el('pct-big').textContent          = pct + '%'
  el('pct-big').style.color          = color
  el('result-fill').style.width      = pct + '%'
  el('result-fill').style.background = color

  const txt = faltantes.length ? faltantes.join(', ') : '¡Ninguna! Respuesta completa.'
  el('missing').textContent  = txt
  el('missing').style.color  = faltantes.length ? COLOR.dim : COLOR.green
}

/**
 * Actualiza el badge y barra de atención a cámara.
 * @param {boolean} mirando - True si el usuario miraba la cámara.
 * @param {string}  estado  - "ok" | "no_eyes" | "no_face".
 */
function setAttencionUI(mirando, estado) {
  const badge = el('attn-badge')
  const dot   = el('dot-cam')

  if (mirando) {
    badge.style.color = COLOR.green
    badge.textContent = '👁 Mirando ✔'
    dot.className     = 'dot green'
  } else if (estado === 'no_eyes') {
    badge.style.color = COLOR.amber
    badge.textContent = '👁 Ajusta posición'
    dot.className     = 'dot amber'
  } else {
    badge.style.color = COLOR.red
    badge.textContent = '😶 Sin rostro'
    dot.className     = 'dot red'
  }
}

/**
 * Actualiza la barra de atención acumulada.
 * @param {number} framesTotal   - Total de frames procesados.
 * @param {number} framesMirando - Frames con contacto visual.
 */
/**
 * Muestra u oculta el indicador de TTS en curso.
 * @param {boolean} visible - True para mostrar.
 * @param {string}  texto   - Texto que se está reproduciendo.
 */
function setSpeakingRing(visible, texto = '') {
  el('speaking-ring').style.display = visible ? 'flex' : 'none'
  if (texto) el('speaking-txt').textContent = texto
}

/**
 * Muestra la pregunta actual en el panel de la cámara.
 * @param {string}  texto  - Texto de la pregunta.
 * @param {boolean} activa - True para resaltar en ámbar.
 */
function setPreguntaActual(texto, activa = true) {
  const box = el('question-box')
  box.textContent = texto
  box.classList.toggle('active', activa)
}

/**
 * Muestra la transcripción reconocida.
 * @param {string} texto - Texto transcrito.
 */
function setTranscripcion(texto) {
  el('transcript').textContent = texto || '(sin audio reconocido)'
  el('transcript').style.color = texto ? 'var(--text)' : COLOR.dim
}

/**
 * Construye los dots de progreso según el número de preguntas.
 * @param {number} total - Cantidad de preguntas.
 */
function construirDots(total) {
  const wrap = el('dots-wrap')
  wrap.innerHTML = ''
  for (let i = 0; i < total; i++) {
    const d = document.createElement('div')
    d.className = 'q-dot'
    d.id        = `qdot-${i}`
    d.title     = `Pregunta ${i + 1}`
    wrap.appendChild(d)
  }
  el('progress-label').textContent = `0 / ${total}`
}

/**
 * Cambia el estado visual de un dot de progreso.
 * @param {number} idx  - Índice del dot.
 * @param {string} tipo - "current" | "done" | "failed".
 * @param {number} total - Total de preguntas para actualizar el contador.
 */
function marcarDot(idx, tipo, total) {
  const d = el(`qdot-${idx}`)
  if (d) d.className = `q-dot ${tipo}`
  const hechos = document.querySelectorAll('.q-dot.done, .q-dot.failed').length
  el('progress-label').textContent = `${hechos} / ${total}`
}

/**
 * Resetea todos los elementos del DOM a su estado inicial.
 */
function resetUI() {
  el('result-fill').style.width  = '0%'
  el('pct-big').textContent      = '—'
  el('missing').textContent      = 'Sin resultados aún'
  el('transcript').textContent   = 'Aún no hay audio…'
  el('transcript').style.color   = 'var(--soft)'
  el('dots-wrap').innerHTML      = ''
  el('progress-label').textContent = '—'
  el('report').style.display     = 'none'
  el('btn-eval').disabled        = false
  el('btn-eval').textContent     = '▶▶ Iniciar evaluación'
  el('btn-stop').disabled        = true
  setPreguntaActual('Inicia la evaluación para ver la pregunta…', false)
  setSpeakingRing(false)
  setStatus('Sesión reiniciada', 'dim')
}

/**
 * Construye y muestra el reporte final.
 * @param {number}   pct_avg  - Acierto promedio de la sesión.
 * @param {number}   pct_attn - Porcentaje de atención a cámara.
 * @param {object[]} resultados - Array de resultados por pregunta.
 */
function mostrarReporte(pct_avg, pct_attn, resultados) {
  const report = el('report')
  report.style.display = 'block'

  const cAvg  = pct_avg  >= 70 ? COLOR.green : pct_avg  >= 40 ? COLOR.amber : COLOR.red
  const cAttn = pct_attn >= 70 ? COLOR.green : pct_attn >= 40 ? COLOR.amber : COLOR.red

  const filas = resultados.map((r, i) => `
    <div class="report-row">
      <span style="color:var(--soft)">${i + 1}. ${r.pregunta.slice(0, 42)}…</span>
      <span class="report-val" style="color:${r.porcentaje >= 50 ? COLOR.green : COLOR.red}">
        ${r.porcentaje}%
      </span>
    </div>
  `).join('')

  el('report-content').innerHTML = `
    <div class="report-row">
      <span>Acierto promedio</span>
      <span class="report-val" style="color:${cAvg}">${pct_avg}%</span>
    </div>
    <div class="report-row">
      <span>Atención a cámara</span>
      <span class="report-val" style="color:${cAttn}">${pct_attn}%</span>
    </div>
    <div class="report-row">
      <span>Preguntas respondidas</span>
      <span class="report-val">${resultados.length}</span>
    </div>
    <div style="margin-top:10px" class="sec-label accent">DETALLE POR PREGUNTA</div>
    <div class="divider" style="margin:5px 0 4px"></div>
    ${filas}
  `

  report.scrollIntoView({ behavior: 'smooth' })
}

/**
 * Ventana flotante (modal) con las sugerencias de mejora, que aparece
 * automaticamente apenas termina la entrevista. Se crea una sola vez y se
 * reutiliza en las siguientes evaluaciones (solo se le cambia el contenido).
 * Se cierra con el boton "Cerrar" o haciendo click fuera de la tarjeta.
 * @param {object[]} sugerencias - Lista de { tipo, mensaje, detalle }.
 */
function mostrarModalSugerencias(sugerencias) {
  if (!sugerencias || !sugerencias.length) return

  let overlay = document.getElementById('modal-sugerencias-overlay')

  if (!overlay) {
    overlay = document.createElement('div')
    overlay.id = 'modal-sugerencias-overlay'
    overlay.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,0.6);
      display:flex; align-items:center; justify-content:center;
      z-index:1000; padding:20px;
    `
    overlay.innerHTML = `
      <div style="
        background:var(--surface); border:1px solid var(--border);
        border-radius:10px; max-width:480px; width:100%; max-height:80vh;
        overflow-y:auto; padding:20px; box-shadow:0 10px 40px rgba(0,0,0,0.5);
      ">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
          <span style="font-size:15px; font-weight:600; color:var(--text);">
            📋 Sugerencias de mejora
          </span>
          <button id="btn-cerrar-modal-sugerencias" class="btn btn-secondary"
                  style="padding:4px 10px; width:auto; font-size:12px;">
            ✕ Cerrar
          </button>
        </div>
        <div id="modal-sugerencias-content"></div>
      </div>
    `
    document.body.appendChild(overlay)

    // Cerrar al hacer click fuera de la tarjeta (sobre el fondo oscuro)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.style.display = 'none'
    })
  }

  const iconoPorTipo = { respuesta: '📝', atencion: '👁', positivo: '✅' }
  const colorPorTipo  = { respuesta: COLOR.amber, atencion: COLOR.amber, positivo: COLOR.green }

  document.getElementById('modal-sugerencias-content').innerHTML = sugerencias.map(s => `
    <div style="border-left:3px solid ${colorPorTipo[s.tipo] || COLOR.amber};
         padding:8px 10px; margin-bottom:10px; background:rgba(255,255,255,0.03); border-radius:4px;">
      <div style="color:var(--text)">${iconoPorTipo[s.tipo] || '💡'} ${s.mensaje}</div>
      ${s.detalle ? `
        <div style="margin-top:6px; padding-top:6px; border-top:1px dashed var(--border);
             color:var(--soft); font-size:12.5px;">
          <strong>Respuesta esperada:</strong> ${s.detalle}
        </div>
      ` : ''}
    </div>
  `).join('')

  // El boton de cerrar se re-conecta cada vez (el contenido se reemplaza,
  // pero el overlay/boton se crean una sola vez arriba).
  document.getElementById('btn-cerrar-modal-sugerencias').onclick = () => {
    overlay.style.display = 'none'
  }

  overlay.style.display = 'flex'
}