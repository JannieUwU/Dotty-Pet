/**
 * usePetStore — Zustand store for the Desktop Pet page.
 *
 * Manages four independent slices:
 *   model      — current VRM model name + recent list (localStorage)
 *   memo       — daily memo fetch/generate state
 *   personality — personality prompt load/save state
 *   reviews    — interaction review timeline
 */

import { create } from 'zustand'
import type { Review } from './panels/ReviewTimeline'
import { apiFetch } from '../../utils/api'
import { scopedStorageKey } from '../../utils/accountScope'

const RECENT_KEY = 'dotty_recent_models'
const MAX_RECENT = 3
const DRAFT_KEY = 'dotty_personality_draft'

// ── helpers ───────────────────────────────────────────────────────────────────

function loadRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(scopedStorageKey(RECENT_KEY)) ?? '[]') } catch { return [] }
}

function saveRecent(list: string[]) {
  localStorage.setItem(scopedStorageKey(RECENT_KEY), JSON.stringify(list))
}

function loadDraft(): string {
  try { return localStorage.getItem(scopedStorageKey(DRAFT_KEY)) ?? '' } catch { return '' }
}

function saveDraft(v: string) {
  try { localStorage.setItem(scopedStorageKey(DRAFT_KEY), v) } catch { /* ignore */ }
}

const API_PATH = '/pet'

// ── types ─────────────────────────────────────────────────────────────────────

export type MemoStatus = 'idle' | 'loading' | 'generating' | 'ready' | 'error'
export type ReviewsStatus = 'idle' | 'loading' | 'generating' | 'ready' | 'error'

export interface PetState {
  // ── model ──────────────────────────────────────────────────────────────────
  modelName: string
  recentModels: string[]
  modelLoading: boolean
  modelError: string | null

  loadVrm: (filePath: string) => Promise<void>
  pickAndLoadVrm: () => Promise<void>
  resetModel: () => Promise<void>
  setModelName: (name: string) => void
  removeRecentModel: (filePath: string) => void

  // ── memo ───────────────────────────────────────────────────────────────────
  memoStatus: MemoStatus
  memoContent: string
  memoGeneratedAt: string
  memoDate: string

  fetchMemo: () => Promise<void>
  regenerateMemo: () => Promise<void>

  // ── personality ────────────────────────────────────────────────────────────
  personality: string
  personalityDraft: string
  personalityLoading: boolean
  personalitySaving: boolean
  personalityError: string | null
  personalitySaved: boolean

  fetchPersonality: () => Promise<void>
  setPersonalityDraft: (v: string) => void
  savePersonality: () => Promise<void>

  // ── reviews ────────────────────────────────────────────────────────────────
  reviews: Review[]
  reviewsLoading: boolean
  reviewsStatus: ReviewsStatus
  reviewsRetentionCutoff: string   // YYYY-MM-DD — records before this date are pruned

  fetchReviews: () => Promise<void>
  addReview: (review: Omit<Review, 'id'>) => void
}

// ── store ─────────────────────────────────────────────────────────────────────

export const usePetStore = create<PetState>((set, get) => ({
  // ── model ──────────────────────────────────────────────────────────────────
  modelName: 'DEFAULT AVATAR',
  recentModels: loadRecent(),
  modelLoading: false,
  modelError: null,

  setModelName: (name) => set({ modelName: name }),

  removeRecentModel: (filePath: string) => {
    const updated = loadRecent().filter(p => p !== filePath)
    saveRecent(updated)
    set({ recentModels: updated })
  },

  loadVrm: async (filePath: string) => {
    set({ modelLoading: true, modelError: null })
    try {
      if (window.electron?.loadVrmModel) {
        // ── Electron path ──────────────────────────────────────────────────
        const result = await window.electron.loadVrmModel(filePath)
        if (!result.ok) {
          set({ modelLoading: false, modelError: result.reason ?? 'Failed to load model' })
          return
        }
        const name = result.name ?? filePath.split(/[\\/]/).pop()?.replace(/\.vrm$/i, '') ?? filePath
        const updated = [filePath, ...loadRecent().filter(p => p !== filePath)].slice(0, MAX_RECENT)
        saveRecent(updated)
        set({ modelName: name, recentModels: updated, modelLoading: false })
      } else {
        // ── Browser dev mode — direct Unity HTTP ───────────────────────────
        const res = await fetch('http://127.0.0.1:8765/model', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: filePath }),
        })
        // Check HTTP status first
        if (!res.ok) {
          set({ modelLoading: false, modelError: `Unity returned ${res.status}` })
          return
        }
        // Also check for an error field in the JSON body
        const json = await res.json().catch(() => ({}))
        if (json.error) {
          set({ modelLoading: false, modelError: `Unity error: ${json.error}` })
          return
        }
        const name = filePath.split(/[\\/]/).pop()?.replace(/\.vrm$/i, '') ?? filePath
        const updated = [filePath, ...loadRecent().filter(p => p !== filePath)].slice(0, MAX_RECENT)
        saveRecent(updated)
        set({ modelName: name, recentModels: updated, modelLoading: false })
      }
    } catch (e) {
      set({ modelLoading: false, modelError: String(e) })
    }
  },

  pickAndLoadVrm: async () => {
    try {
      const filePath = await window.electron?.openFileDialog?.()
      if (filePath) await get().loadVrm(filePath)
      // null means user cancelled — no error needed
    } catch (e) {
      set({ modelError: String(e) })
    }
  },

  resetModel: async () => {
    // Clear any stale loading/error state before resetting
    set({ modelError: null, modelLoading: false })
    try {
      if (window.electron?.resetVrmModel) {
        // Electron: go through main process (same channel as load)
        await window.electron.resetVrmModel()
      } else {
        // Browser dev mode: direct fetch
        await fetch('http://127.0.0.1:8765/model', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: '' }),
        })
      }
    } catch {
      // Unity may not be running — reset UI state regardless
    }
    set({ modelName: 'DEFAULT AVATAR' })
  },

  // ── memo ───────────────────────────────────────────────────────────────────
  memoStatus: 'idle',
  memoContent: '',
  memoGeneratedAt: '',
  memoDate: '',

  fetchMemo: async () => {
    set({ memoStatus: 'loading' })
    try {
      const res = await apiFetch(`${API_PATH}/daily-memo`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.status === 'ready') {
        set({
          memoStatus: 'ready',
          memoContent: data.content,
          memoGeneratedAt: data.generated_at,
          memoDate: data.memo_date,
        })
      } else {
        set({ memoStatus: 'generating', memoDate: data.memo_date ?? '' })
      }
    } catch {
      set({ memoStatus: 'error' })
    }
  },

  regenerateMemo: async () => {
    set({ memoStatus: 'generating', memoContent: '', memoGeneratedAt: '' })
    try {
      await apiFetch(`${API_PATH}/daily-memo/regenerate`, { method: 'POST' })
    } catch {
      set({ memoStatus: 'error' })
    }
  },

  // ── personality ────────────────────────────────────────────────────────────
  personality: '',
  personalityDraft: loadDraft(),
  personalityLoading: false,
  personalitySaving: false,
  personalityError: null,
  personalitySaved: false,

  fetchPersonality: async () => {
    if (get().personalityLoading) return
    set({ personalityLoading: true, personalityError: null })
    try {
      const res = await apiFetch(`${API_PATH}/personality`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      set({ personality: data.content ?? '', personalityLoading: false })
    } catch {
      set({ personalityLoading: false, personalityError: 'Could not load saved personality.' })
    }
  },

  setPersonalityDraft: (v) => {
    saveDraft(v)
    set({ personalityDraft: v, personalitySaved: false, personalityError: null })
  },

  savePersonality: async () => {
    const draft = get().personalityDraft.trim()
    if (!draft) return
    set({ personalitySaving: true, personalityError: null, personalitySaved: false })
    try {
      const res = await apiFetch(`${API_PATH}/personality`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: draft }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        set({
          personalitySaving: false,
          personalityError: data?.detail?.reason ?? data?.reason ?? 'Save failed',
        })
        return
      }
      set({
        personality: data.cleaned,
        personalityDraft: '',
        personalitySaving: false,
        personalitySaved: true,
      })
      saveDraft('')
      setTimeout(() => set({ personalitySaved: false }), 3000)
    } catch {
      set({ personalitySaving: false, personalityError: 'Network error. Please try again.' })
    }
  },

  // ── reviews ────────────────────────────────────────────────────────────────
  reviews: [] as Review[],
  reviewsLoading: false,
  reviewsStatus: 'idle' as ReviewsStatus,
  reviewsRetentionCutoff: '',

  fetchReviews: async () => {
    const current = usePetStore.getState().reviewsStatus
    if (current !== 'generating') {
      set({ reviewsLoading: true, reviewsStatus: 'loading' })
    }
    try {
      const res = await apiFetch(`${API_PATH}/reviews`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      set({
        reviews: data.reviews ?? [],
        reviewsLoading: false,
        reviewsStatus: 'ready',
        reviewsRetentionCutoff: data.retention_cutoff ?? '',
      })
    } catch {
      set({ reviewsLoading: false, reviewsStatus: 'error' })
    }
  },

  addReview: (review) => {
    const newReview: Review = { ...review, id: `r_${Date.now()}` }
    // Insert at front, deduplicate by date (in case WS fires before fetch completes)
    set(s => {
      const filtered = s.reviews.filter(r => r.date !== newReview.date)
      return { reviews: [newReview, ...filtered], reviewsStatus: 'ready' }
    })
  },
}))
