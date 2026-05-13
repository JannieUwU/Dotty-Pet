import { useAppStore } from '../../store/appStore'
import { useScheduleStore } from '../../store/scheduleStore'
import { useT } from '../../i18n'
import { dashboardCardStyle, dashboardMutedStyle, dashboardTitleStyle } from './dashboardStyles'

const monthDayFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
const toDateTime = (date: string, time: string) => new Date(`${date}T${time}:00`)
const toDayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const getDayDiff = (target: Date, base: Date) =>
  Math.round((toDayStart(target).getTime() - toDayStart(base).getTime()) / 86400000)

export const DashboardDeadlineCard = () => {
  const { events } = useScheduleStore()
  const { goToScheduleDate } = useAppStore()
  const t = useT()
  const now = new Date()

  const formatDeadlineMeta = (date: string, time: string) => {
    const target = toDateTime(date, time)
    const diff = getDayDiff(target, now)
    if (diff === 0) return { meta: t.dashboard.dueToday(timeFormatter.format(target)), dot: '#E58F8F' }
    if (diff === 1) return { meta: t.dashboard.dueTomorrow(timeFormatter.format(target)), dot: '#83B5B5' }
    return { meta: t.dashboard.dueOn(monthDayFormatter.format(target)), dot: '#C8CCD4' }
  }

  const deadlines = events
    .filter((e) => e.isCountdown)
    .map((e) => ({ id: e.id, title: e.title, date: e.date, at: toDateTime(e.date, e.startTime), ...formatDeadlineMeta(e.date, e.startTime) }))
    .filter((e) => e.at.getTime() >= now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime())

  return (
    <div style={{ ...dashboardCardStyle, flex: 1, padding: '16px 18px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F9CE9C', flexShrink: 0 }} />
        <div style={dashboardTitleStyle}>{t.dashboard.ddlSummary}</div>
      </div>
      <div style={{ ...dashboardMutedStyle, marginTop: 4, marginBottom: 14 }}>{t.dashboard.ddlSubtitle}</div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
        {deadlines.length === 0 ? (
          <div style={{ height: '100%', minHeight: 84, borderRadius: 10, background: 'rgba(249,206,156,0.08)', border: '0.5px dashed var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--c-text-faint)' }}>
            {t.dashboard.noUpcomingDdl}
          </div>
        ) : deadlines.map((item, index) => (
          <div key={item.id} onClick={() => goToScheduleDate(item.date, 'Daily')} style={{
            display: 'flex', gap: 10,
            padding: index === deadlines.length - 1 ? '10px 0 0' : '10px 0',
            borderBottom: index === deadlines.length - 1 ? 'none' : '0.5px solid var(--c-border-light)',
            cursor: 'pointer', borderRadius: 8,
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(249,206,156,0.10)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{ width: 8, height: 8, marginTop: 5, borderRadius: '50%', background: item.dot, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text-base)', lineHeight: 1.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
              <div style={{ fontSize: 9, color: 'var(--c-text-muted)', marginTop: 2 }}>{item.meta}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
