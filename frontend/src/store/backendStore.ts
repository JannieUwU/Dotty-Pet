import { create } from 'zustand'
import { API_BASE } from '../utils/api'

// Tracks whether the Python backend is reachable.
// 'connecting' — waiting for backend:ready IPC (or polling fallback)
// 'ready'      — backend responded to /health
// 'error'      — backend failed to start within the timeout

export type BackendStatus = 'connecting' | 'ready' | 'error'

const HEALTH_URL = `${API_BASE}/health`
const POLL_TIMEOUT_MS = 15_000
const POLL_INTERVAL_MS = 150          // check every 150 ms
const HEALTH_REQUEST_TIMEOUT_MS = 300 // abort individual request after 300 ms

interface BackendState {
  status: BackendStatus
  errorMsg: string | null
  /** Called by Electron IPC or the polling fallback when backend is confirmed ready. */
  setReady: () => void
  /** Called when backend fails to start within the timeout. */
  setError: (msg: string) => void
  /**
   * Fallback for non-Electron environments (plain browser dev mode).
   * Polls /health until ready or timeout. Idempotent — safe to call multiple times.
   */
  pollUntilReady: () => void
  /**
   * Lets the user retry after an error without restarting the whole app.
   * Resets status to 'connecting' and starts a fresh poll.
   */
  retry: () => void
}

// Module-level flag so pollUntilReady is idempotent across React StrictMode
// double-invocations and any other accidental re-calls.
let _pollActive = false

export const useBackendStore = create<BackendState>((set, get) => ({
  status: 'connecting',
  errorMsg: null,

  setReady: () => {
    _pollActive = false
    set({ status: 'ready', errorMsg: null })
  },

  setError: (msg) => {
    _pollActive = false
    console.error('[backendStore] Backend error:', msg)
    set({ status: 'error', errorMsg: msg })
  },

  pollUntilReady: () => {
    if (_pollActive || get().status !== 'connecting') return
    _pollActive = true

    const deadline = Date.now() + POLL_TIMEOUT_MS

    const attempt = async () => {
      // Another code path (IPC) may have already resolved the status
      if (!_pollActive) return

      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), HEALTH_REQUEST_TIMEOUT_MS)
        const res = await fetch(HEALTH_URL, { signal: controller.signal })
        clearTimeout(timer)
        if (res.ok) { get().setReady(); return }
      } catch {
        // Network error or abort — expected while backend is starting
      }

      if (Date.now() >= deadline) {
        get().setError('Backend did not respond within 15 seconds. Please restart the app.')
        return
      }

      setTimeout(attempt, POLL_INTERVAL_MS)
    }

    attempt()
  },

  retry: () => {
    _pollActive = false
    set({ status: 'connecting', errorMsg: null })
    // Small delay so the UI shows "connecting" before the first poll fires
    setTimeout(() => get().pollUntilReady(), 100)
  },
}))
