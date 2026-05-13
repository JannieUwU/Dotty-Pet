import { useState } from 'react'
import { useScheduleStore } from '../../store/scheduleStore'
import { useT } from '../../i18n'

const PRESET_KEYS = [
  'healthy-routine', 'meditation', 'weight-loss', 'eat-fruits', 'eat-veggies',
  'drink-water', 'learn-instrument', 'learn-language', 'charity', 'quit-smoking',
  'no-sugar', 'no-alcohol', 'skincare', 'early-sleep', 'early-rise',
  'breakfast', 'take-meds', 'clean-up', 'swimming', 'pet-care',
  'finance', 'yoga', 'calligraphy', 'drawing', 'vocabulary',
  'watch-film', 'running', 'exercise', 'reading', 'cycling',
]
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <div onClick={() => onChange(!value)} style={{ width: 28, height: 16, borderRadius: 8, background: value ? '#83B5B5' : 'var(--c-border)', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.18s' }}>
    <div style={{ position: 'absolute', top: 2, left: value ? 14 : 2, width: 12, height: 12, borderRadius: '50%', background: 'white', transition: 'left 0.18s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
  </div>
)

const IconGrid = ({ selected, onSelect, presets }: { selected: string; onSelect: (name: string) => void; presets: { key: string; label: string }[] }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
    {presets.map(({ key, label }) => (
      <div key={key} onClick={() => onSelect(key)} style={{
        aspectRatio: '1', background: selected === key ? 'rgba(131,181,181,0.15)' : 'var(--c-bg-subtle)',
        borderRadius: 12, border: selected === key ? '1.5px solid #83B5B5' : '1px solid var(--c-border)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 3, cursor: 'pointer', transition: 'all 0.15s', padding: 4, boxSizing: 'border-box',
      }}>
        <img src={`/habits/${key}.png`} style={{ width: 28, height: 28, objectFit: 'contain' }} />
        <span style={{ fontFamily: 'Inter', fontSize: 8, fontWeight: 500, color: 'var(--c-text-primary)', textAlign: 'center', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{label}</span>
      </div>
    ))}
  </div>
)

const IconGridSimple = ({ selected, onSelect }: { selected: string; onSelect: (name: string) => void }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, maxHeight: 176, overflowY: 'auto' }}>
    {PRESET_KEYS.map((key) => (
      <div key={key} onClick={() => onSelect(key)} style={{
        aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 6, cursor: 'pointer', background: selected === key ? 'rgba(131,181,181,0.15)' : 'transparent',
        outline: selected === key ? '1.5px solid #83B5B5' : 'none', transition: 'all 0.15s',
      }}>
        <img src={`/habits/${key}.png`} style={{ width: 32, height: 32, objectFit: 'contain' }} />
      </div>
    ))}
  </div>
)

export const AddHabitsModal = ({ onClose }: { onClose: () => void }) => {
  const addHabit = useScheduleStore(s => s.addHabit)
  const t = useT()
  const [mode, setMode] = useState<'preset'|'custom'>('preset')
  const [selectedPreset, setSelectedPreset] = useState('')
  const [customName, setCustomName] = useState('')
  const [customIcon, setCustomIcon] = useState('')
  const [days, setDays] = useState<number[]>([])
  const [reminder, setReminder] = useState(false)
  const [reminderTime, setReminderTime] = useState('07:00')

  const PRESETS = PRESET_KEYS.map(key => ({ key, label: t.habits.presets[key] ?? key }))
  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

  const toggleDay = (i: number) => setDays(d => d.includes(i) ? d.filter(x => x !== i) : [...d, i])
  const toggleAll = () => setDays(d => d.length === 7 ? [] : [0,1,2,3,4,5,6])

  const canAdd = mode === 'preset' ? !!selectedPreset : (!!customName.trim() && !!customIcon)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 480, background: 'var(--c-bg-card)', borderRadius: 18, border: '0.5px solid var(--c-border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: '20px 24px',
        display: 'flex', flexDirection: 'column', gap: 14,
        animation: 'advPop 0.18s ease',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: 700, color: 'var(--c-text-primary)' }}>{t.habits.addHabit}</span>
          <span onClick={onClose} style={{ fontFamily: 'Inter', fontSize: 16, color: 'var(--c-text-faint)', cursor: 'pointer', lineHeight: 1 }}>×</span>
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--c-border)' }}>
          {(['preset','custom'] as const).map(m => (
            <div key={m} onClick={() => setMode(m)} style={{
              padding: '6px 14px', cursor: 'pointer', fontFamily: 'Inter', fontSize: 9, fontWeight: 600,
              color: mode === m ? 'var(--c-text-primary)' : 'var(--c-text-faint)',
              borderBottom: mode === m ? '2px solid var(--c-text-primary)' : '2px solid transparent',
              marginBottom: -1,
            }}>{m === 'preset' ? t.habits.presetHabits : t.habits.custom}</div>
          ))}
        </div>

        {/* Mode content */}
        {mode === 'preset' ? (
          <IconGrid selected={selectedPreset} onSelect={setSelectedPreset} presets={PRESETS} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: 240 }}>
            <div>
              <div style={{ fontFamily: 'Inter', fontSize: 8, fontWeight: 600, color: 'var(--c-text-primary)', marginBottom: 4 }}>{t.habits.habitName}</div>
              <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="e.g. Morning Journaling"
                style={{ width: '100%', height: 32, border: '0.5px solid var(--c-border)', borderRadius: 8, padding: '0 10px', fontFamily: 'Inter', fontSize: 10, color: 'var(--c-text-base)', outline: 'none', boxSizing: 'border-box', background: 'var(--c-bg-input)' }} />
            </div>
            <div>
              <div style={{ fontFamily: 'Inter', fontSize: 8, fontWeight: 600, color: 'var(--c-text-primary)', marginBottom: 4 }}>{t.habits.chooseIcon}</div>
              <IconGridSimple selected={customIcon} onSelect={setCustomIcon} />
            </div>
          </div>
        )}

        {/* Common settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Repeat */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
            <span style={{ fontFamily: 'Inter', fontSize: 8, fontWeight: 600, color: 'var(--c-text-primary)' }}>{t.habits.repeat}</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {DAYS.map((d, i) => (
                <div key={d} onClick={() => toggleDay(i)} style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: days.includes(i) ? 'var(--c-text-primary)' : 'var(--c-bg-muted)', cursor: 'pointer',
                  fontFamily: 'Inter', fontSize: 8, fontWeight: 600, color: days.includes(i) ? 'white' : 'var(--c-text-muted)',
                }}>{d.slice(0,1)}</div>
              ))}
              <div onClick={toggleAll} style={{
                height: 28, padding: '0 10px', borderRadius: 14, display: 'flex', alignItems: 'center',
                background: days.length === 7 ? 'var(--c-text-primary)' : 'var(--c-bg-muted)', cursor: 'pointer',
                fontFamily: 'Inter', fontSize: 8, fontWeight: 600, color: days.length === 7 ? 'white' : 'var(--c-text-muted)',
              }}>{t.habits.every}</div>
            </div>
          </div>

          {/* Reminder */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'Inter', fontSize: 8, fontWeight: 600, color: 'var(--c-text-primary)' }}>{t.habits.reminder}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {reminder && (
                <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)}
                  style={{ height: 28, border: '0.5px solid var(--c-border)', borderRadius: 8, padding: '0 10px', fontFamily: 'Inter', fontSize: 10, color: 'var(--c-text-base)', outline: 'none', background: 'var(--c-bg-input)' }} />
              )}
              <Toggle value={reminder} onChange={setReminder} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ height: '0.5px', background: 'var(--c-border)' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <div onClick={onClose} style={{ height: 30, padding: '0 16px', borderRadius: 8, background: 'var(--c-bg-muted)', border: '0.5px solid var(--c-border)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <span style={{ fontFamily: 'Inter', fontSize: 9, fontWeight: 600, color: 'var(--c-text-muted)' }}>{t.common.cancel}</span>
          </div>
          <div onClick={canAdd ? () => {
            const icon = mode === 'preset' ? selectedPreset : customIcon
            const name = mode === 'preset' ? (PRESETS.find(p => p.key === selectedPreset)?.label ?? selectedPreset) : customName.trim()
            addHabit({ name, icon, time: reminderTime, days, reminder, reminderTime: reminder ? reminderTime : undefined })
            onClose()
          } : undefined} style={{ height: 30, padding: '0 20px', borderRadius: 8, background: 'var(--c-text-primary)', display: 'flex', alignItems: 'center', cursor: canAdd ? 'pointer' : 'not-allowed', opacity: canAdd ? 1 : 0.4 }}>
            <span style={{ fontFamily: 'Inter', fontSize: 9, fontWeight: 600, color: 'white' }}>{t.habits.addHabit}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
