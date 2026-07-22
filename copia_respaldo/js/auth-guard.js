/**
 * auth-guard.js — Protege index.html y agrega el token a las peticiones.
 *
 * 1. Si no hay token guardado, redirige a login.html.
 * 2. Expone `authFetch(url, options)`, un reemplazo de `fetch` que agrega
 *    automaticamente el header "Authorization: Bearer <token>". Los
 *    endpoints protegidos del backend (todo excepto /api/auth/**) ahora
 *    lo exigen.
 *
 * Debe cargarse ANTES que config.js/app.js en index.html:
 *   <script src="js/auth-guard.js"></script>
 */

(function protegerPagina() {
  const token = localStorage.getItem('auth_token')
  if (!token) {
    window.location.href = 'login.html'
  }
})()

/**
 * Igual que fetch(), pero agrega el JWT guardado en el login/registro.
 * Uso: reemplazar `fetch(url, opts)` por `authFetch(url, opts)` en
 * camara.js, microfono.js y evaluacion.js.
 */
function authFetch(url, options = {}) {
  const token = localStorage.getItem('auth_token')

  const headers = new Headers(options.headers || {})
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return fetch(url, { ...options, headers })
}

/** Cierra sesión y vuelve al login. Puedes colgarlo de un botón "Salir". */
function cerrarSesion() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('auth_username')
  window.location.href = 'login.html'
}
