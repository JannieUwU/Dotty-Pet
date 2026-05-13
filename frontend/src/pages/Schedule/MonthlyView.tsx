import { useScheduleStore, CalendarEvent, EventColor } from '../../store/scheduleStore'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const COLORS: EventColor[] = ['#83B5B5', '#F9CE9C', '#C1D09D', '#BFC5D5']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  // 0=Sun..6=Sat -> convert to Mon=0..Sun=6
  const d = new Date(year, month, 1).getDay()
  return (d + 6) % 7
}

export const MonthlyView = ({ year, month, onDayClick }: { year: number; month: number; onDayClick?: (y: number, m: number, d: number) => void }) => {
  const { events, todayStr } = useScheduleStore()

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const daysInPrev = getDaysInMonth(year, month - 1)

  const cells: { day: number; currentMonth: boolean; dateStr: string }[] = []

  const prevM = month === 0 ? 11 : month - 1
  const prevY = month === 0 ? year - 1 : year
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrev - i
    cells.push({ day: d, currentMonth: false, dateStr: `${prevY}-${String(prevM+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, currentMonth: true, dateStr: `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` })
  }
  const nextM = month === 11 ? 0 : month + 1
  const nextY = month === 11 ? year + 1 : year
  const rows = Math.ceil((firstDay + daysInMonth) / 7)
  const total = rows * 7
  for (let d = 1; cells.length < total; d++) {
    cells.push({ day: d, currentMonth: false, dateStr: `${nextY}-${String(nextM+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` })
  }
  const display = cells

  const eventsByDate: Record<string, CalendarEvent[]> = {}
  events.forEach(ev => {
    if (!eventsByDate[ev.date]) eventsByDate[ev.date] = []
    eventsByDate[ev.date].push(ev)
  })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '0.5px solid var(--c-border)' }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontFamily: 'Inter', fontSize: 9, fontWeight: 600, color: 'var(--c-text-secondary)', padding: '4px 0' }}>{d}</div>
        ))}
      </div>
      {/* Grid */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: `repeat(${rows}, 1fr)`, overflow: 'hidden' }}>
        {display.map((cell, i) => {
          const cellEvents = eventsByDate[cell.dateStr] || []
          const isToday = cell.dateStr === todayStr
          return (
            <div key={i} onClick={() => { if (cell.currentMonth) onDayClick?.(year, month, cell.day) }} style={{
              borderRight: '0.5px solid var(--c-border-xlight)', borderBottom: '0.5px solid var(--c-border-xlight)',
              padding: '3px 3px', background: cell.currentMonth ? 'transparent' : 'var(--c-bg-subtle)',
              overflow: 'hidden', cursor: cell.currentMonth ? 'pointer' : 'default',
            }}>
              <div style={{
                fontFamily: 'Inter', fontSize: 9, fontWeight: isToday ? 700 : 400,
                color: cell.currentMonth ? (isToday ? 'var(--c-bg-page)' : 'var(--c-text-base)') : 'var(--c-text-xfaint)',
                background: isToday ? 'var(--c-text-primary)' : 'transparent',
                borderRadius: isToday ? '50%' : 0,
                width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 2,
              }}>
                {cell.day}
              </div>
              {cell.currentMonth && cellEvents.slice(0, 4).map(ev => (
                <div key={ev.id} style={{
                  width: '100%', height: 14, borderRadius: 3,
                  background: `${ev.color}33`,
                  borderLeft: `2.5px solid ${ev.color}`,
                  display: 'flex', alignItems: 'center', paddingLeft: 3,
                  marginBottom: 1, overflow: 'hidden', boxSizing: 'border-box',
                }}>
                  <span style={{ fontFamily: 'Inter', fontSize: 8, fontWeight: 600, color: ev.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ev.title}
                  </span>
                </div>
              ))}
              {cell.currentMonth && cellEvents.length > 4 && (
                <div style={{ fontFamily: 'Inter', fontSize: 8, fontWeight: 500, color: 'var(--c-text-muted)', paddingLeft: 2 }}>
                  +{cellEvents.length - 4} more
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
