import { useState } from 'react'
import type React from 'react'
import { useScheduleStore, EventColor } from '../../store/scheduleStore'
import { useT } from '../../i18n'

function toMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

const COLORS: EventColor[] = ['#83B5B5', '#F9CE9C', '#C1D09D', '#BFC5D5']

interface Props { onClose: () => void }

export const AddAgendaModal = ({ onClose }: Props) => {
  const { addEvent, loadEvents, events } = useScheduleStore()
  const t = useT()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [color, setColor] = useState<EventColor>('#83B5B5')
  const [description, setDescription] = useState('')
  const [isCountdown, setIsCountdown] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [slotError, setSlotError] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !date || submitting) return

    // Check if this time slot already has 3 overlapping events
    const newStart = toMin(startTime)
    const newEnd = toMin(endTime) > toMin(startTime) ? toMin(endTime) : toMin(startTime) + 30
    const overlapping = events.filter(ev => {
      if (ev.date !== date) return false
      const s = toMin(ev.startTime || '0:00')
      const e = toMin(ev.endTime || '0:00') > toMin(ev.startTime || '0:00') ? toMin(ev.endTime || '0:00') : s + 30
      return newStart < e && newEnd > s
    })
    if (overlapping.length >= 3) {
      setSlotError(true)
      return
    }

    setSlotError(false)
    setSubmitting(true)
    try {
      await addEvent({ title, date, startTime, endTime, color, description, isCountdown })
      await loadEvents()
      onClose()
    } catch {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: 'Inter', fontSize: 10, border: '0.5px solid var(--c-border)',
    borderRadius: 4, padding: '3px 6px', outline: 'none', width: '100%', boxSizing: 'border-box',
    background: 'var(--c-bg-input)', color: 'var(--c-text-base)',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--c-bg-card)', borderRadius: 12, padding: 20, width: 280,
        border: '0.5px solid var(--c-border)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 700, marginBottom: 12, color: 'var(--c-text-base)' }}>{t.schedule.addAgenda}</div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input style={inputStyle} placeholder={t.schedule.eventName} value={title} onChange={e => setTitle(e.target.value)} required />
          <input style={inputStyle} type="date" value={date} onChange={e => setDate(e.target.value)} required />
          <div style={{ display: 'flex', gap: 6 }}>
            <input style={{ ...inputStyle, width: '50%' }} type="time" value={startTime} onChange={e => { setStartTime(e.target.value); setSlotError(false) }} />
            <input style={{ ...inputStyle, width: '50%' }} type="time" value={endTime} onChange={e => { setEndTime(e.target.value); setSlotError(false) }} />
          </div>
          {slotError && (
            <div style={{ fontFamily: 'Inter', fontSize: 10, color: '#e05555', background: '#fff0f0', borderRadius: 4, padding: '4px 8px', border: '0.5px solid #f5c0c0' }}>
              {t.schedule.slotError}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'Inter', fontSize: 10, color: 'var(--c-text-secondary)' }}>{t.common.countdown}</span>
            <div onClick={() => setIsCountdown(!isCountdown)} style={{
              width: 28, height: 14, borderRadius: 7, background: isCountdown ? 'var(--c-text-primary)' : 'var(--c-border)',
              cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
            }}>
              <div style={{
                position: 'absolute', top: 2, left: isCountdown ? 16 : 2,
                width: 10, height: 10, borderRadius: '50%', background: 'white',
                transition: 'left 0.2s',
              }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontFamily: 'Inter', fontSize: 10, color: 'var(--c-text-secondary)' }}>{t.common.color}</span>
            {COLORS.map(c => (
              <div key={c} onClick={() => setColor(c)} style={{
                width: 14, height: 14, borderRadius: '50%', background: c,
                border: color === c ? '2px solid var(--c-text-base)' : '1px solid transparent',
                cursor: 'pointer',
              }} />
            ))}
          </div>
          <textarea style={{ ...inputStyle, resize: 'none', height: 50 }} placeholder={t.common.description} value={description} onChange={e => setDescription(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ fontFamily: 'Inter', fontSize: 10, padding: '4px 12px', borderRadius: 6, border: '0.5px solid var(--c-border)', background: 'var(--c-bg-card)', color: 'var(--c-text-base)', cursor: 'pointer' }}>{t.common.cancel}</button>
            <button type="submit" disabled={submitting} style={{ fontFamily: 'Inter', fontSize: 10, padding: '4px 12px', borderRadius: 6, border: 'none', background: submitting ? 'var(--c-text-disabled)' : 'var(--c-text-primary)', color: 'white', cursor: submitting ? 'default' : 'pointer' }}>{submitting ? '...' : t.common.add}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
