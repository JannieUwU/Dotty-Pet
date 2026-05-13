import { useState, useEffect, useRef, useCallback } from 'react'
import type React from 'react'
import { ModelPanel } from './panels/ModelPanel'
import { PersonalityPanel } from './panels/PersonalityPanel'
import { ReviewTimeline } from './panels/ReviewTimeline'
import { usePetStore } from './usePetStore'
import { useBackendStore } from '../../store/backendStore'
import { apiFetch } from '../../utils/api'

// ── Unity status helpers ───────────────────────────────────────────────────────

type UnityStatus = 'checking' | 'online' | 'offline_has_exe' | 'offline_no_exe'

const UNITY_API = 'http://127.0.0.1:8765'

async function pingUnity(): Promise<{ online: boolean; state?: string; modelName?: string }> {
  try {
    const res = await fetch(`${UNITY_API}/status`, { signal: AbortSignal.timeout(1200) })
    if (!res.ok) return { online: false }
    const data = await res.json()
    return { online: true, state: data.state, modelName: data.modelName }
  } catch {
    return { online: false }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export const DesktopPetPage = () => {
  const [unityStatus, setUnityStatus] = useState<UnityStatus>('checking')
  const [launching, setLaunching]     = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { setModelName, reviews, reviewsLoading, reviewsStatus, reviewsRetentionCutoff, fetchReviews, addReview } = usePetStore()
  const backendStatus = useBackendStore(s => s.status)

  // Fetch reviews + check today's generation status once backend is ready
  useEffect(() => {
    if (backendStatus !== 'ready') return
    fetchReviews()
    // Also ping /reviews/today so the backend auto-triggers generation if needed
    // and we can show the generating skeleton immediately
    apiFetch('/pet/reviews/today')
      .then(r => r.json())
      .then(data => {
        if (data.status === 'generating') {
          usePetStore.setState({ reviewsStatus: 'generating' })
        }
      })
      .catch(() => { /* non-critical */ })
  }, [backendStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for review_ready WebSocket event
  useEffect(() => {
    const wsUrl = 'ws://127.0.0.1:8766/ws'
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      ws = new WebSocket(wsUrl)
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.event === 'review_ready') {
            const payload = msg.data
            // If the WS payload includes the review data, insert it directly
            // to avoid an extra round-trip HTTP fetch
            if (payload?.review) {
              addReview({
                date: payload.review.date,
                rating: payload.review.rating,
                mood: payload.review.mood,
                title: payload.review.title,
                content: payload.review.content,
              })
            } else {
              // Fallback: re-fetch the full list
              fetchReviews()
            }
          }
        } catch {}
      }
      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 3000)
      }
    }

    if (backendStatus === 'ready') connect()

    return () => {
      ws?.close()
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [backendStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Unity status polling ──────────────────────────────────────────────────

  const checkUnity = useCallback(async () => {
    if (window.electron?.checkUnity) {
      // Electron path: use IPC to check if Unity process is alive + has exe.
      // Then do a single direct ping to get the current model name.
      const { online, hasExe } = await window.electron.checkUnity()
      if (online) {
        setUnityStatus('online')
        // Fetch model name from Unity's /status endpoint (single call)
        const { modelName } = await pingUnity()
        if (modelName) setModelName(modelName)
      } else {
        setUnityStatus(hasExe ? 'offline_has_exe' : 'offline_no_exe')
      }
    } else {
      // Browser dev mode: ping Unity directly
      const { online, modelName } = await pingUnity()
      setUnityStatus(online ? 'online' : 'offline_no_exe')
      if (online && modelName) setModelName(modelName)
    }
  }, [setModelName])

  useEffect(() => {
    checkUnity()
    if (pollRef.current) clearInterval(pollRef.current)
    // Poll faster when offline (waiting for Unity to start), slower when online
    const interval = unityStatus === 'online' ? 10_000 : 3_000
    pollRef.current = setInterval(checkUnity, interval)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [unityStatus, checkUnity])

  const handleLaunch = async () => {
    if (launching) return
    setLaunching(true)
    await window.electron?.launchUnity?.()
    setTimeout(() => { setLaunching(false); checkUnity() }, 2500)
  }

  // ── Offline screen ────────────────────────────────────────────────────────

  if (unityStatus === 'checking') {
    return (
      <div style={centerStyle}>
        <span style={{ fontFamily: 'Inter', fontSize: 11, color: 'var(--c-text-faint)' }}>
          Connecting to Dotty...
        </span>
      </div>
    )
  }

  if (unityStatus !== 'online') {
    return (
      <div style={centerStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: 300 }}>
          <span style={{ fontSize: 48 }}>🐾</span>
          <span style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: 700, color: 'var(--c-text-primary)' }}>
            Dotty is not running
          </span>
          <span style={{ fontFamily: 'Inter', fontSize: 10, color: 'var(--c-text-faint)', textAlign: 'center', lineHeight: 1.6 }}>
            {unityStatus === 'offline_has_exe'
              ? 'The desktop pet executable was found but is not running yet.'
              : 'Build DottyPet.exe or launch it manually.'}
          </span>
          {unityStatus === 'offline_has_exe' && (
            <button onClick={handleLaunch} disabled={launching} style={btnPrimary(launching)}>
              {launching ? 'Launching...' : 'Launch Dotty'}
            </button>
          )}
          <button onClick={checkUnity} style={btnSecondary}>Retry</button>
        </div>
      </div>
    )
  }

  // ── Main layout (Unity online) ────────────────────────────────────────────

  return (
    <div style={pageStyle}>

      {/* Header */}
      <div style={headerStyle}>
        <div style={statusDot} />
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text-primary)' }}>Dotty is online</span>
      </div>

      {/* Two-column grid */}
      <div style={gridStyle}>

        {/* Left column: Model + Personality */}
        <div style={leftCol}>
          <ModelPanel />
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <PersonalityPanel fillHeight />
          </div>
        </div>

        {/* Right column: Review timeline (fills height) */}
        <div style={rightCol}>
          <ReviewTimeline reviews={reviews} loading={reviewsLoading} reviewsStatus={reviewsStatus} retentionCutoff={reviewsRetentionCutoff} />
        </div>

      </div>
    </div>
  )
}

// ── styles ────────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  width: '100%', height: '100%',
  display: 'flex', flexDirection: 'column',
  fontFamily: 'Inter', overflow: 'hidden',
  boxSizing: 'border-box',
}
const headerStyle: React.CSSProperties = {
  padding: '10px 14px 6px',
  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
}
const statusDot: React.CSSProperties = {
  width: 6, height: 6, borderRadius: '50%', background: '#83B5B5', flexShrink: 0,
}
const gridStyle: React.CSSProperties = {
  flex: 1,
  display: 'grid',
  gridTemplateColumns: '1fr 1.4fr',
  gap: 10,
  padding: '4px 14px 14px',
  overflow: 'hidden',
}
const leftCol: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 10,
  overflow: 'hidden',
}
const rightCol: React.CSSProperties = {
  display: 'flex', flexDirection: 'column',
  overflow: 'hidden',
}
const centerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  height: '100%', width: '100%',
}
const btnPrimary = (disabled: boolean): React.CSSProperties => ({
  height: 32, padding: '0 20px', borderRadius: 8, border: 'none',
  background: disabled ? 'var(--c-text-disabled)' : 'var(--c-text-primary)', color: 'white',
  fontFamily: 'Inter', fontSize: 10, fontWeight: 600,
  cursor: disabled ? 'default' : 'pointer',
})
const btnSecondary: React.CSSProperties = {
  height: 28, padding: '0 16px', borderRadius: 8,
  border: '0.5px solid var(--c-border)', background: 'var(--c-bg-card)',
  fontFamily: 'Inter', fontSize: 10, color: 'var(--c-text-muted)', cursor: 'pointer',
}
