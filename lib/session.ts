import type { PlayerSession } from './types'

const KEY = 'pll-session-v2'

export function saveSession(s: PlayerSession) {
  if (typeof window === 'undefined') return
  // No dejamos el usuario guardado permanentemente en el celular.
  // Solo se conserva mientras la pestaña actual siga abierta.
  try { localStorage.removeItem(KEY) } catch {}
  sessionStorage.setItem(KEY, JSON.stringify(s))
}

export function getSession(): PlayerSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearSession() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(KEY)
  try { localStorage.removeItem(KEY) } catch {}
}
