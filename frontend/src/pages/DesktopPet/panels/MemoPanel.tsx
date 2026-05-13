import { useEffect } from 'react'
import type React from 'react'
import { usePetStore } from '../usePetStore'
import { useBackendStore } from '../../../store/backendStore'
import { useT } from '../../../i18n'

const FC = '#83B5B5'

export const MemoPanel = () => {
  const { memoStatus, memoContent, memoGeneratedAt, fetchMemo, regenerateMemo } = usePetStore()
  const backendStatus = useBackendStore(s => s.status)
  const t = useT()

  // Fetch memo once backend is ready
  useEffect(() => {
    if (backendStatus === 'ready') fetchMemo()
  }, [backendStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for memo_ready WebSocket event
  useEffect(() => {
    const wsUrl = 'ws://127.0.0.1:8766/ws'
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      ws = new WebSocket(wsUrl)
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.event === 'memo_ready') fetchMemo()
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

  const formattedDate = memoGeneratedAt
    ? new Date(memoGeneratedAt).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : ''

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={panelTitle}>{t.desktopPet.memo.title}</div>
        {memoStatus === 'ready' && (
          <button
            onClick={regenerateMemo}
            style={regenBtn}
            aria-label="Regenerate memo"
          >
            {t.desktopPet.memo.regenerate}
          </button>
        )}
      </div>

      {(memoStatus === 'idle' || memoStatus === 'loading') && (
        <div style={skeletonWrap}>
          <div style={skeletonLine(80)} />
          <div style={skeletonLine(95)} />
          <div style={skeletonLine(65)} />
        </div>
      )}

      {memoStatus === 'generating' && (
        <div style={generatingWrap}>
          <div style={spinner} />
          <span style={{ fontSize: 10, color: 'var(--c-text-faint)' }}>
            {t.desktopPet.memo.generating}
          </span>
        </div>
      )}

      {memoStatus === 'ready' && (
        <>
          <div style={memoText}>{memoContent}</div>
          {formattedDate && (
            <div style={memoMeta}>{formattedDate}</div>
          )}
        </>
      )}

      {memoStatus === 'error' && (
        <div style={errorBox}>
          <span>{t.desktopPet.memo.loadError}</span>
          <button onClick={fetchMemo} style={retryBtn}>{t.common.retry}</button>
        </div>
      )}
    </div>
  )
}

// ── styles ────────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  background: 'var(--c-bg-subtle)', borderRadius: 14, border: '0.5px solid var(--c-border)',
  padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
  minHeight: 140,
}
const panelTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--c-text-primary)',
}
const memoText: React.CSSProperties = {
  fontSize: 11, color: 'var(--c-text-primary)', lineHeight: 1.7,
  background: 'var(--c-bg-card)', borderRadius: 10, padding: '12px 14px',
  border: '0.5px solid var(--c-border-light)',
}
const memoMeta: React.CSSProperties = {
  fontSize: 9, color: 'var(--c-text-faint)', textAlign: 'right' as const,
}
const regenBtn: React.CSSProperties = {
  height: 24, padding: '0 10px', borderRadius: 7,
  border: '0.5px solid var(--c-border)', background: 'var(--c-bg-card)',
  fontFamily: 'Inter', fontSize: 9, color: 'var(--c-text-muted)', cursor: 'pointer',
}
const skeletonWrap: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 8,
  background: 'var(--c-bg-card)', borderRadius: 10, padding: '12px 14px',
  border: '0.5px solid var(--c-border-light)',
}
const skeletonLine = (widthPct: number): React.CSSProperties => ({
  height: 10, borderRadius: 5,
  background: 'linear-gradient(90deg, var(--c-bg-muted) 25%, var(--c-border) 50%, var(--c-bg-muted) 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.4s infinite',
  width: `${widthPct}%`,
})
const generatingWrap: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  background: 'var(--c-bg-card)', borderRadius: 10, padding: '14px',
  border: '0.5px solid var(--c-border-light)',
}
const spinner: React.CSSProperties = {
  width: 16, height: 16, borderRadius: '50%',
  border: '2px solid var(--c-border)',
  borderTopColor: '#83B5B5',
  animation: 'spin 0.8s linear infinite',
  flexShrink: 0,
}
const errorBox: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  background: '#fff0f0', border: '0.5px solid #ffcccc', borderRadius: 8,
  padding: '8px 12px', fontSize: 9, color: '#cc3333',
}
const retryBtn: React.CSSProperties = {
  height: 22, padding: '0 10px', borderRadius: 6,
  border: '0.5px solid #ffaaaa', background: 'var(--c-bg-card)',
  fontFamily: 'Inter', fontSize: 9, color: '#cc3333', cursor: 'pointer',
}
