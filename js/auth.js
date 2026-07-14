/**
 * auth.js — Login y registro contra el backend.
 *
 * Depende de config.js (variable global `server_preguntas`).
 * Guarda el JWT en localStorage bajo la clave `auth_token`,
 * que luego usan las demás páginas para llamar a los
 * endpoints protegidos (ver `authFetch` en auth-guard.js).
 */

const CLAVE_TOKEN    = 'auth_token'
const CLAVE_USERNAME = 'auth_username'

document.addEventListener('DOMContentLoaded', () => {

  const formLogin = document.getElementById('form-login')
  if (formLogin) {
    formLogin.addEventListener('submit', manejarLogin)
  }

  const formRegistro = document.getElementById('form-registro')
  if (formRegistro) {
    formRegistro.addEventListener('submit', manejarRegistro)
  }

})

/** Envía username + password a /api/auth/login. */
async function manejarLogin(evento) {
  evento.preventDefault()

  const username = document.getElementById('login-username').value.trim()
  const password = document.getElementById('login-password').value

  const btn = document.getElementById('btn-login')
  btn.disabled = true

  try {
    const res = await fetch(`${server_preguntas}/api/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
    })

    if (!res.ok) {
      mostrarMensaje('login-mensaje', 'No se pudo iniciar sesión: datos inválidos', 'error')
      return
    }

    const data = await res.json()
    guardarSesion(data.token, data.username)

    // Login correcto → pantalla principal
    window.location.href = 'index.html'

  } catch (e) {
    mostrarMensaje('login-mensaje', 'No se pudo conectar con el servidor. Intenta de nuevo.', 'error')
  } finally {
    btn.disabled = false
  }
}

/** Envía todos los datos del formulario a /api/auth/registro. */
async function manejarRegistro(evento) {
  evento.preventDefault()

  const username  = document.getElementById('reg-username').value.trim()
  const password  = document.getElementById('reg-password').value
  const nombres   = document.getElementById('reg-nombres').value.trim()
  const apellidos = document.getElementById('reg-apellidos').value.trim()
  const carrera   = document.getElementById('reg-carrera').value.trim()

  const btn = document.getElementById('btn-registro')
  btn.disabled = true

  try {
    const res = await fetch(`${server_preguntas}/api/auth/registro`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password, nombres, apellidos, carrera }),
    })

    if (res.status === 409) {
      mostrarMensaje('registro-mensaje', 'Ese usuario ya está registrado, elige otro.', 'error')
      return
    }

    if (!res.ok) {
      mostrarMensaje('registro-mensaje', 'No se pudo completar el registro. Revisa los datos.', 'error')
      return
    }

    const data = await res.json()
    guardarSesion(data.token, data.username)

    // Registro correcto → pantalla principal (queda logueado de una vez)
    window.location.href = 'index.html'

  } catch (e) {
    mostrarMensaje('registro-mensaje', 'No se pudo conectar con el servidor. Intenta de nuevo.', 'error')
  } finally {
    btn.disabled = false
  }
}

/** Guarda el token JWT y el username para usarlos en el resto de la app. */
function guardarSesion(token, username) {
  localStorage.setItem(CLAVE_TOKEN, token)
  localStorage.setItem(CLAVE_USERNAME, username)
}

/** Muestra un mensaje de error/éxito dentro del formulario. */
function mostrarMensaje(elementId, texto, tipo) {
  const el = document.getElementById(elementId)
  el.textContent   = texto
  el.className     = `auth-mensaje ${tipo}`
  el.style.display = 'block'
}
