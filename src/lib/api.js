// ============================================================
// API · ARA CATÁLOGO
// ============================================================
// Punto único donde vive la URL del backend.
//
// Antes: la URL estaba hardcodeada en 13 sitios de App.jsx.
// Ahora: una variable de entorno la controla, con fallback al
// valor de producción para que la app siga funcionando si
// alguien clona el repo sin crear `.env.local`.
//
// Configuración local opcional (no commitear):
//
//   echo "VITE_BACKEND_HOST=https://araujo-bot.onrender.com" > .env.local
//
// Cómo usarlo:
//
//   import { BACKEND_HOST, CATALOGO_BASE, FACTURAS_BASE } from './lib/api.js'
//
//   fetch(`${CATALOGO_BASE}/public`)
//   fetch(`${FACTURAS_BASE}/imagenes`)
// ============================================================

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {}

export const BACKEND_HOST   = env.VITE_BACKEND_HOST || 'https://araujo-bot.onrender.com'
export const CATALOGO_BASE  = `${BACKEND_HOST}/api/catalogo`
export const FACTURAS_BASE  = `${BACKEND_HOST}/api/facturas`
