import { useScheduleStore } from '../../store/scheduleStore'
import { DotIcon } from '../../components/icons/NavIcons'
import { useT } from '../../i18n'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function getCountdown(dateStr: string, startTime: string): { value: number; unit: string } | null {
  const now = new Date()
  const target = new Date(`${dateStr}T${startTime}:00`)
  const diff = target.getTime() - now.getTime()
  if (diff <= 0) return null
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  const months = Math.floor(days / 30)
  if (months >= 1) return { value: months, unit: 'm' }
  if (days >= 1) return { value: days, unit: 'd' }
  if (hrs >= 1) return { value: hrs, unit: 'h' }
  return { value: mins, unit: 'min' }
}

export const ContainerA = () => {
  const { events, habits, checkedHabits, doneTaskIds, todayStr } = useScheduleStore()
  const t = useT()
  const today = new Date()
  const day = today.getDate()
  const month = MONTHS[today.getMonth()]
  const year = today.getFullYear()

  // Tasks: today's calendar events
  const todayEvents = events.filter(e => e.date === todayStr)
  const taskTotal = todayEvents.length
  const taskDone = doneTaskIds.filter(id => todayEvents.some(e => e.id === id)).length
  const taskRemaining = taskTotal - taskDone

  // Habits: scheduled for today
  const todayDow = (today.getDay() + 6) % 7 // 0=Mon
  const todayHabits = habits.filter(h => h.days.length === 0 || h.days.includes(todayDow))
  const habitTotal = todayHabits.length
  const habitDone = todayHabits.filter(h => (checkedHabits[h.id] ?? []).includes(todayStr)).length
  const habitRemaining = habitTotal - habitDone

  const goalDone = (taskTotal > 0 || habitTotal > 0) && taskRemaining === 0 && habitRemaining === 0

  const countdownEvents = events
    .filter(e => e.isCountdown)
    .map(e => ({ ev: e, cd: getCountdown(e.date, e.startTime) }))
    .filter(({ cd }) => cd !== null)
    .sort((a, b) => new Date(`${a.ev.date}T${a.ev.startTime}`).getTime() - new Date(`${b.ev.date}T${b.ev.startTime}`).getTime())
    .slice(0, 3)

  return (
    <div style={{
      flex: '335 0 0', minWidth: 0, height: 87, background: 'var(--c-bg-subtle)', borderRadius: 18,
      border: '0.5px solid var(--c-border)', display: 'flex', alignItems: 'stretch',
      padding: '8px 14px', gap: 12, boxSizing: 'border-box', flexShrink: 0,
    }}>
      {/* Left: date + progress */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{
          background: 'var(--c-bg-card)', borderRadius: 4,
          border: '0.5px solid var(--c-border)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', height: 32,
        }}>
          <span style={{ fontFamily: "'Londrina Sketch', cursive", fontSize: 24, fontWeight: 400, color: 'var(--c-text-base)' }}>
            {day}/{month}/{year}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', justifyContent: 'center' }}>
          {/* Task */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 600, color: 'var(--c-text-secondary)' }}>{t.schedule.task}</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              <span style={{ fontFamily: 'Inter', fontSize: 20, fontWeight: 600, color: 'var(--c-text-base)' }}>{taskDone}</span>
              <span style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 600, color: 'var(--c-text-base)' }}>/{taskTotal}</span>
            </div>
          </div>
          {/* Habits */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 600, color: 'var(--c-text-secondary)' }}>{t.schedule.habits}</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              <span style={{ fontFamily: 'Inter', fontSize: 20, fontWeight: 600, color: 'var(--c-text-base)' }}>{habitDone}</span>
              <span style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 600, color: 'var(--c-text-base)' }}>/{habitTotal}</span>
            </div>
          </div>
          {/* Goal */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', alignSelf: 'stretch' }}>
            <span style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 600, color: 'var(--c-text-secondary)' }}>{t.schedule.goal}</span>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: goalDone ? 1 : 0.3 }}>
              <svg width="24" height="24" viewBox="0 0 16 16" fill="none">
                <path d="M4 2H12V8C12 10.2 10.2 12 8 12C5.8 12 4 10.2 4 8V2Z" stroke={goalDone ? '#F9CE9C' : 'var(--c-text-base)'} strokeWidth="1.2"/>
                <path d="M4 4H2C2 4 1.5 7 4 7" stroke={goalDone ? '#F9CE9C' : 'var(--c-text-base)'} strokeWidth="1.2" strokeLinecap="round"/>
                <path d="M12 4H14C14 4 14.5 7 12 7" stroke={goalDone ? '#F9CE9C' : 'var(--c-text-base)'} strokeWidth="1.2" strokeLinecap="round"/>
                <path d="M8 12V14M5 14H11" stroke={goalDone ? '#F9CE9C' : 'var(--c-text-base)'} strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: '0.5px', background: 'var(--c-border)', alignSelf: 'stretch' }} />

      {/* Right: countdown */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
        {countdownEvents.map(({ ev, cd }) => (
          <div key={ev.id} style={{
            height: 20, opacity: 0.6,
            background: 'var(--c-bg-muted)', borderRadius: 5,
            border: '0.10px solid var(--c-border)', display: 'flex',
            alignItems: 'center', paddingLeft: 6, paddingRight: 6, gap: 4,
          }}>
            <DotIcon />
            <span style={{ fontFamily: 'Inter', fontSize: 9, fontWeight: 400, letterSpacing: '0.63px', color: 'var(--c-text-base)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ev.title}
            </span>
            <span style={{ fontFamily: 'Inter', fontSize: 15, fontWeight: 600, color: 'var(--c-text-base)' }}>{cd!.value}</span>
            <span style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 600, color: 'var(--c-text-secondary)' }}>{cd!.unit}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
