/**
 * useDataStore — persists data_retention_months to backend /settings/
 * and exposes a prune action that calls POST /settings/prune.
 */
import { create } from 'zustand'
import { apiFetch } from '../utils/api'

export type RetentionMonths = '1' | '3' | '6' | '12'

export interface PruneResult {
  months: number
  cutoff: string
  deleted: Record<string, number>
  total_deleted: number
}

interface DataState {
  retention: RetentionMonths
  clearResourcesOnLogout: boolean
  loaded: boolean
  pruning: boolean
  lastPrune: PruneResult | null
  pruneError: string | null

  loadRetention: () => Promise<void>
  setRetention: (v: RetentionMonths) => Promise<void>
  setClearResourcesOnLogout: (v: boolean) => Promise<void>
  clearResourceLibrary: () => Promise<void>
  pruneNow: () => Promise<void>
}

export const useDataStore = create<DataState>((set) => ({
  retention:  '3',
  clearResourcesOnLogout: false,
  loaded:     false,
  pruning:    false,
  lastPrune:  null,
  pruneError: null,

  loadRetention: async () => {
    try {
      const res  = await apiFetch(`/settings/`)
      const data = await res.json()
      const v = data.data_retention_months
      const retention: RetentionMonths =
        v === '1' || v === '3' || v === '6' || v === '12' ? v : '3'
      const clearResourcesOnLogout = data.clear_resources_on_logout === '1'
      set({ retention, clearResourcesOnLogout, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  setRetention: async (retention: RetentionMonths) => {
    set({ retention, lastPrune: null, pruneError: null })
    try {
      await apiFetch(`/settings/`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ data: { data_retention_months: retention } }),
      })
    } catch { /* non-critical — UI already updated */ }
  },

  setClearResourcesOnLogout: async (v: boolean) => {
    set({ clearResourcesOnLogout: v })
    try {
      await apiFetch(`/settings/`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ data: { clear_resources_on_logout: v ? '1' : '0' } }),
      })
    } catch { /* non-critical */ }
  },

  clearResourceLibrary: async () => {
    await apiFetch(`/resources/clear`, { method: 'DELETE' })
    // errors are swallowed — logout continues regardless
  },

  pruneNow: async () => {
    set({ pruning: true, pruneError: null, lastPrune: null })
    try {
      const res = await apiFetch(`/settings/prune`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const result: PruneResult = await res.json()
      set({ pruning: false, lastPrune: result })
    } catch (e) {
      set({ pruning: false, pruneError: String(e) })
    }
  },
}))
