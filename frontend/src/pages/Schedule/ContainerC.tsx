import { useState, useEffect } from 'react'
import { ChevronIcon, PlusCircleIcon } from '../../components/icons/NavIcons'
import { MonthlyView } from './MonthlyView'
import { WeeklyView } from './WeeklyView'
import { DailyView } from './DailyView'
import { useT } from '../../i18n'
import { AddAgendaModal } from './AddAgendaModal'
import { MonthPickerPopup } from './MonthPickerPopup'
import { useAppStore } from '../../store/appStore'

const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
type View = 'Daily' | 'Weekly' | 'Monthly'

export const ContainerC = () => {
  const now = new Date()
  const t = useT()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [day, setDay] = useState(now.getDate())
  const [view, setView] = useState<View>('Monthly')
  const [showModal, setShowModal] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const { scheduleFocusTarget, clearScheduleFocusTarget } = useAppStore()

  useEffect(() => {
    if (!scheduleFocusTarget) return
    const d = new Date(scheduleFocusTarget.date + 'T12:00:00')
    setYear(d.getFullYear())
    setMonth(d.getMonth())
    setDay(d.getDate())
    setView(scheduleFocusTarget.view)
    clearScheduleFocusTarget()
  }, [scheduleFocusTarget])

  return (
    <div style={{
      width: '100%', flex: 1, background: 'var(--c-bg-card)', borderRadius: 18,
      border: '0.5px solid var(--c-border)', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', boxSizing: 'border-box',
    }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', flexShrink: 0 }}>
        {/* Month/Year button */}
        <div style={{ position: 'relative' }}>
          <div onClick={() => setShowPicker(p => !p)} style={{
            width: 103, height: 26, background: 'var(--c-bg-hover)', borderRadius: 8,
            border: '0.5px solid var(--c-border)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 4, cursor: 'pointer',
          }}>
            <span style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 600, color: 'var(--c-text-base)' }}>
              {year} | {MONTH_NAMES[month]}
            </span>
            <ChevronIcon open={showPicker} />
          </div>
          {showPicker && (
            <MonthPickerPopup
              year={year} month={month}
              onSelect={(y, m) => { setYear(y); setMonth(m) }}
              onClose={() => setShowPicker(false)}
            />
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* View switcher */}
          {(() => {
            const views: { key: View; label: string }[] = [
              { key: 'Daily', label: t.schedule.daily },
              { key: 'Weekly', label: t.schedule.weekly },
              { key: 'Monthly', label: t.schedule.monthly },
            ]
            const idx = views.findIndex(v => v.key === view)
            return (
              <div style={{
                position: 'relative', height: 26, background: 'var(--c-bg-muted)', borderRadius: 8,
                border: '0.5px solid var(--c-border)', display: 'flex', alignItems: 'center',
                padding: '2px', boxSizing: 'border-box',
              }}>
                {/* sliding pill */}
                <div style={{
                  position: 'absolute', top: 2, height: 'calc(100% - 4px)',
                  width: 'calc(33.333% - 2.67px)',
                  left: `calc(${idx * 33.333}% + 2px)`,
                  background: 'var(--c-text-primary)', borderRadius: 6,
                  transition: 'left 0.22s cubic-bezier(0.4,0,0.2,1)',
                  pointerEvents: 'none',
                }} />
                {views.map(v => (
                  <div key={v.key} onClick={() => setView(v.key)} style={{
                    flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', position: 'relative', zIndex: 1, minWidth: 52,
                  }}>
                    <span style={{
                      fontFamily: 'Inter', fontSize: 9, fontWeight: 600,
                      color: view === v.key ? 'var(--c-bg-page)' : 'var(--c-text-muted)',
                      transition: 'color 0.22s',
                    }}>{v.label}</span>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Add Agenda */}
          <div onClick={() => setShowModal(true)} style={{
            width: 86, height: 24, background: 'var(--c-text-primary)', borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer',
          }}>
            <PlusCircleIcon color="var(--c-bg-page)" size={8} />
            <span style={{ fontFamily: 'Inter', fontSize: 8, fontWeight: 600, color: 'var(--c-bg-page)', letterSpacing: '0.32px' }}>{t.schedule.addAgenda}</span>
          </div>
        </div>
      </div>

      {/* Calendar content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '0 8px 8px' }}>
        {view === 'Monthly' && <MonthlyView year={year} month={month} onDayClick={(y,m,d) => { setYear(y); setMonth(m); setDay(d); setView('Daily') }} />}
        {view === 'Weekly' && <WeeklyView year={year} month={month} day={day} />}
        {view === 'Daily' && <DailyView year={year} month={month} day={day} />}
      </div>

      {showModal && <AddAgendaModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
