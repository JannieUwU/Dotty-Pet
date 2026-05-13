import { useEffect, useRef } from 'react'
import { useScheduleStore } from '../store/scheduleStore'
import { usePomodoroStore } from '../store/pomodoroStore'
import { eventMessage, habitMessage, focusEndMessage, breakEndMessage } from '../utils/petMessages'
import { scopedStorageKey } from '../utils/accountScope'

const pad = (n: number) => String(n).padStart(2, '0')

// ── Local date/time helpers ───────────────────────────────────────────────────
const localDateStr = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const localHHMM = (d: Date) =>
  `${pad(d.getHours())}:${pad(d.getMinutes())}`

// ── Fired-today persistence ───────────────────────────────────────────────────
const FIRED_KEY = 'dotty-notif-fired'

const loadFired = (): Set<string> => {
  try {
    const raw = localStorage.getItem(scopedStorageKey(FIRED_KEY))
    if (!raw) return new Set()
    const { date, keys } = JSON.parse(raw) as { date: string; keys: string[] }
    if (date !== localDateStr(new Date())) return new Set()
    return new Set(keys)
  } catch {
    return new Set()
  }
}

const saveFired = (set: Set<string>) => {
  try {
    localStorage.setItem(scopedStorageKey(FIRED_KEY), JSON.stringify({
      date: localDateStr(new Date()),
      keys: [...set],
    }))
  } catch {}
}

const markFired = (fired: Set<string>, key: string) => {
  fired.add(key)
  saveFired(fired)
}

// ── IPC bridge ────────────────────────────────────────────────────────────────
const sendNotification = (message: string, emotion: string) => {
  window.electron?.petNotify?.(message, emotion)
}

// ── Schedule/habit check (runs every minute) ─────────────────────────────────
const runScheduleCheck = (fired: Set<string>) => {
  const now   = new Date()
  const hhmm  = localHHMM(now)
  const today = localDateStr(now)
  const dow   = now.getDay()

  const { events, habits } = useScheduleStore.getState()

  for (const ev of events) {
    if (ev.date !== today || !ev.startTime) continue
    if (!ev.startTime.startsWith(hhmm)) continue
    const key = `ev-${ev.id}-${today}`
    if (fired.has(key)) continue
    markFired(fired, key)
    sendNotification(eventMessage(ev.title), 'idle')
  }

  for (const h of habits) {
    if (!h.reminder || !h.reminderTime) continue
    if (!h.reminderTime.startsWith(hhmm)) continue
    const activeDays = h.days.filter(d => Number.isInteger(d) && d >= 0 && d <= 6)
    if (activeDays.length > 0 && !activeDays.includes(dow)) continue
    const key = `habit-${h.id}-${today}`
    if (fired.has(key)) continue
    markFired(fired, key)
    sendNotification(habitMessage(h.name, h.icon), 'happy')
  }
}

// ── Pomodoro phase-end check (runs every second) ─────────────────────────────
// Lives here (global, always mounted) so it fires regardless of which page is open.
const runPomodoroCheck = (lastEndedRef: { current: number | null }) => {
  const s = usePomodoroStore.getState()
  if (!s.running || !s.phaseStartedAt) return

  const totalSecs = (s.isFocus ? s.focusMin : s.breakMin) * 60
  const elapsed   = Math.floor((Date.now() - s.phaseStartedAt) / 1000)
  if (elapsed < totalSecs) return

  // Guard: only fire once per phase
  if (s.phaseStartedAt === lastEndedRef.current) return
  lastEndedRef.current = s.phaseStartedAt

  const result = s.endPhase()
  if (result.sessionToLog) s.addSession(result.sessionToLog)

  const msg     = result.wasFocus ? focusEndMessage(s.taskName) : breakEndMessage()
  const emotion = result.wasFocus ? 'happy' : 'focused'
  sendNotification(msg, emotion)
}

// ── Component ─────────────────────────────────────────────────────────────────
export const NotificationScheduler = () => {
  const firedRef       = useRef<Set<string>>(loadFired())
  const lastEndedPhase = useRef<number | null>(null)

  // ── Pomodoro: 1-second interval, always active regardless of current page ──
  useEffect(() => {
    const id = setInterval(() => runPomodoroCheck(lastEndedPhase), 1000)
    return () => clearInterval(id)
  }, [])

  // ── Schedule + habits: per-minute, aligned to :00 boundary ───────────────
  useEffect(() => {
    const fired = firedRef.current
    let minuteInterval: ReturnType<typeof setInterval> | null = null
    let alignTimeout:   ReturnType<typeof setTimeout>  | null = null
    let unsub: (() => void) | null = null

    const startClock = () => {
      const now = new Date()
      const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 50
      alignTimeout = setTimeout(() => {
        runScheduleCheck(fired)
        minuteInterval = setInterval(() => runScheduleCheck(fired), 60_000)
      }, msUntilNextMinute)
    }

    startClock()

    // Fire one immediate check once store data has loaded.
    // If data is already present, run immediately; otherwise subscribe and
    // run as soon as the first batch of data arrives.
    const { events, habits } = useScheduleStore.getState()
    if (events.length > 0 || habits.length > 0) {
      runScheduleCheck(fired)
    } else {
      unsub = useScheduleStore.subscribe((state, prev) => {
        const wasEmpty = prev.events.length === 0 && prev.habits.length === 0
        const hasData  = state.events.length > 0 || state.habits.length > 0
        if (wasEmpty && hasData) {
          unsub?.()
          unsub = null
          runScheduleCheck(fired)
        }
      })
    }

    return () => {
      unsub?.()
      if (alignTimeout   !== null) clearTimeout(alignTimeout)
      if (minuteInterval !== null) clearInterval(minuteInterval)
    }
  }, [])

  return null
}
