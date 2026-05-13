import { useState } from 'react'
import type React from 'react'
import { useScheduleStore, CalendarEvent, EventColor } from '../../store/scheduleStore'
import { useT } from '../../i18n'

const COLORS: EventColor[] = ['#83B5B5', '#F9CE9C', '#C1D09D', '#BFC5D5']

function toMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

interface Props {
  event: CalendarEvent
  onClose: () => void
}

export const EventDetailModal = ({ event, onClose }: Props) => {
  const { updateEvent, deleteEvent, loadEvents, events } = useScheduleStore()
  const t = useT()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(event.title)
  const [date, setDate] = useState(event.date)
  const [startTime, setStartTime] = useState(event.startTime)
  const [endTime, setEndTime] = useState(event.endTime)
  const [color, setColor] = useState<EventColor>(event.color)
  const [description, setDescription] = useState(event.description)
  const [isCountdown, setIsCountdown] = useState(event.isCountdown)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [slotError, setSlotError] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !date || saving) return

    const newStart = toMin(startTime)
    const newEnd = toMin(endTime) > toMin(startTime) ? toMin(endTime) : toMin(startTime) + 30
    const overlapping = events.filter(ev => {
      if (ev.id === event.id || ev.date !== date) return false
      const s = toMin(ev.startTime || '0:00')
      const e = toMin(ev.endTime || '0:00') > toMin(ev.startTime || '0:00') ? toMin(ev.endTime || '0:00') : s + 30
      return newStart < e && newEnd > s
    })
    if (overlapping.length >= 3) {
      setSlotError(true)
      return
    }

    setSlotError(false)
    setSaving(true)
    try {
      await updateEvent(event.id, { title, date, startTime, endTime, color, description, isCountdown })
      await loadEvents()
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteEvent(event.id)
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: 'Inter', fontSize: 10, border: '0.5px solid var(--c-border)',
    borderRadius: 4, padding: '3px 6px', outline: 'none', width: '100%', boxSizing: 'border-box',
    background: 'var(--c-bg-input)', color: 'var(--c-text-base)',
  }

  const dot = (c: string) => (
    <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--c-bg-card)', borderRadius: 12, padding: 20, width: 280,
        border: '0.5px solid var(--c-border)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {dot(event.color)}
            <span style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 700, color: 'var(--c-text-base)' }}>
              {editing ? t.schedule.editAgenda : t.schedule.agendaDetail}
            </span>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--c-text-faint)', lineHeight: 1, padding: 0 }}>✕</button>
        </div>

        {editing ? (
          /* ── Edit form ── */
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
              <div onClick={() => setIsCountdown(v => !v)} style={{
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
                  border: color === c ? '2px solid var(--c-text-base)' : '1px solid transparent', cursor: 'pointer',
                }} />
              ))}
            </div>
            <textarea style={{ ...inputStyle, resize: 'none', height: 50 }} placeholder={t.common.description} value={description} onChange={e => setDescription(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" onClick={() => setEditing(false)} style={{ fontFamily: 'Inter', fontSize: 10, padding: '4px 12px', borderRadius: 6, border: '0.5px solid var(--c-border)', background: 'var(--c-bg-card)', color: 'var(--c-text-base)', cursor: 'pointer' }}>{t.common.cancel}</button>
              <button type="submit" disabled={saving} style={{ fontFamily: 'Inter', fontSize: 10, padding: '4px 12px', borderRadius: 6, border: 'none', background: saving ? 'var(--c-text-disabled)' : 'var(--c-text-primary)', color: 'white', cursor: saving ? 'default' : 'pointer' }}>{saving ? '...' : t.common.save}</button>
            </div>
          </form>
        ) : (
          /* ── Detail view ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: 600, color: 'var(--c-text-base)' }}>{event.title}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Row label={t.schedule.date} value={event.date} />
              <Row label={t.schedule.time} value={`${event.startTime} – ${event.endTime}`} />
              {event.description && <Row label={t.schedule.note} value={event.description} />}
              <Row label={t.common.countdown} value={event.isCountdown ? t.common.on : t.common.off} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={handleDelete} disabled={deleting} style={{ fontFamily: 'Inter', fontSize: 10, padding: '4px 12px', borderRadius: 6, border: '0.5px solid #e05555', background: 'var(--c-bg-card)', color: deleting ? 'var(--c-text-disabled)' : '#e05555', cursor: deleting ? 'default' : 'pointer' }}>{deleting ? '...' : t.common.delete}</button>
              <button onClick={() => setEditing(true)} style={{ fontFamily: 'Inter', fontSize: 10, padding: '4px 12px', borderRadius: 6, border: 'none', background: 'var(--c-text-primary)', color: 'white', cursor: 'pointer' }}>{t.common.edit}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
    <span style={{ fontFamily: 'Inter', fontSize: 10, color: 'var(--c-text-faint)', width: 56, flexShrink: 0 }}>{label}</span>
    <span style={{ fontFamily: 'Inter', fontSize: 10, color: 'var(--c-text-base)' }}>{value}</span>
  </div>
)
