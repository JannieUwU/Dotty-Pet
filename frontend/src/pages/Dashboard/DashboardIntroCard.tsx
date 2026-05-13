/**
 * DashboardIntroCard — redesigned.
 *
 * Top 40%  : System monitor — left: large sparkline, right: metric directory + action buttons.
 * Bottom 60%: Daily note pad — per-date, auto-save, date navigation.
 *
 * The two sections live in separate card containers with a natural gap between them.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'
import { dashboardCardStyle } from './dashboardStyles'
import { useT } from '../../i18n'
import { apiFetch, API_BASE } from '../../utils/api'

// ── helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
}

function fmtDate(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function offsetDate(base: string, days: number): string {
  const [y, m, d] = base.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return dt.toLocaleDateString('en-CA')
}

// ── Sparkline helpers ─────────────────────────────────────────────────────────

const HISTORY_LEN = 20
// Top padding reserves space for the label overlay so the chart never overlaps it.
// ~52px of label content (label 9px + number 22px + detail 8px + gaps) → use 56px top pad.
const PAD_TOP    = 56
const PAD_SIDES  = 6
const PAD_BOTTOM = 6

function sparkColor(pct: number) {
  if (pct >= 85) return '#E8A0A0'
  if (pct >= 60) return '#F9CE9C'
  return '#83B5B5'
}

/** Build a polyline points string scaled to (w × h) with asymmetric padding. */
function buildPoints(history: number[], w: number, h: number): string {
  if (history.length < 2) return ''
  const padded = history.length < HISTORY_LEN
    ? [...Array(HISTORY_LEN - history.length).fill(history[0]), ...history]
    : history
  const xStep   = (w - PAD_SIDES * 2) / (HISTORY_LEN - 1)
  const chartH  = h - PAD_TOP - PAD_BOTTOM
  return padded.map((v, i) => {
    const x = PAD_SIDES + i * xStep
    const y = PAD_TOP + (1 - v / 100) * chartH
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

function buildFillPoints(history: number[], w: number, h: number): string {
  const line = buildPoints(history, w, h)
  if (!line) return ''
  const pts    = line.split(' ')
  const lastX  = pts[pts.length - 1].split(',')[0]
  const firstX = pts[0].split(',')[0]
  const bottom = (h - PAD_BOTTOM + 2).toFixed(1)
  return `${line} ${lastX},${bottom} ${firstX},${bottom}`
}

// ── Large sparkline (fills the left panel) ────────────────────────────────────

const LargeSparkline = ({
  history, pct, label, detail,
}: { history: number[]; pct: number; label: string; detail: string }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 200, h: 120 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setSize({ w: Math.max(width, 40), h: Math.max(height, 60) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { w, h } = size
  const color   = sparkColor(pct)
  const line    = buildPoints(history, w, h)
  const fill    = buildFillPoints(history, w, h)
  const chartH  = h - PAD_TOP - PAD_BOTTOM

  // Last dot position
  const lastDot = history.length > 0 ? (() => {
    const xStep = (w - PAD_SIDES * 2) / (HISTORY_LEN - 1)
    const x = PAD_SIDES + (HISTORY_LEN - 1) * xStep
    const y = PAD_TOP + (1 - history[history.length - 1] / 100) * chartH
    return { x: x.toFixed(1), y: y.toFixed(1) }
  })() : null

  return (
    <div ref={containerRef} style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
      {/* Label overlay — sits above the chart area */}
      <div style={{ position: 'absolute', top: 0, left: PAD_SIDES, zIndex: 1, pointerEvents: 'none' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--c-text-faint)', letterSpacing: '0.06em' }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
          {pct.toFixed(0)}<span style={{ fontSize: 11, fontWeight: 500, color: `${color}99`, marginLeft: 1 }}>%</span>
        </div>
        <div style={{ fontSize: 8, color: 'var(--c-text-xfaint)', marginTop: 1 }}>{detail}</div>
      </div>

      <svg
        width="100%" height="100%"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ display: 'block' }}
      >
        {/* Horizontal grid lines at 25 / 50 / 75% — only within chart area */}
        {[25, 50, 75].map(v => {
          const y = (PAD_TOP + (1 - v / 100) * chartH).toFixed(1)
          return (
            <line key={v} x1={PAD_SIDES} y1={y} x2={w - PAD_SIDES} y2={y}
              stroke="var(--c-border-light)" strokeWidth={0.8} />
          )
        })}
        {/* Fill */}
        {fill && <polygon points={fill} fill={color} fillOpacity={0.08} />}
        {/* Line */}
        {line && (
          <polyline points={line} fill="none" stroke={color}
            strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {/* End dot */}
        {lastDot && (
          <circle cx={lastDot.x} cy={lastDot.y} r={3}
            fill={color} stroke="var(--c-bg-card)" strokeWidth={1.5} />
        )}
      </svg>
    </div>
  )
}

// ── Metric directory icons ─────────────────────────────────────────────────────

const IconCPU = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none"
    stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <rect x="9" y="9" width="6" height="6" />
    <line x1="9"  y1="1"  x2="9"  y2="4"  />
    <line x1="15" y1="1"  x2="15" y2="4"  />
    <line x1="9"  y1="20" x2="9"  y2="23" />
    <line x1="15" y1="20" x2="15" y2="23" />
    <line x1="20" y1="9"  x2="23" y2="9"  />
    <line x1="20" y1="14" x2="23" y2="14" />
    <line x1="1"  y1="9"  x2="4"  y2="9"  />
    <line x1="1"  y1="14" x2="4"  y2="14" />
  </svg>
)

const IconMEM = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none"
    stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="10" rx="2" />
    <line x1="6"  y1="7"  x2="6"  y2="17" />
    <line x1="10" y1="7"  x2="10" y2="17" />
    <line x1="14" y1="7"  x2="14" y2="17" />
    <line x1="18" y1="7"  x2="18" y2="17" />
    <line x1="6"  y1="4"  x2="6"  y2="7"  />
    <line x1="10" y1="4"  x2="10" y2="7"  />
    <line x1="14" y1="4"  x2="14" y2="7"  />
    <line x1="18" y1="4"  x2="18" y2="7"  />
  </svg>
)

const IconDISK = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none"
    stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5"  rx="9" ry="3" />
    <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
    <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" />
  </svg>
)

// ── System monitor ────────────────────────────────────────────────────────────

interface SysData {
  cpu_percent: number
  memory: { total_gb: number; used_gb: number; percent: number }
  disk:   { total_gb: number; used_gb: number; percent: number }
}

type MetricKey = 'CPU' | 'MEM' | 'DISK'

const SystemMonitor = () => {
  const [data,     setData]     = useState<SysData | null>(null)
  const [error,    setError]    = useState(false)
  const [selected, setSelected] = useState<MetricKey>('CPU')

  const cpuHist  = useRef<number[]>([])
  const memHist  = useRef<number[]>([])
  const diskHist = useRef<number[]>([])
  const [, setTick] = useState(0)
  const t = useT()

  const doFetch = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE}/system/resources`)
      if (!res.ok) throw new Error()
      const json: SysData = await res.json()
      const push = (buf: React.MutableRefObject<number[]>, v: number) => {
        buf.current = [...buf.current, v].slice(-HISTORY_LEN)
      }
      push(cpuHist,  json.cpu_percent)
      push(memHist,  json.memory.percent)
      push(diskHist, json.disk.percent)
      setData(json)
      setTick(t => t + 1)
      setError(false)
    } catch { setError(true) }
  }, [])

  useEffect(() => {
    doFetch()
    const id = setInterval(doFetch, 3000)
    return () => clearInterval(id)
  }, [doFetch])

  const metrics: {
    key: MetricKey; label: string; pct: number; detail: string
    history: number[]; Icon: React.FC<{ color: string }>
  }[] = data ? [
    { key: 'CPU',  label: 'CPU',    pct: data.cpu_percent,    detail: `${data.cpu_percent.toFixed(0)}%`,                                          history: cpuHist.current,  Icon: IconCPU  },
    { key: 'MEM',  label: 'Memory', pct: data.memory.percent, detail: `${data.memory.used_gb.toFixed(1)} / ${data.memory.total_gb.toFixed(0)} GB`, history: memHist.current,  Icon: IconMEM  },
    { key: 'DISK', label: 'Disk',   pct: data.disk.percent,   detail: `${data.disk.used_gb.toFixed(0)} / ${data.disk.total_gb.toFixed(0)} GB`,     history: diskHist.current, Icon: IconDISK },
  ] : []

  const active = metrics.find(m => m.key === selected) ?? metrics[0]

  const openTaskManager = () => window.electron?.openTaskManager?.()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexShrink: 0 }}>
        <span style={sectionTitle}>{t.dashboard.system}</span>
        <span style={{ fontSize: 8, color: 'var(--c-text-xfaint)' }}>
          {error ? t.dashboard.systemOffline : data ? t.dashboard.systemLive : '—'}
        </span>
      </div>

      {/* Body: left chart + right directory */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10 }}>

        {/* Left — large sparkline */}
        <div style={{ flex: 3, minWidth: 0, minHeight: 0, display: 'flex' }}>
          {!data ? (
            <div style={{ flex: 1, ...skeletonLine({ borderRadius: 8 }) }} />
          ) : active ? (
            <LargeSparkline
              history={active.history}
              pct={active.pct}
              label={active.label}
              detail={active.detail}
            />
          ) : null}
        </div>

        {/* Right — metric directory + action buttons */}
        <div style={{
          flex: 1, minWidth: 0,
          display: 'flex', flexDirection: 'column', gap: 2,
          borderLeft: '0.5px solid var(--c-border-light)', paddingLeft: 10,
        }}>
          {/* Metric rows */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}>
            {!data ? (
              [0, 1, 2].map(i => (
                <div key={i} style={skeletonLine({ height: 20, borderRadius: 6 })} />
              ))
            ) : metrics.map(m => {
              const isActive = m.key === selected
              const color    = sparkColor(m.pct)
              return (
                <button
                  key={m.key}
                  onClick={() => setSelected(m.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 7px', borderRadius: 7,
                    border: 'none', cursor: 'pointer',
                    background: isActive ? `${color}14` : 'transparent',
                    transition: 'background 0.15s ease',
                    width: '100%', textAlign: 'left' as const,
                  }}
                >
                  <m.Icon color={isActive ? color : 'var(--c-text-xfaint)'} />
                  <span style={{
                    flex: 1, fontSize: 9, fontWeight: isActive ? 700 : 500,
                    color: isActive ? 'var(--c-text-base)' : 'var(--c-text-faint)',
                    letterSpacing: '0.02em',
                  }}>
                    {m.label}
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 700,
                    color: isActive ? color : 'var(--c-text-xfaint)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {m.pct.toFixed(0)}%
                  </span>
                </button>
              )
            })}
          </div>

          {/* Action buttons — side by side, compact */}
          <div style={{ display: 'flex', flexDirection: 'row', gap: 4, flexShrink: 0, paddingTop: 6, borderTop: '0.5px solid var(--c-border-xlight)' }}>
            <button onClick={openTaskManager} style={actionBtn}>{t.dashboard.taskMgr}</button>
            <button onClick={doFetch}         style={actionBtn}>{t.dashboard.refresh}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Note pad ──────────────────────────────────────────────────────────────────

const NotePad = () => {
  const today                    = todayStr()
  const [date, setDate]          = useState(today)
  const [content, setContent]    = useState('')
  const [savedContent, setSaved] = useState('')
  const [saving, setSaving]      = useState(false)
  const [loading, setLoading]    = useState(false)
  const [noteDates, setNoteDates] = useState<string[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const t = useT()

  const loadNote = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const res  = await apiFetch(`/dashboard/notes/${d}`)
      const json = await res.json()
      setContent(json.content ?? '')
      setSaved(json.content ?? '')
    } catch {
      setContent('')
      setSaved('')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadNoteDates = useCallback(async () => {
    try {
      const res  = await apiFetch(`/dashboard/notes`)
      const json = await res.json()
      setNoteDates((json.notes ?? []).map((n: { date: string }) => n.date))
    } catch { /* non-critical */ }
  }, [])

  useEffect(() => { loadNote(date) }, [date, loadNote])
  useEffect(() => { loadNoteDates() }, [loadNoteDates])

  // Clipboard paste via Electron IPC (Ctrl+V in frameless window)
  useEffect(() => {
    const el = textareaRef.current
    window.electron?.onClipboardPaste?.((text: string) => {
      if (!el) return
      const start = el.selectionStart ?? el.value.length
      const end   = el.selectionEnd   ?? el.value.length
      const next  = el.value.slice(0, start) + text + el.value.slice(end)
      handleChange(next)
      // Restore cursor after the pasted text
      requestAnimationFrame(() => {
        el.selectionStart = start + text.length
        el.selectionEnd   = start + text.length
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const persist = useCallback(async (v: string) => {
    setSaving(true)
    try {
      await apiFetch(`/dashboard/notes/${date}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: v }),
      })
      setSaved(v)
      loadNoteDates()
    } catch { /* retry on next keystroke */ }
    finally { setSaving(false) }
  }, [date, loadNoteDates])

  // Auto-save 800ms after last change (works for typing AND paste)
  const handleChange = (v: string) => {
    setContent(v)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persist(v), 800)
  }

  const isDirty   = content !== savedContent
  const isToday   = date === today
  const canGoNext = date < today

  return (
    <div style={noteWrap}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexShrink: 0 }}>
        <span style={sectionTitle}>{t.dashboard.notes}</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => setDate(d => offsetDate(d, -1))} style={navBtn} aria-label="Previous day">‹</button>

          <button onClick={() => setShowPicker(p => !p)} style={dateLabelBtn} aria-label="Pick date">
            {isToday ? 'Today' : fmtDate(date)}
          </button>

          <button
            onClick={() => canGoNext && setDate(d => offsetDate(d, 1))}
            style={{ ...navBtn, opacity: canGoNext ? 1 : 0.25, cursor: canGoNext ? 'pointer' : 'default' }}
            aria-label="Next day" aria-disabled={!canGoNext}
          >›</button>

          <span style={{ fontSize: 8, color: saving ? '#83B5B5' : isDirty ? '#F9CE9C' : 'var(--c-text-xfaint)', marginLeft: 4, minWidth: 28 }}>
            {saving ? t.dashboard.noteSaving : isDirty ? t.dashboard.noteUnsaved : t.dashboard.noteSaved}
          </span>
        </div>
      </div>

      {/* Date picker dropdown */}
      {showPicker && (
        <div style={pickerDropdown}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--c-text-muted)', marginBottom: 6, letterSpacing: '0.04em' }}>
            {t.dashboard.notesWithContent}
          </div>
          {noteDates.length === 0 ? (
            <div style={{ fontSize: 9, color: 'var(--c-text-xfaint)' }}>{t.dashboard.noSavedNotes}</div>
          ) : noteDates.map(d => (
            <button
              key={d}
              onClick={() => { setDate(d); setShowPicker(false) }}
              style={{
                ...pickerItem,
                background: d === date ? 'var(--c-accent-tint)' : 'transparent',
                color: d === date ? '#83B5B5' : 'var(--c-text-secondary)',
                fontWeight: d === date ? 700 : 400,
              }}
            >
              {d === today ? t.dashboard.todayLabel(fmtDate(d)) : fmtDate(d)}
            </button>
          ))}
        </div>
      )}

      {/* Textarea — copy/paste fully supported via native browser behaviour */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 4 }}>
            {[80, 65, 50].map((w, i) => (
              <div key={i} style={skeletonLine({ width: `${w}%`, height: 8 })} />
            ))}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => handleChange(e.target.value)}
            placeholder={isToday ? t.dashboard.notePlaceholderToday : t.dashboard.notePlaceholderOther}
            style={textarea}
            aria-label={`Note for ${fmtDate(date)}`}
            spellCheck={false}
          />
        )}
      </div>

      <div style={{ flexShrink: 0, textAlign: 'right' as const, fontSize: 8, color: 'var(--c-text-disabled)', marginTop: 4 }}>
        {content.length} / 2000
      </div>
    </div>
  )
}

// ── Root component ────────────────────────────────────────────────────────────

export const DashboardIntroCard = () => (
  <div style={{
    flex: 0.65,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0,
    gap: 8,           // natural gap between the two card containers
  }}>
    {/* System monitor card — 40% */}
    <div style={{
      ...dashboardCardStyle,
      flex: 2,
      minHeight: 0,
      padding: '14px 18px 12px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <SystemMonitor />
    </div>

    {/* Notes card — 60% */}
    <div style={{
      ...dashboardCardStyle,
      flex: 3,
      minHeight: 0,
      padding: '14px 18px 12px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <NotePad />
    </div>
  </div>
)

// ── Styles ────────────────────────────────────────────────────────────────────

const sectionTitle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, color: 'var(--c-text-faint)',
  letterSpacing: '0.06em', textTransform: 'uppercase',
}

const noteWrap: React.CSSProperties = {
  display: 'flex', flexDirection: 'column',
  height: '100%', position: 'relative',
}

const textarea: React.CSSProperties = {
  width: '100%', height: '100%',
  resize: 'none', border: 'none', outline: 'none',
  background: 'transparent',
  fontFamily: 'Inter, sans-serif',
  fontSize: 11, lineHeight: 1.75, color: 'var(--c-text-base)',
  padding: 0,
  boxSizing: 'border-box' as const,
  caretColor: '#83B5B5',
}

const navBtn: React.CSSProperties = {
  width: 20, height: 20,
  border: 'none', background: 'transparent',
  cursor: 'pointer',
  fontSize: 14, color: 'var(--c-text-muted)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 4, padding: 0,
  lineHeight: 1,
}

const dateLabelBtn: React.CSSProperties = {
  border: 'none', background: 'transparent',
  cursor: 'pointer',
  fontSize: 9, fontWeight: 600, color: 'var(--c-text-secondary)',
  padding: '2px 6px',
  borderRadius: 4,
  letterSpacing: '0.01em',
}

const pickerDropdown: React.CSSProperties = {
  position: 'absolute', top: 32, right: 0, zIndex: 10,
  background: 'var(--c-bg-card)',
  border: '0.5px solid var(--c-border)',
  borderRadius: 10,
  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
  padding: '10px 10px 8px',
  minWidth: 180,
  maxHeight: 200,
  overflowY: 'auto' as const,
  display: 'flex', flexDirection: 'column', gap: 2,
}

const pickerItem: React.CSSProperties = {
  border: 'none',
  cursor: 'pointer',
  fontSize: 9,
  padding: '5px 8px',
  borderRadius: 6,
  textAlign: 'left' as const,
  width: '100%',
  background: 'transparent',
  color: 'var(--c-text-secondary)',
}

const actionBtn: React.CSSProperties = {
  flex: 1,
  padding: '4px 0',
  border: 'none',
  borderRadius: 6,
  background: 'var(--c-text-primary)',
  color: 'var(--c-bg-app)',
  fontSize: 8,
  fontWeight: 600,
  letterSpacing: '0.03em',
  cursor: 'pointer',
  textAlign: 'center' as const,
  transition: 'background 0.15s ease',
}

function skeletonLine(extra: React.CSSProperties): React.CSSProperties {
  return {
    height: 8, borderRadius: 4,
    background: 'linear-gradient(90deg, var(--c-bg-muted) 25%, var(--c-bg-hover) 50%, var(--c-bg-muted) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
    ...extra,
  }
}
