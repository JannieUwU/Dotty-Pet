import { useScheduleStore } from '../../store/scheduleStore'
import { useRef, useState, useEffect } from 'react'
import { layoutEvents } from './layoutEvents'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TIMES = ['3 AM', '6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM']
const TIME_HOURS = [3, 6, 9, 12, 15, 18, 21]
const TOTAL_HOURS = 24
const GUTTER = 2 // px

function getWeekDates(year: number, month: number, day: number) {
  const now = new Date(year, month, day)
  const dow = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dow + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

export const WeeklyView = ({ year, month, day }: { year: number; month: number; day: number }) => {
  const { events } = useScheduleStore()
  const weekDates = getWeekDates(year, month, day)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [bodyHeight, setBodyHeight] = useState(300)

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const ro = new ResizeObserver(e => setBodyHeight(e[0].contentRect.height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pxPerHour = bodyHeight / TOTAL_HOURS

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Fixed header */}
      <div style={{ display: 'flex', flexShrink: 0, borderBottom: '0.5px solid var(--c-border)' }}>
        <div style={{ width: 36, flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {weekDates.map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontFamily: 'Inter', fontSize: 8, fontWeight: 600, color: 'var(--c-text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px 0' }}>
              <span>{DAYS[i]}</span>
              <span style={{ fontSize: 7, color: 'var(--c-text-muted)' }}>{d.getDate()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {/* Time axis */}
        <div style={{ width: 36, flexShrink: 0, position: 'relative' }}>
          {TIMES.map((t, i) => (
            <div key={t} style={{
              position: 'absolute', top: TIME_HOURS[i] * pxPerHour - 6,
              right: 4, fontFamily: 'Inter', fontSize: 7, fontWeight: 700,
              color: 'var(--c-text-secondary)', whiteSpace: 'nowrap',
            }}>{t}</div>
          ))}
        </div>

        {/* Grid */}
        <div ref={bodyRef} style={{ flex: 1, position: 'relative' }}>
          {TIME_HOURS.map((h, i) => (
            <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: h * pxPerHour, borderTop: '1px dashed var(--c-border)' }} />
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', height: '100%' }}>
            {weekDates.map((d, colIdx) => {
              const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
              const dayEvents = events.filter(e => e.date === dateStr)
              const laid = layoutEvents(dayEvents, pxPerHour)

              return (
                <div key={colIdx} style={{ position: 'relative', borderRight: '0.5px solid var(--c-border-xlight)' }}>
                  {laid.map(({ ev, slot, totalCols, top, height }) => {
                    const colW = (100 - GUTTER * 2) / totalCols
                    const left  = `${GUTTER + slot * colW}%`
                    const width = `${colW - 1}%`
                    return (
                      <div key={ev.id} style={{
                        position: 'absolute', top, left, width, height,
                        background: `${ev.color}33`, borderLeft: `2.5px solid ${ev.color}`,
                        borderRadius: 3, overflow: 'hidden', padding: '2px 3px',
                        boxSizing: 'border-box',
                      }}>
                        <span style={{ fontFamily: 'Inter', fontSize: 8, fontWeight: 600, color: ev.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                          {ev.title}
                        </span>
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
  )
}
