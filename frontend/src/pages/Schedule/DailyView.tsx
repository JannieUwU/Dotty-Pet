import { useState } from 'react'
import { useScheduleStore, CalendarEvent } from '../../store/scheduleStore'
import { EventDetailModal } from './EventDetailModal'
import { layoutEvents } from './layoutEvents'

const TIMES = ['3 AM', '6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM']
const TIME_HOURS = [3, 6, 9, 12, 15, 18, 21]
const TOTAL_HOURS = 24
const PX_PER_HOUR = 50
const GRID_HEIGHT = TOTAL_HOURS * PX_PER_HOUR
const GUTTER = 4 // px padding inside each day column

export const DailyView = ({ year, month, day }: { year: number; month: number; day: number }) => {
  const { events } = useScheduleStore()
  const [selected, setSelected] = useState<CalendarEvent | null>(null)

  const today     = new Date(year, month, day)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const tomorrow  = new Date(today); tomorrow.setDate(today.getDate() + 1)

  const cols = [yesterday, today, tomorrow]
  const colLabels = [
    { day: yesterday.toLocaleDateString('en', { weekday: 'short' }), date: yesterday.getDate() },
    { day: today.toLocaleDateString('en', { weekday: 'short' }),     date: today.getDate() },
    { day: tomorrow.toLocaleDateString('en', { weekday: 'short' }),  date: tomorrow.getDate() },
  ]

  return (
    <>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Fixed header */}
        <div style={{ display: 'flex', flexShrink: 0, borderBottom: '0.5px solid var(--c-border)' }}>
          <div style={{ width: 36, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {colLabels.map((l, i) => (
              <div key={i} style={{ textAlign: 'center', fontFamily: 'Inter', fontSize: 8, fontWeight: 600, color: i === 1 ? 'var(--c-text-base)' : 'var(--c-text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px 0' }}>
                <span>{l.day}</span>
                <span style={{ fontSize: 7 }}>{l.date}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex' }}>
          {/* Time axis */}
          <div style={{ width: 36, flexShrink: 0, position: 'relative', height: GRID_HEIGHT }}>
            {TIMES.map((t, i) => (
              <div key={t} style={{
                position: 'absolute', top: TIME_HOURS[i] * PX_PER_HOUR - 6,
                right: 4, fontFamily: 'Inter', fontSize: 7, fontWeight: 700,
                color: 'var(--c-text-secondary)', whiteSpace: 'nowrap',
              }}>{t}</div>
            ))}
          </div>

          {/* Grid */}
          <div style={{ flex: 1, position: 'relative', height: GRID_HEIGHT }}>
            {TIME_HOURS.map((h, i) => (
              <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: h * PX_PER_HOUR, borderTop: '1px dashed var(--c-border)' }} />
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', height: '100%' }}>
              {cols.map((d, colIdx) => {
                const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
                const dayEvents = events.filter(e => e.date === dateStr)
                const laid = layoutEvents(dayEvents, PX_PER_HOUR)

                return (
                  <div key={colIdx} style={{ position: 'relative', borderRight: '0.5px solid var(--c-border-xlight)', background: colIdx === 1 ? 'rgba(193,208,157,0.04)' : 'transparent' }}>
                    {laid.map(({ ev, slot, totalCols, top, height }) => {
                      const colW = (100 - GUTTER * 2) / totalCols
                      const left  = `${GUTTER + slot * colW}%`
                      const width = `${colW - 1}%`
                      return (
                        <div
                          key={ev.id}
                          onClick={() => setSelected(ev)}
                          style={{
                            position: 'absolute', top, left, width, height,
                            background: `${ev.color}33`, borderLeft: `3px solid ${ev.color}`,
                            borderRadius: 4, padding: '3px 5px', overflow: 'hidden',
                            boxSizing: 'border-box', cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 700, color: ev.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ev.title}
                          </div>
                          {ev.description && height > 36 && (
                            <div style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 400, color: 'var(--c-text-muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: Math.floor((height - 22) / 14), WebkitBoxOrient: 'vertical' }}>
                              {ev.description}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <EventDetailModal
          event={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
