/**
 * useThemeStore — persists theme preference to backend /settings/.
 *
 * On init: reads theme from backend, applies to <html data-theme>.
 * On change: writes to backend, applies immediately.
 */
import { create } from 'zustand'
import { apiFetch } from '../utils/api'

export type Theme = 'light' | 'dark'

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

interface ThemeState {
  theme: Theme
  loaded: boolean
  setTheme: (theme: Theme) => Promise<void>
  loadTheme: () => Promise<void>
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'light',
  loaded: false,

  loadTheme: async () => {
    try {
      const res  = await apiFetch(`/settings/`)
      const data = await res.json()
      const theme: Theme = data.theme === 'dark' ? 'dark' : 'light'
      applyTheme(theme)
      set({ theme, loaded: true })
    } catch {
      applyTheme('light')
      set({ loaded: true })
    }
  },

  setTheme: async (theme: Theme) => {
    applyTheme(theme)
    set({ theme })
    try {
      await apiFetch(`/settings/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { theme } }),
      })
    } catch { /* non-critical — UI already updated */ }
  },
}))
