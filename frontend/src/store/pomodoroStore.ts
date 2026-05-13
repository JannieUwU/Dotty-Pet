import { create } from 'zustand'
import { subscribeAccountScopeChanged } from '../utils/accountScope'
import { apiFetch } from '../utils/api'

export interface FocusSession {
  id: string
  task: string
  start: string
  end: string
  mins: number
  date: string
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const localDateStr = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const localHHMM = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`

// Timer state lives in the store so it survives page navigation
export interface TimerState {
  running: boolean
  isFocus: boolean
  focusMin: number
  breakMin: number
  // Timestamp (ms) when the current phase started, null if not running
  phaseStartedAt: number | null
  // Seconds remaining when the timer was last paused
  pausedSecondsLeft: number | null
  taskName: string
  // Timestamp (ms) when the focus session started (for logging)
  sessionStartedAt: number | null
  advSettings: { autoBreak: boolean; autoFocus: boolean; longBreakEvery: number; longBreakDur: number }
  finished: boolean
}

export interface PhaseEndResult {
  wasFocus: boolean
  sessionToLog: Omit<FocusSession, 'id'> | null
}

interface PomodoroState extends TimerState {
  sessions: FocusSession[]
  loadSessions: (month?: string) => Promise<void>
  addSession: (session: Omit<FocusSession, 'id'>) => Promise<void>

  // Timer actions
  setTaskName: (name: string) => void
  setFocusMin: (m: number) => void
  setBreakMin: (m: number) => void
  setAdvSettings: (s: TimerState['advSettings']) => void
  playPause: () => void
  reset: () => void
  // Pure check: returns seconds remaining, never mutates store
  getSecondsLeft: () => number
  // Called once when the rAF loop detects phase has ended — mutates store exactly once
  endPhase: () => PhaseEndResult
}

export const usePomodoroStore = create<PomodoroState>((set, get) => ({
  running: false,
  isFocus: true,
  finished: false,
  focusMin: 25,
  breakMin: 5,
  phaseStartedAt: null,
  pausedSecondsLeft: null,
  taskName: 'Task name',
  sessionStartedAt: null,
  advSettings: { autoBreak: false, autoFocus: false, longBreakEvery: 4, longBreakDur: 15 },
  sessions: [],

  setTaskName: (name) => set({ taskName: name }),

  setFocusMin: (m) => set((s) => ({
    focusMin: m,
    pausedSecondsLeft: s.isFocus ? null : s.pausedSecondsLeft,
    phaseStartedAt: s.isFocus && s.running ? Date.now() : s.phaseStartedAt,
  })),

  setBreakMin: (m) => set((s) => ({
    breakMin: m,
    pausedSecondsLeft: !s.isFocus ? null : s.pausedSecondsLeft,
    phaseStartedAt: !s.isFocus && s.running ? Date.now() : s.phaseStartedAt,
  })),

  setAdvSettings: (advSettings) => set({ advSettings }),

  playPause: () => {
    const s = get()
    if (s.running) {
      const totalSecs = (s.isFocus ? s.focusMin : s.breakMin) * 60
      const elapsed = s.phaseStartedAt ? Math.floor((Date.now() - s.phaseStartedAt) / 1000) : 0
      const left = Math.max(0, totalSecs - elapsed)
      set({ running: false, pausedSecondsLeft: left, phaseStartedAt: null, finished: false })
    } else {
      const now = Date.now()
      const sessionStartedAt = s.isFocus && !s.sessionStartedAt ? now : s.sessionStartedAt
      const totalSecs = (s.isFocus ? s.focusMin : s.breakMin) * 60
      const pausedLeft = s.pausedSecondsLeft ?? totalSecs
      const fakeStart = now - (totalSecs - pausedLeft) * 1000
      set({ running: true, phaseStartedAt: fakeStart, pausedSecondsLeft: null, sessionStartedAt, finished: false })
    }
  },

  reset: () => {
    const s = get()
    let sessionToLog: Omit<FocusSession, 'id'> | null = null
    if (s.isFocus && s.sessionStartedAt) {
      const end = new Date()
      const startDate = new Date(s.sessionStartedAt)
      const actualMins = Math.round((end.getTime() - s.sessionStartedAt) / 60000)
      if (actualMins > 0) {
        sessionToLog = {
          task: s.taskName,
          start: localHHMM(startDate),
          end: localHHMM(end),
          mins: actualMins,
          date: localDateStr(end),
        }
      }
    }
    set({ running: false, isFocus: true, phaseStartedAt: null, pausedSecondsLeft: null, sessionStartedAt: null, finished: false })
    if (sessionToLog) get().addSession(sessionToLog)
  },

  // Pure read — safe to call every rAF frame, never mutates store
  getSecondsLeft: () => {
    const s = get()
    const totalSecs = (s.isFocus ? s.focusMin : s.breakMin) * 60
    if (!s.running || !s.phaseStartedAt) return s.pausedSecondsLeft ?? totalSecs
    const elapsed = Math.floor((Date.now() - s.phaseStartedAt) / 1000)
    return Math.max(0, totalSecs - elapsed)
  },

  // Called exactly once by the rAF loop when it detects phase has ended
  endPhase: () => {
    const s = get()
    const wasFocus = s.isFocus
    let sessionToLog: Omit<FocusSession, 'id'> | null = null
    if (wasFocus && s.sessionStartedAt) {
      const end = new Date()
      const startDate = new Date(s.sessionStartedAt)
      const actualMins = Math.round((end.getTime() - s.sessionStartedAt) / 60000)
      sessionToLog = {
        task: s.taskName,
        start: localHHMM(startDate),
        end: localHHMM(end),
        mins: actualMins || s.focusMin,
        date: localDateStr(end),
      }
    }
    const nextIsFocus = !wasFocus
    const autoStart = nextIsFocus ? s.advSettings.autoFocus : s.advSettings.autoBreak
    const now = Date.now()
    set({
      isFocus: nextIsFocus,
      running: autoStart,
      phaseStartedAt: autoStart ? now : null,
      pausedSecondsLeft: null,
      sessionStartedAt: autoStart && nextIsFocus ? now : null,
      finished: !autoStart,
    })
    return { wasFocus, sessionToLog }
  },

  // ── loaders ────────────────────────────────────────────────────────────────

  loadSessions: async (month) => {
    try {
      const url = month ? `/focus-sessions/?month=${month}` : `/focus-sessions/`
      const res = await apiFetch(url)
      const data = await res.json()
      set({
        sessions: data.map((s: any) => ({
          id: String(s.id),
          task: s.task_name,
          start: s.start_time,
          end: s.end_time,
          mins: s.duration_min,
          date: s.date,
        }))
      })
    } catch (err) {
      console.error('[pomodoroStore] loadSessions failed:', err)
    }
  },

  addSession: async (session) => {
    try {
      const res = await apiFetch(`/focus-sessions/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_name: session.task,
          start_time: session.start,
          end_time: session.end,
          duration_min: session.mins,
          focus_min: session.mins,
          date: session.date,
        }),
      }, 1)
      const data = await res.json()
      set((s) => ({
        sessions: [{
          id: String(data.id),
          task: data.task_name,
          start: data.start_time,
          end: data.end_time,
          mins: data.duration_min,
          date: data.date,
        }, ...s.sessions]
      }))
    } catch (err) {
      console.error('[pomodoroStore] addSession failed:', err)
    }
  },
}))

// ── Account scope subscription ────────────────────────────────────────────────
export const _unsubPomodoroScope = subscribeAccountScopeChanged(() => {
  usePomodoroStore.getState().loadSessions()
})
