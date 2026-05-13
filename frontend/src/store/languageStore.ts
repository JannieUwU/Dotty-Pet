/**
 * useLanguageStore — persists language preference to backend /settings/.
 *
 * On init: reads language from backend.
 * On change: writes to backend, triggers immediate re-render via Zustand.
 */
import { create } from 'zustand'
import type { Lang } from '../i18n'
import { apiFetch } from '../utils/api'

interface LanguageState {
  language: Lang
  loaded: boolean
  setLanguage: (language: Lang) => Promise<void>
  loadLanguage: () => Promise<void>
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'en',
  loaded: false,

  loadLanguage: async () => {
    try {
      const res  = await apiFetch(`/settings/`)
      const data = await res.json()
      const language: Lang = data.language === 'zh' ? 'zh' : 'en'
      set({ language, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  setLanguage: async (language: Lang) => {
    set({ language })
    try {
      await apiFetch(`/settings/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { language } }),
      })
    } catch { /* non-critical — UI already updated */ }
  },
}))
