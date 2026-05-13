import { usePomodoroStore } from '../../store/pomodoroStore'
import { useScheduleStore } from '../../store/scheduleStore'
import { useT } from '../../i18n'
import type React from 'react'

const toDateTime = (date: string, time: string) => new Date(`${date}T${time}:00`)

// ── Shared card shell ─────────────────────────────────────────────────────────

const Card = ({ accent, tint, children }: { accent: string; tint: string; children: React.ReactNode }) => (
  <div style={{
    flex: 1, minWidth: 0,
    background: tint,
    borderRadius: 12,
    border: '0.5px solid var(--c-border)',
    borderLeft: `2.5px solid ${accent}`,
    padding: '11px 13px',
    boxSizing: 'border-box' as const,
    display: 'flex', flexDirection: 'column',
    position: 'relative', overflow: 'hidden',
  }}>
    {children}
  </div>
)

const Label = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.45px', color: 'var(--c-text-faint)', marginBottom: 4 }}>
    {children}
  </div>
)

// ── TASKS ─────────────────────────────────────────────────────────────────────

const TasksCard = ({ done, total, accent, tint }: { done: number; total: number; accent: string; tint: string }) => {
  const t = useT()
  return (
  <Card accent={accent} tint={tint}>
    <Label>{t.dashboard.tasks}</Label>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 6 }}>
      <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--c-text-base)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {done}
      </span>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--c-text-xfaint)', lineHeight: 1 }}>/{total}</span>
    </div>
    <div style={{ fontSize: 8, color: 'var(--c-text-xfaint)' }}>
      {total === 0 ? t.dashboard.noTasksToday : done === total ? t.dashboard.allDone : t.dashboard.remaining(total - done)}
    </div>
  </Card>
  )
}

// ── HABITS ────────────────────────────────────────────────────────────────────

const HabitsCard = ({ done, total, accent, tint }: { done: number; total: number; accent: string; tint: string }) => {
  const t = useT()
  return (
  <Card accent={accent} tint={tint}>
    <Label>{t.dashboard.habits}</Label>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 6 }}>
      <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--c-text-base)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {done}
      </span>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--c-text-xfaint)', lineHeight: 1 }}>/{total}</span>
    </div>
    <div style={{ fontSize: 8, color: 'var(--c-text-xfaint)' }}>
      {total === 0 ? t.dashboard.noHabitsToday : done === total ? t.dashboard.streakIntact : t.dashboard.leftToday(total - done)}
    </div>
  </Card>
  )
}

// ── NEXT DDL ──────────────────────────────────────────────────────────────────

const DdlCard = ({ daysLeft, label, time, accent, tint }: {
  daysLeft: number | null; label: string; time: string; accent: string; tint: string
}) => {
  const t = useT()
  const isToday  = daysLeft === 0
  const isClear  = daysLeft === null
  const isUrgent = daysLeft !== null && daysLeft <= 3 && !isToday
  const dotColor = isToday ? accent : isUrgent ? '#E8A0A0' : accent

  return (
    <Card accent={accent} tint={tint}>
      <Label>{t.dashboard.nextDdl}</Label>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 6 }}>
        {isClear ? (
          <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-text-xfaint)', lineHeight: 1 }}>—</span>
        ) : isToday ? (
          <span style={{ fontSize: 20, fontWeight: 800, color: accent, lineHeight: 1 }}>{t.dashboard.today}</span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: isUrgent ? '#E8A0A0' : 'var(--c-text-base)' }}>
              {daysLeft}
            </span>
            <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--c-text-xfaint)', lineHeight: 1 }}>{t.dashboard.days}</span>
          </div>
        )}
        {!isClear && (
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: dotColor, boxShadow: `0 0 0 3px ${dotColor}28`,
            marginBottom: 3, flexShrink: 0,
          }} />
        )}
      </div>
      <div style={{ fontSize: 8, color: 'var(--c-text-xfaint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {isClear ? t.dashboard.noDeadlines : `${label} · ${time}`}
      </div>
    </Card>
  )
}

// ── FOCUS ─────────────────────────────────────────────────────────────────────

const FocusCard = ({ sessions, totalMin, accent, tint }: {
  sessions: number; totalMin: number; accent: string; tint: string
}) => {
  const t = useT()
  const hrs     = Math.floor(totalMin / 60)
  const min     = totalMin % 60
  const display = hrs > 0 ? `${hrs}h${min > 0 ? min : ''}` : `${totalMin}`
  const unit    = hrs > 0 ? (min > 0 ? 'm' : '') : t.pomodoro.min

  return (
    <Card accent={accent} tint={tint}>
      <Label>{t.dashboard.focus}</Label>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--c-text-base)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {display}
          </span>
          {unit && <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--c-text-xfaint)', lineHeight: 1 }}>{unit}</span>}
        </div>
        <div style={{
          fontSize: 9, fontWeight: 700,
          color: sessions > 0 ? accent : '#D8D8D8',
          background: sessions > 0 ? `${accent}18` : 'transparent',
          border: `0.5px solid ${sessions > 0 ? `${accent}40` : 'var(--c-border)'}`,
          borderRadius: 6, padding: '2px 6px',
          marginBottom: 2, flexShrink: 0,
        }}>
          {sessions} {sessions === 1 ? t.dashboard.session : t.dashboard.sessions}
        </div>
      </div>
      <div style={{ fontSize: 8, color: 'var(--c-text-xfaint)' }}>
        {sessions === 0 ? t.dashboard.noFocusToday : t.dashboard.totalFocused}
      </div>
    </Card>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })

export const DashboardSnapshotRow = () => {
  const { events, habits, checkedHabits, doneTaskIds, todayStr } = useScheduleStore()
  const { sessions } = usePomodoroStore()
  const now      = new Date()
  const todayDow = (now.getDay() + 6) % 7

  const todayEvents     = events.filter(e => e.date === todayStr)
  const todayTasksDone  = doneTaskIds.filter(id => todayEvents.some(e => e.id === id)).length

  const todayHabits     = habits.filter(h => h.days.length === 0 || h.days.length === 7 || h.days.includes(todayDow))
  const todayHabitsDone = todayHabits.filter(h => (checkedHabits[h.id] ?? []).includes(todayStr)).length

  const nextDeadline = events
    .filter(e => e.isCountdown)
    .map(e => ({ ...e, at: toDateTime(e.date, e.startTime) }))
    .filter(e => e.at.getTime() >= now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime())[0]

  const todayFocusSessions = sessions.filter(s => s.date === todayStr)
  const totalFocusMin      = todayFocusSessions.reduce((sum, s) => sum + (s.mins ?? 0), 0)

  const daysLeft = nextDeadline
    ? Math.floor((nextDeadline.at.getTime() - now.getTime()) / 86_400_000)
    : null

  return (
    <div style={{ display: 'flex', gap: 8, flexShrink: 0, height: 82 }}>
      <TasksCard  done={todayTasksDone}  total={todayEvents.length}  accent="#83B5B5" tint="rgba(131,181,181,0.07)" />
      <HabitsCard done={todayHabitsDone} total={todayHabits.length} accent="#C1D09D" tint="rgba(193,208,157,0.10)" />
      <DdlCard
        daysLeft={daysLeft}
        label={nextDeadline?.title ?? ''}
        time={nextDeadline ? timeFormatter.format(nextDeadline.at) : ''}
        accent="#F9CE9C" tint="rgba(249,206,156,0.12)"
      />
      <FocusCard sessions={todayFocusSessions.length} totalMin={totalFocusMin} accent="#BFC5D5" tint="rgba(191,197,213,0.12)" />
    </div>
  )
}
