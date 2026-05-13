import { useState } from 'react'
import { useScheduleStore } from '../../store/scheduleStore'
import { useT } from '../../i18n'

interface FocusSession { task: string; start: string; end: string; mins: number; date: string }

// ── helpers ──────────────────────────────────────────────────────────────────

function lastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date('2026-03-29'); d.setDate(d.getDate() - i); return d.toISOString().slice(0, 10)
  }).reverse()
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

function lerp(a: number, b: number, t: number) { return Math.round(a + (b - a) * t) }

function blendColor(base: string, target: string, t: number) {
  const a = hexToRgb(base), b = hexToRgb(target)
  return `rgb(${lerp(a.r, b.r, t)},${lerp(a.g, b.g, t)},${lerp(a.b, b.b, t)})`
}

// longest streak ending on or before today
function longestStreak(dates: string[]): number {
  const set = new Set(dates)
  let max = 0
  for (const d of dates) {
    let cur = 0, dt = new Date(d)
    while (set.has(dt.toISOString().slice(0, 10))) { cur++; dt.setDate(dt.getDate() - 1) }
    if (cur > max) max = cur
  }
  return max
}

// smooth SVG path through points
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1], cur = pts[i]
    const cpx = (prev.x + cur.x) / 2
    d += ` C ${cpx} ${prev.y} ${cpx} ${cur.y} ${cur.x} ${cur.y}`
  }
  return d
}

// ── sub-components ────────────────────────────────────────────────────────────

const Card = ({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) => (
  <div style={{ flex: 1, background: 'var(--c-bg-card)', borderRadius: 12, padding: '12px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 600, color: 'var(--c-text-faint)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
    <span style={{ fontFamily: 'Inter', fontSize: 24, fontWeight: 700, color }}>{value}</span>
    <span style={{ fontFamily: 'Inter', fontSize: 10, color: 'var(--c-text-faint)' }}>{sub}</span>
  </div>
)

const SectionTitle = ({ children }: { children: string }) => (
  <div style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 700, color: 'var(--c-text-primary)', marginBottom: 6 }}>{children}</div>
)

// ── main ──────────────────────────────────────────────────────────────────────

export const StatisticsView = ({ sessions }: { sessions: FocusSession[] }) => {
  const { habits, checkedHabits, goals, taskCount, taskTotal } = useScheduleStore()
  const [lineHabit, setLineHabit] = useState<string>('all')
  const [hoverCell, setHoverCell] = useState<{ date: string; count: number } | null>(null)
  const t = useT()

  // ── Overview data ──
  const today = '2026-03-29'
  const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - 6)
  const weekDates = new Set(lastNDays(7))
  const weekMins = sessions.filter(s => weekDates.has(s.date)).reduce((a, s) => a + s.mins, 0)
  const allStreaks = habits.flatMap(h => checkedHabits[h.id] ?? [])
  const bestStreak = longestStreak(allStreaks)
  const goalsDone = goals.filter(g => g.completed).length
  const todayDone = habits.filter(h => (checkedHabits[h.id] ?? []).includes(today)).length
  const donutPct = habits.length > 0 ? todayDone / habits.length : 0
  const donutR = 52, donutC = 2 * Math.PI * donutR
  const accentColor = habits[0]?.color ?? '#83B5B5'

  // ── Heatmap data ──
  const days365 = lastNDays(365)
  const habitCount365 = (date: string) => habits.filter(h => (checkedHabits[h.id] ?? []).includes(date)).length
  const maxH = habits.length || 1

  // ── Line chart data ──
  const days30 = lastNDays(30)
  const lineData = days30.map(date => {
    if (lineHabit === 'all') return habits.filter(h => (checkedHabits[h.id] ?? []).includes(date)).length
    return (checkedHabits[lineHabit] ?? []).includes(date) ? 1 : 0
  })
  const lineMax = Math.max(...lineData, 1)
  const LW = 320, LH = 100
  const linePts = days30.map((_, i) => ({ x: (i / (days30.length - 1)) * LW, y: LH - (lineData[i] / lineMax) * (LH - 10) }))
  const linePath = smoothPath(linePts)
  const areaPath = linePath + ` L ${LW} ${LH} L 0 ${LH} Z`

  // ── Bar / Pie data (removed) ──

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', overflowY: 'auto', paddingRight: 2, width: '100%', boxSizing: 'border-box' }}>

      {/* ── Board 1: Overview ── */}
      <div style={{ background: 'var(--c-bg-card)', borderRadius: 14, padding: '14px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
        <SectionTitle>{t.pomodoro.overview}</SectionTitle>
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            <div style={{ display: 'flex', gap: 8 }}>
      <Card label={t.pomodoro.focusTime} value={`${(weekMins / 60).toFixed(1)}h`} sub={t.pomodoro.thisWeek} color="var(--c-text-primary)" />
              <Card label={t.pomodoro.tasksDone} value={`${taskTotal > 0 ? Math.round(taskCount / taskTotal * 100) : 0}%`} sub={`${taskCount} / ${taskTotal}`} color={accentColor} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Card label={t.pomodoro.bestStreak} value={`${bestStreak}d`} sub={t.pomodoro.consecutiveDays} color="var(--c-text-primary)" />
              <Card label={t.pomodoro.goals} value={`${goalsDone}/${goals.length}`} sub={t.pomodoro.completed} color={accentColor} />
            </div>
          </div>
          {/* Donut */}
          <div style={{ width: 144, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <svg width="100%" viewBox="0 0 130 130">
              <circle cx={65} cy={65} r={donutR} fill="none" stroke="var(--c-border-xlight)" strokeWidth={10} />
              <circle cx={65} cy={65} r={donutR} fill="none" stroke={accentColor} strokeWidth={10}
                strokeDasharray={`${donutPct * donutC} ${donutC}`} strokeLinecap="round"
                transform="rotate(-90 65 65)" />
              <text x={65} y={69} textAnchor="middle" fontFamily="Inter" fontSize={17} fontWeight={700} fill="var(--c-text-primary)">
                {Math.round(donutPct * 100)}%
              </text>
            </svg>
            <span style={{ fontFamily: 'Inter', fontSize: 10, color: 'var(--c-text-faint)', textAlign: 'center' }}>{t.pomodoro.todayHabitsLabel}</span>
          </div>
        </div>
      </div>

      {/* ── Board 2: Habit Analytics ── */}
      <div style={{ background: 'var(--c-bg-card)', borderRadius: 14, padding: '14px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
        <SectionTitle>{t.pomodoro.habitAnalytics}</SectionTitle>
        <div style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>

          {/* Heatmap */}
          <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: 'Inter', fontSize: 10, color: 'var(--c-text-faint)', marginBottom: 4 }}>{t.pomodoro.heatmap365}</div>
            <svg viewBox="0 0 182 98" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', width: '100%', height: 'auto', transform: 'scaleY(0.8)', transformOrigin: 'top' }}>
              {days365.map((date, i) => {
                const col = Math.floor(i / 14), row = i % 14
                const cnt = habitCount365(date)
                const t2 = cnt / maxH
                const fill = cnt === 0 ? 'var(--c-border-xlight)' : blendColor('#F0F0F0', accentColor, t2)
                return (
                  <rect key={date} x={col * 7} y={row * 7} width={6} height={6} rx={1} fill={fill}
                    onMouseEnter={() => setHoverCell({ date, count: cnt })}
                    onMouseLeave={() => setHoverCell(null)}
                    style={{ cursor: 'default' }} />
                )
              })}
            </svg>
            {hoverCell && (
              <div style={{ position: 'absolute', top: 0, right: 0, background: 'var(--c-text-primary)', color: 'white', borderRadius: 6, padding: '3px 7px', fontFamily: 'Inter', fontSize: 10, pointerEvents: 'none' }}>
                {t.pomodoro.heatmapTooltip(hoverCell.date, hoverCell.count, t.pomodoro.habits(hoverCell.count))}
              </div>
            )}
          </div>

          {/* Line chart */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontFamily: 'Inter', fontSize: 10, color: 'var(--c-text-faint)' }}>{t.pomodoro.completion30}</span>
              <select value={lineHabit} onChange={e => setLineHabit(e.target.value)}
                style={{ fontFamily: 'Inter', fontSize: 10, border: '0.5px solid var(--c-border)', borderRadius: 4, padding: '1px 4px', outline: 'none', color: 'var(--c-text-primary)', background: 'var(--c-bg-card)' }}>
                <option value="all">{t.pomodoro.allHabits}</option>
                {habits.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <svg width="100%" viewBox={`0 0 ${LW} ${LH + 16}`} style={{ display: 'block' }}>
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accentColor} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <path d={areaPath} fill="url(#lineGrad)" />
              <path d={linePath} fill="none" stroke={accentColor} strokeWidth={1.5} strokeLinecap="round" />
              {[0, 6, 12, 18, 24, 29].map(i => (
                <text key={i} x={(i / (days30.length - 1)) * LW} y={LH + 12} textAnchor="middle" fontFamily="Inter" fontSize={7} fill="var(--c-text-xfaint)">
                  {days30[i].slice(5)}
                </text>
              ))}
            </svg>
          </div>
        </div>
      </div>

      {/* ── Board 3: Hall of Honor ── */}
      <HallOfHonor sessions={sessions} />

    </div>
  )
}

// ── Hall of Honor ─────────────────────────────────────────────────────────────

interface Badge {
  id: string
  emoji: string
  name: string
  desc: string
  category: 'focus' | 'habit' | 'schedule'
  unlockHint: (progress: number, target: number) => string
  color: string
}

const CATEGORY_COLOR = { focus: '#83B5B5', habit: '#C1D09D', schedule: '#F9CE9C' }
const FC = CATEGORY_COLOR.focus, HC = CATEGORY_COLOR.habit, SC = CATEGORY_COLOR.schedule

const BADGES: Badge[] = [
  // ── Focus (20) ──────────────────────────────────────────────────────────────
  { id: 'f01', emoji: '🍅', name: 'First Tomato',    category: 'focus', color: FC, desc: 'Complete your first focus session',           unlockHint: (p)    => `${p}/1 session` },
  { id: 'f02', emoji: '⏰', name: 'Early Bird',      category: 'focus', color: FC, desc: 'Complete 5 focus sessions',                   unlockHint: (p)    => `${p}/5 sessions` },
  { id: 'f03', emoji: '🔥', name: 'On Fire',         category: 'focus', color: FC, desc: 'Focus 3 consecutive days',                    unlockHint: (p)    => `${p}/3 days` },
  { id: 'f04', emoji: '⚡', name: 'Spark',           category: 'focus', color: FC, desc: 'Accumulate 1 hour of total focus',            unlockHint: (p)    => `${(p/60).toFixed(1)}/1h` },
  { id: 'f05', emoji: '🏃', name: 'Sprinter',        category: 'focus', color: FC, desc: 'Complete a single session ≥ 30 min',          unlockHint: (p)    => `best ${p}/30 min` },
  { id: 'f06', emoji: '🌊', name: 'Flow State',      category: 'focus', color: FC, desc: 'Complete a single session ≥ 50 min',          unlockHint: (p)    => `best ${p}/50 min` },
  { id: 'f07', emoji: '📚', name: 'Scholar',         category: 'focus', color: FC, desc: 'Complete 20 focus sessions',                  unlockHint: (p)    => `${p}/20 sessions` },
  { id: 'f08', emoji: '🌙', name: 'Night Owl',       category: 'focus', color: FC, desc: 'Accumulate 5 hours of total focus',           unlockHint: (p)    => `${(p/60).toFixed(1)}/5h` },
  { id: 'f09', emoji: '🎯', name: 'Sharpshooter',    category: 'focus', color: FC, desc: 'Focus 7 consecutive days',                    unlockHint: (p)    => `${p}/7 days` },
  { id: 'f10', emoji: '🧠', name: 'Deep Thinker',    category: 'focus', color: FC, desc: 'Accumulate 10 hours of total focus',          unlockHint: (p)    => `${(p/60).toFixed(1)}/10h` },
  { id: 'f11', emoji: '💎', name: 'Diamond Mind',    category: 'focus', color: FC, desc: 'Complete 50 focus sessions',                  unlockHint: (p)    => `${p}/50 sessions` },
  { id: 'f12', emoji: '🚀', name: 'Rocket',          category: 'focus', color: FC, desc: 'Focus 14 consecutive days',                   unlockHint: (p)    => `${p}/14 days` },
  { id: 'f13', emoji: '⏱️', name: 'Time Lord',       category: 'focus', color: FC, desc: 'Accumulate 25 hours of total focus',          unlockHint: (p)    => `${(p/60).toFixed(1)}/25h` },
  { id: 'f14', emoji: '🌟', name: 'Superstar',       category: 'focus', color: FC, desc: 'Complete 100 focus sessions',                 unlockHint: (p)    => `${p}/100 sessions` },
  { id: 'f15', emoji: '🏔️', name: 'Summit',          category: 'focus', color: FC, desc: 'Focus 30 consecutive days',                   unlockHint: (p)    => `${p}/30 days` },
  { id: 'f16', emoji: '🔬', name: 'Researcher',      category: 'focus', color: FC, desc: 'Accumulate 50 hours of total focus',          unlockHint: (p)    => `${(p/60).toFixed(1)}/50h` },
  { id: 'f17', emoji: '🎓', name: 'Graduate',        category: 'focus', color: FC, desc: 'Complete 200 focus sessions',                 unlockHint: (p)    => `${p}/200 sessions` },
  { id: 'f18', emoji: '🌌', name: 'Cosmos',          category: 'focus', color: FC, desc: 'Accumulate 100 hours of total focus',         unlockHint: (p)    => `${(p/60).toFixed(1)}/100h` },
  { id: 'f19', emoji: '🏆', name: 'Champion',        category: 'focus', color: FC, desc: 'Focus 60 consecutive days',                   unlockHint: (p)    => `${p}/60 days` },
  { id: 'f20', emoji: '👑', name: 'Focus Legend',    category: 'focus', color: FC, desc: 'Complete 500 focus sessions',                 unlockHint: (p)    => `${p}/500 sessions` },

  // ── Habit (20) ──────────────────────────────────────────────────────────────
  { id: 'h01', emoji: '🌱', name: 'Habit Born',      category: 'habit', color: HC, desc: 'Create your first habit',                    unlockHint: (p)    => `${p}/1 habit` },
  { id: 'h02', emoji: '✅', name: 'First Check',     category: 'habit', color: HC, desc: 'Check in a habit for the first time',        unlockHint: (p)    => `${p}/1 check-in` },
  { id: 'h03', emoji: '🌿', name: 'Seedling',        category: 'habit', color: HC, desc: 'Check in any habit 7 times total',           unlockHint: (p, t) => `${p}/${t} check-ins` },
  { id: 'h04', emoji: '🌻', name: 'Blooming',        category: 'habit', color: HC, desc: 'Check in any habit 3 days in a row',         unlockHint: (p)    => `${p}/3 day streak` },
  { id: 'h05', emoji: '⭐', name: 'Perfect Day',     category: 'habit', color: HC, desc: 'Complete all habits in a single day',        unlockHint: (p, t) => `${p}/${t} today` },
  { id: 'h06', emoji: '🌈', name: 'Variety',         category: 'habit', color: HC, desc: 'Create 3 different habits',                  unlockHint: (p)    => `${p}/3 habits` },
  { id: 'h07', emoji: '💧', name: 'Consistent',      category: 'habit', color: HC, desc: 'Check in any habit 20 times total',          unlockHint: (p, t) => `${p}/${t} check-ins` },
  { id: 'h08', emoji: '🔗', name: 'Chain Builder',   category: 'habit', color: HC, desc: 'Check in any habit 7 days in a row',         unlockHint: (p)    => `${p}/7 day streak` },
  { id: 'h09', emoji: '💪', name: 'Iron Will',       category: 'habit', color: HC, desc: 'Check in any habit 30 times total',          unlockHint: (p, t) => `${p}/${t} check-ins` },
  { id: 'h10', emoji: '🌳', name: 'Deep Roots',      category: 'habit', color: HC, desc: 'Create 5 different habits',                  unlockHint: (p)    => `${p}/5 habits` },
  { id: 'h11', emoji: '🎖️', name: 'Dedicated',       category: 'habit', color: HC, desc: 'Check in any habit 14 days in a row',        unlockHint: (p)    => `${p}/14 day streak` },
  { id: 'h12', emoji: '🔥', name: 'Unstoppable',     category: 'habit', color: HC, desc: 'Check in any habit 50 times total',          unlockHint: (p, t) => `${p}/${t} check-ins` },
  { id: 'h13', emoji: '🌍', name: 'Habit World',     category: 'habit', color: HC, desc: 'Accumulate 100 total check-ins across all habits', unlockHint: (p, t) => `${p}/${t} total` },
  { id: 'h14', emoji: '🏅', name: 'Month Master',    category: 'habit', color: HC, desc: 'Check in any habit 30 days in a row',        unlockHint: (p)    => `${p}/30 day streak` },
  { id: 'h15', emoji: '🦁', name: 'Lion Heart',      category: 'habit', color: HC, desc: 'Check in any habit 100 times total',         unlockHint: (p, t) => `${p}/${t} check-ins` },
  { id: 'h16', emoji: '🌠', name: 'Star Habit',      category: 'habit', color: HC, desc: 'Have 3 habits each checked in 10+ times',    unlockHint: (p)    => `${p}/3 habits ≥10` },
  { id: 'h17', emoji: '⚔️', name: 'Warrior',         category: 'habit', color: HC, desc: 'Check in any habit 60 days in a row',        unlockHint: (p)    => `${p}/60 day streak` },
  { id: 'h18', emoji: '🎯', name: 'Precision',       category: 'habit', color: HC, desc: 'Accumulate 300 total check-ins',             unlockHint: (p, t) => `${p}/${t} total` },
  { id: 'h19', emoji: '🌺', name: 'Full Bloom',      category: 'habit', color: HC, desc: 'Check in any habit 100 days in a row',       unlockHint: (p)    => `${p}/100 day streak` },
  { id: 'h20', emoji: '🏆', name: 'Habit Legend',    category: 'habit', color: HC, desc: 'Accumulate 500 total check-ins',             unlockHint: (p, t) => `${p}/${t} total` },

  // ── Schedule (20) ───────────────────────────────────────────────────────────
  { id: 's01', emoji: '📅', name: 'Planner',         category: 'schedule', color: SC, desc: 'Create your first agenda event',          unlockHint: (p)    => `${p}/1 event` },
  { id: 's02', emoji: '🎯', name: 'Goal Setter',     category: 'schedule', color: SC, desc: 'Set your first monthly goal',             unlockHint: (p)    => `${p}/1 goal` },
  { id: 's03', emoji: '✨', name: 'Achiever',        category: 'schedule', color: SC, desc: 'Complete your first monthly goal',        unlockHint: (p)    => `${p}/1 completed` },
  { id: 's04', emoji: '📋', name: 'Organizer',       category: 'schedule', color: SC, desc: 'Create 5 agenda events',                  unlockHint: (p)    => `${p}/5 events` },
  { id: 's05', emoji: '⏰', name: 'On Schedule',     category: 'schedule', color: SC, desc: 'Create 10 agenda events',                 unlockHint: (p)    => `${p}/10 events` },
  { id: 's06', emoji: '🗓️', name: 'Week Planner',    category: 'schedule', color: SC, desc: 'Set 3 monthly goals',                     unlockHint: (p)    => `${p}/3 goals` },
  { id: 's07', emoji: '🌅', name: 'New Month',       category: 'schedule', color: SC, desc: 'Complete 3 monthly goals',                unlockHint: (p)    => `${p}/3 completed` },
  { id: 's08', emoji: '📌', name: 'Pinned',          category: 'schedule', color: SC, desc: 'Create 20 agenda events',                 unlockHint: (p)    => `${p}/20 events` },
  { id: 's09', emoji: '🔔', name: 'Reminder Pro',    category: 'schedule', color: SC, desc: 'Create a countdown event',               unlockHint: (p)    => `${p}/1 countdown` },
  { id: 's10', emoji: '📊', name: 'Strategist',      category: 'schedule', color: SC, desc: 'Set 5 monthly goals',                     unlockHint: (p)    => `${p}/5 goals` },
  { id: 's11', emoji: '🎪', name: 'Event Master',    category: 'schedule', color: SC, desc: 'Create 50 agenda events',                 unlockHint: (p)    => `${p}/50 events` },
  { id: 's12', emoji: '🏅', name: 'Goal Crusher',    category: 'schedule', color: SC, desc: 'Complete 5 monthly goals',                unlockHint: (p)    => `${p}/5 completed` },
  { id: 's13', emoji: '🗺️', name: 'Roadmap',         category: 'schedule', color: SC, desc: 'Set 10 monthly goals',                    unlockHint: (p)    => `${p}/10 goals` },
  { id: 's14', emoji: '💼', name: 'Executive',       category: 'schedule', color: SC, desc: 'Create 100 agenda events',                unlockHint: (p)    => `${p}/100 events` },
  { id: 's15', emoji: '🌟', name: 'Visionary',       category: 'schedule', color: SC, desc: 'Complete 10 monthly goals',               unlockHint: (p)    => `${p}/10 completed` },
  { id: 's16', emoji: '🎨', name: 'Life Designer',   category: 'schedule', color: SC, desc: 'Set 20 monthly goals',                    unlockHint: (p)    => `${p}/20 goals` },
  { id: 's17', emoji: '🚀', name: 'Launcher',        category: 'schedule', color: SC, desc: 'Create 200 agenda events',                unlockHint: (p)    => `${p}/200 events` },
  { id: 's18', emoji: '🏆', name: 'Overachiever',    category: 'schedule', color: SC, desc: 'Complete 20 monthly goals',               unlockHint: (p)    => `${p}/20 completed` },
  { id: 's19', emoji: '🌍', name: 'World Builder',   category: 'schedule', color: SC, desc: 'Set 50 monthly goals',                    unlockHint: (p)    => `${p}/50 goals` },
  { id: 's20', emoji: '👑', name: 'Schedule Legend', category: 'schedule', color: SC, desc: 'Complete 50 monthly goals',               unlockHint: (p)    => `${p}/50 completed` },
]

function focusConsecutiveDays(sessions: FocusSession[]): number {
  const dates = [...new Set(sessions.map(s => s.date))].sort()
  let max = 0, cur = 0
  for (let i = 0; i < dates.length; i++) {
    if (i === 0) { cur = 1; continue }
    const prev = new Date(dates[i - 1]); prev.setDate(prev.getDate() + 1)
    cur = prev.toISOString().slice(0, 10) === dates[i] ? cur + 1 : 1
    if (cur > max) max = cur
  }
  return Math.max(max, dates.length > 0 ? 1 : 0)
}

const HallOfHonor = ({ sessions }: { sessions: FocusSession[] }) => {
  const { habits, checkedHabits, goals, events } = useScheduleStore()
  const [hovered, setHovered] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'focus' | 'habit' | 'schedule'>('focus')
  const t = useT()

  const today = new Date().toISOString().slice(0, 10)

  // ── Focus stats ──
  const totalMins       = sessions.reduce((a, s) => a + s.mins, 0)
  const totalSessions   = sessions.length
  const maxSingleMins   = sessions.reduce((a, s) => Math.max(a, s.mins), 0)
  const focusDayStreak  = focusConsecutiveDays(sessions)

  // ── Habit stats ──
  const totalCheckins   = habits.reduce((a, h) => a + (checkedHabits[h.id] ?? []).length, 0)
  const maxCheckins     = habits.length > 0 ? Math.max(...habits.map(h => (checkedHabits[h.id] ?? []).length)) : 0
  const todayDone       = habits.filter(h => (checkedHabits[h.id] ?? []).includes(today)).length
  const habitStreak     = longestStreak(habits.flatMap(h => checkedHabits[h.id] ?? []))
  const habitsOver10    = habits.filter(h => (checkedHabits[h.id] ?? []).length >= 10).length

  // ── Schedule stats ──
  const totalEvents     = events.length
  const totalGoals      = goals.length
  const completedGoals  = goals.filter(g => g.completed).length
  const hasCountdown    = events.some(e => e.isCountdown)

  function evaluate(id: string): { unlocked: boolean; progress: number; target: number } {
    switch (id) {
      // Focus
      case 'f01': return { unlocked: totalSessions >= 1,    progress: Math.min(totalSessions, 1),     target: 1 }
      case 'f02': return { unlocked: totalSessions >= 5,    progress: Math.min(totalSessions, 5),     target: 5 }
      case 'f03': return { unlocked: focusDayStreak >= 3,   progress: Math.min(focusDayStreak, 3),    target: 3 }
      case 'f04': return { unlocked: totalMins >= 60,       progress: Math.min(totalMins, 60),        target: 60 }
      case 'f05': return { unlocked: maxSingleMins >= 30,   progress: Math.min(maxSingleMins, 30),    target: 30 }
      case 'f06': return { unlocked: maxSingleMins >= 50,   progress: Math.min(maxSingleMins, 50),    target: 50 }
      case 'f07': return { unlocked: totalSessions >= 20,   progress: Math.min(totalSessions, 20),    target: 20 }
      case 'f08': return { unlocked: totalMins >= 300,      progress: Math.min(totalMins, 300),       target: 300 }
      case 'f09': return { unlocked: focusDayStreak >= 7,   progress: Math.min(focusDayStreak, 7),    target: 7 }
      case 'f10': return { unlocked: totalMins >= 600,      progress: Math.min(totalMins, 600),       target: 600 }
      case 'f11': return { unlocked: totalSessions >= 50,   progress: Math.min(totalSessions, 50),    target: 50 }
      case 'f12': return { unlocked: focusDayStreak >= 14,  progress: Math.min(focusDayStreak, 14),   target: 14 }
      case 'f13': return { unlocked: totalMins >= 1500,     progress: Math.min(totalMins, 1500),      target: 1500 }
      case 'f14': return { unlocked: totalSessions >= 100,  progress: Math.min(totalSessions, 100),   target: 100 }
      case 'f15': return { unlocked: focusDayStreak >= 30,  progress: Math.min(focusDayStreak, 30),   target: 30 }
      case 'f16': return { unlocked: totalMins >= 3000,     progress: Math.min(totalMins, 3000),      target: 3000 }
      case 'f17': return { unlocked: totalSessions >= 200,  progress: Math.min(totalSessions, 200),   target: 200 }
      case 'f18': return { unlocked: totalMins >= 6000,     progress: Math.min(totalMins, 6000),      target: 6000 }
      case 'f19': return { unlocked: focusDayStreak >= 60,  progress: Math.min(focusDayStreak, 60),   target: 60 }
      case 'f20': return { unlocked: totalSessions >= 500,  progress: Math.min(totalSessions, 500),   target: 500 }
      // Habit
      case 'h01': return { unlocked: habits.length >= 1,    progress: Math.min(habits.length, 1),     target: 1 }
      case 'h02': return { unlocked: totalCheckins >= 1,    progress: Math.min(totalCheckins, 1),     target: 1 }
      case 'h03': return { unlocked: maxCheckins >= 7,      progress: Math.min(maxCheckins, 7),       target: 7 }
      case 'h04': return { unlocked: habitStreak >= 3,      progress: Math.min(habitStreak, 3),       target: 3 }
      case 'h05': return { unlocked: habits.length > 0 && todayDone === habits.length, progress: todayDone, target: habits.length || 1 }
      case 'h06': return { unlocked: habits.length >= 3,    progress: Math.min(habits.length, 3),     target: 3 }
      case 'h07': return { unlocked: maxCheckins >= 20,     progress: Math.min(maxCheckins, 20),      target: 20 }
      case 'h08': return { unlocked: habitStreak >= 7,      progress: Math.min(habitStreak, 7),       target: 7 }
      case 'h09': return { unlocked: maxCheckins >= 30,     progress: Math.min(maxCheckins, 30),      target: 30 }
      case 'h10': return { unlocked: habits.length >= 5,    progress: Math.min(habits.length, 5),     target: 5 }
      case 'h11': return { unlocked: habitStreak >= 14,     progress: Math.min(habitStreak, 14),      target: 14 }
      case 'h12': return { unlocked: maxCheckins >= 50,     progress: Math.min(maxCheckins, 50),      target: 50 }
      case 'h13': return { unlocked: totalCheckins >= 100,  progress: Math.min(totalCheckins, 100),   target: 100 }
      case 'h14': return { unlocked: habitStreak >= 30,     progress: Math.min(habitStreak, 30),      target: 30 }
      case 'h15': return { unlocked: maxCheckins >= 100,    progress: Math.min(maxCheckins, 100),     target: 100 }
      case 'h16': return { unlocked: habitsOver10 >= 3,     progress: Math.min(habitsOver10, 3),      target: 3 }
      case 'h17': return { unlocked: habitStreak >= 60,     progress: Math.min(habitStreak, 60),      target: 60 }
      case 'h18': return { unlocked: totalCheckins >= 300,  progress: Math.min(totalCheckins, 300),   target: 300 }
      case 'h19': return { unlocked: habitStreak >= 100,    progress: Math.min(habitStreak, 100),     target: 100 }
      case 'h20': return { unlocked: totalCheckins >= 500,  progress: Math.min(totalCheckins, 500),   target: 500 }
      // Schedule
      case 's01': return { unlocked: totalEvents >= 1,      progress: Math.min(totalEvents, 1),       target: 1 }
      case 's02': return { unlocked: totalGoals >= 1,       progress: Math.min(totalGoals, 1),        target: 1 }
      case 's03': return { unlocked: completedGoals >= 1,   progress: Math.min(completedGoals, 1),    target: 1 }
      case 's04': return { unlocked: totalEvents >= 5,      progress: Math.min(totalEvents, 5),       target: 5 }
      case 's05': return { unlocked: totalEvents >= 10,     progress: Math.min(totalEvents, 10),      target: 10 }
      case 's06': return { unlocked: totalGoals >= 3,       progress: Math.min(totalGoals, 3),        target: 3 }
      case 's07': return { unlocked: completedGoals >= 3,   progress: Math.min(completedGoals, 3),    target: 3 }
      case 's08': return { unlocked: totalEvents >= 20,     progress: Math.min(totalEvents, 20),      target: 20 }
      case 's09': return { unlocked: hasCountdown,          progress: hasCountdown ? 1 : 0,           target: 1 }
      case 's10': return { unlocked: totalGoals >= 5,       progress: Math.min(totalGoals, 5),        target: 5 }
      case 's11': return { unlocked: totalEvents >= 50,     progress: Math.min(totalEvents, 50),      target: 50 }
      case 's12': return { unlocked: completedGoals >= 5,   progress: Math.min(completedGoals, 5),    target: 5 }
      case 's13': return { unlocked: totalGoals >= 10,      progress: Math.min(totalGoals, 10),       target: 10 }
      case 's14': return { unlocked: totalEvents >= 100,    progress: Math.min(totalEvents, 100),     target: 100 }
      case 's15': return { unlocked: completedGoals >= 10,  progress: Math.min(completedGoals, 10),   target: 10 }
      case 's16': return { unlocked: totalGoals >= 20,      progress: Math.min(totalGoals, 20),       target: 20 }
      case 's17': return { unlocked: totalEvents >= 200,    progress: Math.min(totalEvents, 200),     target: 200 }
      case 's18': return { unlocked: completedGoals >= 20,  progress: Math.min(completedGoals, 20),   target: 20 }
      case 's19': return { unlocked: totalGoals >= 50,      progress: Math.min(totalGoals, 50),       target: 50 }
      case 's20': return { unlocked: completedGoals >= 50,  progress: Math.min(completedGoals, 50),   target: 50 }
      default:    return { unlocked: false, progress: 0, target: 1 }
    }
  }

  const tabBadges = BADGES.filter(b => b.category === activeTab)
  const unlockedInTab = tabBadges.filter(b => evaluate(b.id).unlocked).length
  const totalUnlocked = BADGES.filter(b => evaluate(b.id).unlocked).length

  const TAB_LABELS = { focus: t.pomodoro.tabFocus, habit: t.pomodoro.tabHabit, schedule: t.pomodoro.tabSchedule }
  const TAB_COLORS = { focus: FC, habit: HC, schedule: SC }

  return (
    <div style={{ background: 'var(--c-bg-card)', borderRadius: 14, padding: '14px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <SectionTitle>{t.pomodoro.hallOfHonor}</SectionTitle>
        <span style={{ fontFamily: 'Inter', fontSize: 10, color: 'var(--c-text-faint)' }}>{totalUnlocked} / {BADGES.length} {t.pomodoro.unlocked}</span>
      </div>

      {/* Overall progress bar */}
      <div style={{ height: 4, background: 'var(--c-border-xlight)', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #83B5B5, #C1D09D, #F9CE9C)', width: `${(totalUnlocked / BADGES.length) * 100}%`, transition: 'width 0.4s ease' }} />
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {(['focus', 'habit', 'schedule'] as const).map(tab => {
          const badges = BADGES.filter(b => b.category === tab)
          const unlocked = badges.filter(b => evaluate(b.id).unlocked).length
          const active = activeTab === tab
          return (
            <div key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              background: active ? TAB_COLORS[tab] + '18' : 'var(--c-bg-subtle)',
              border: `1.5px solid ${active ? TAB_COLORS[tab] : 'var(--c-border)'}`,
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              <span style={{ fontFamily: 'Inter', fontSize: 9, fontWeight: active ? 700 : 500, color: active ? TAB_COLORS[tab] : 'var(--c-text-faint)' }}>
                {TAB_LABELS[tab]}
              </span>
              <span style={{ fontFamily: 'Inter', fontSize: 8, color: active ? TAB_COLORS[tab] : 'var(--c-text-xfaint)' }}>
                {unlocked}/20
              </span>
            </div>
          )
        })}
      </div>

      {/* Tab progress bar */}
      <div style={{ height: 3, background: 'var(--c-border-xlight)', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 2, background: TAB_COLORS[activeTab], width: `${(unlockedInTab / 20) * 100}%`, transition: 'width 0.4s ease' }} />
      </div>

      {/* Badge grid — 5 cols × 4 rows = 20 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 7 }}>
        {tabBadges.map(badge => {
          const { unlocked, progress, target } = evaluate(badge.id)
          const isHovered = hovered === badge.id
          return (
            <div
              key={badge.id}
              onMouseEnter={() => setHovered(badge.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                position: 'relative',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 4, padding: '10px 6px 8px',
                borderRadius: 10,
                border: `1.5px solid ${unlocked ? badge.color : 'var(--c-border)'}`,
                background: unlocked ? `${badge.color}12` : 'var(--c-bg-subtle)',
                cursor: 'default',
                transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                boxShadow: isHovered ? `0 4px 12px ${unlocked ? badge.color + '40' : 'rgba(0,0,0,0.08)'}` : 'none',
                transition: 'transform 0.18s ease, box-shadow 0.18s ease',
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1, filter: unlocked ? 'none' : 'grayscale(1) opacity(0.3)' }}>
                {badge.emoji}
              </span>
              <span style={{ fontFamily: 'Inter', fontSize: 8, fontWeight: 700, color: unlocked ? 'var(--c-text-primary)' : 'var(--c-text-xfaint)', textAlign: 'center', lineHeight: 1.2 }}>
                {t.pomodoro.badgeNames[badge.id] ?? badge.name}
              </span>
              {unlocked
                ? <span style={{ fontFamily: 'Inter', fontSize: 7, fontWeight: 600, color: badge.color }}>{t.pomodoro.checkUnlocked}</span>
                : (
                  <div style={{ width: '100%', height: 3, background: 'var(--c-border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2, background: badge.color + '99', width: `${(progress / target) * 100}%`, transition: 'width 0.3s ease' }} />
                  </div>
                )
              }
              {isHovered && (
                <div style={{
                  position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--c-bg-card)', color: 'var(--c-text-primary)', borderRadius: 7, padding: '5px 8px',
                  fontFamily: 'Inter', fontSize: 8, whiteSpace: 'nowrap', zIndex: 10,
                  pointerEvents: 'none', lineHeight: 1.6,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                  border: '0.5px solid var(--c-border)',
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 1 }}>{t.pomodoro.badgeDescs[badge.id] ?? badge.desc}</div>
                  <div style={{ color: unlocked ? badge.color : 'var(--c-text-faint)' }}>
                    {unlocked ? t.pomodoro.checkCompleted : badge.unlockHint(progress, target)}
                  </div>
                  <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '4px solid var(--c-border)' }} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
