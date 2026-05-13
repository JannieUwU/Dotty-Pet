import { useEffect, useRef } from 'react'
import { Layout } from './components/layout/Layout'
import { NotificationScheduler } from './components/NotificationScheduler'
import { useScheduleStore } from './store/scheduleStore'
import { usePomodoroStore } from './store/pomodoroStore'
import { useAppStore, type NavPage } from './store/appStore'
import { useBackendStore } from './store/backendStore'
import { useThemeStore } from './store/themeStore'
import { useLanguageStore } from './store/languageStore'
import { useDataStore } from './store/dataStore'
import { LoginPage } from './components/auth/LoginPage'
import { BackendLoadingScreen } from './components/BackendLoadingScreen'

// If this BrowserWindow was opened as the login window, render only the login page.
// This check is stable for the lifetime of the window so it's safe to branch here.
const IS_LOGIN_WINDOW = window.electron?.isLoginWindow === true

function LoginApp() {
  return <LoginPage />
}

function MainApp() {
  const { todayStr, setTodayStr, loadEvents, loadGoals, loadHabits, loadChecks, addEvent } = useScheduleStore()
  const { loadSessions } = usePomodoroStore()
  const { setPage } = useAppStore()
  const { status, setReady, setError, pollUntilReady } = useBackendStore()
  const { loadTheme } = useThemeStore()
  const { loadLanguage } = useLanguageStore()
  const { loadRetention } = useDataStore()

  // Stable refs so IPC callbacks registered once don't capture stale closures
  const addEventRef = useRef(addEvent)
  const setPageRef  = useRef(setPage)
  useEffect(() => { addEventRef.current = addEvent }, [addEvent])
  useEffect(() => { setPageRef.current  = setPage  }, [setPage])

  // ── Wire up backend readiness (runs once on mount) ─────────────────────────
  useEffect(() => {
    if (window.electron?.getBackendStatus) {
      // Pull: ask main process for current state immediately on mount.
      // This handles the case where backend was already ready before the
      // renderer finished loading — no race, no missed push event.
      window.electron.getBackendStatus().then((state) => {
        if (state === 'ready') { setReady(); return }
        if (state === 'error') { setError('Backend failed to start. Please restart the app.'); return }
        // state === 'pending': backend still starting — register push listeners
        window.electron!.onBackendReady?.(setReady)
        window.electron!.onBackendError?.(setError)
      })
    } else {
      // Plain browser dev mode: poll /health directly
      pollUntilReady()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty — these callbacks are stable Zustand actions

  // ── Load all data once backend is confirmed ready ─────────────────────────
  useEffect(() => {
    if (status !== 'ready') return
    const today = new Date()
    const month = today.toISOString().slice(0, 7)
    const from  = new Date(today.getFullYear(), today.getMonth() - 3, 1).toISOString().slice(0, 10)
    const to    = today.toISOString().slice(0, 10)
    loadEvents()
    loadGoals(month)
    loadHabits()
    loadChecks(from, to)
    loadSessions(month)
    loadTheme()
    loadLanguage()
    loadRetention()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]) // only re-run when status changes (connecting → ready)

  // ── Daily date tick ────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const t = new Date().toISOString().slice(0, 10)
      if (t !== todayStr) setTodayStr(t)
    }, 60_000)
    return () => clearInterval(id)
  }, [todayStr, setTodayStr])

  // ── Electron IPC: navigation from tray / pet menu ─────────────────────────
  useEffect(() => {
    if (!window.electron?.onNavigate) return
    window.electron.onNavigate((page: string) => setPageRef.current(page as NavPage))
  }, []) // registered once; uses ref so it always calls the latest setPage

  // ── Electron IPC: event confirmed from chat window ─────────────────────────
  useEffect(() => {
    if (!window.electron?.onEventConfirmed) return
    window.electron.onEventConfirmed((data: any) => {
      addEventRef.current({
        title:       data.title       ?? '',
        date:        data.date        ?? new Date().toISOString().slice(0, 10),
        startTime:   data.startTime   ?? '',
        endTime:     data.endTime     ?? '',
        color:       data.color       ?? '#83B5B5',
        isCountdown: data.isCountdown ?? false,
        description: data.description ?? '',
      })
      setPageRef.current('schedule' as NavPage)
    })
  }, []) // registered once; uses refs so callbacks are always fresh

  // Show loading / error screen until backend is ready
  if (status !== 'ready') {
    return <BackendLoadingScreen status={status} />
  }

  return (
    <>
      <NotificationScheduler />
      <Layout />
    </>
  )
}

function App() {
  return IS_LOGIN_WINDOW ? <LoginApp /> : <MainApp />
}

export default App
