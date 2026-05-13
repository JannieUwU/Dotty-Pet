import { useState, useEffect, useRef } from 'react'
import { useScheduleStore } from '../../store/scheduleStore'
import { usePomodoroStore } from '../../store/pomodoroStore'
import { useThemeStore } from '../../store/themeStore'
import { PlusCircleIcon } from '../../components/icons/NavIcons'
import { AddHabitsModal } from './AddHabitsModal'
import { TaskBreakdownView } from './TaskBreakdownView'
import { StatisticsView } from './StatisticsView'
import { useT } from '../../i18n'
import { apiFetch } from '../../utils/api'

interface FocusSession { task: string; start: string; end: string; mins: number; date: string }

interface AdvSettings { autoBreak: boolean; autoFocus: boolean; longBreakEvery: number; longBreakDur: number }

const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <div onClick={() => onChange(!value)} style={{ width: 28, height: 16, borderRadius: 8, background: value ? '#83B5B5' : 'var(--c-border)', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.18s' }}>
    <div style={{ position: 'absolute', top: 2, left: value ? 14 : 2, width: 12, height: 12, borderRadius: '50%', background: 'white', transition: 'left 0.18s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
  </div>
)

const Stepper = ({ value, onChange, min, max, step = 1 }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
    <div onClick={() => onChange(Math.max(min, value - step))} style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--c-bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'Inter', fontSize: 10, fontWeight: 600, color: 'var(--c-text-primary)' }}>−</div>
    <span style={{ width: 20, textAlign: 'center', fontFamily: 'Inter', fontSize: 10, fontWeight: 600, color: 'var(--c-text-base)' }}>{value}</span>
    <div onClick={() => onChange(Math.min(max, value + step))} style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--c-bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'Inter', fontSize: 10, fontWeight: 600, color: 'var(--c-text-primary)' }}>+</div>
  </div>
)

const SettingRow = ({ label, sub, right }: { label: string; sub: string; right: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
    <div>
      <div style={{ fontFamily: 'Inter', fontSize: 9, fontWeight: 500, color: 'var(--c-text-base)' }}>{label}</div>
      <div style={{ fontFamily: 'Inter', fontSize: 7, fontWeight: 400, color: 'var(--c-text-faint)' }}>{sub}</div>
    </div>
    {right}
  </div>
)

const AdvancedSettingsPopup = ({ onClose, onSave }: { onClose: () => void; onSave: (s: AdvSettings) => void }) => {
  const [s, setS] = useState<AdvSettings>({ autoBreak: false, autoFocus: false, longBreakEvery: 4, longBreakDur: 15 })
  const ref = useRef<HTMLDivElement>(null)
  const t = useT()

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{
      position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
      width: 220, background: 'var(--c-bg-card)', borderRadius: 12, border: '0.5px solid var(--c-border)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.10)', padding: '14px 16px', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', gap: 10, zIndex: 100,
      animation: 'advPop 0.15s ease',
    }}>
      <style>{`@keyframes advPop { from { opacity:0; transform:translateX(-50%) translateY(4px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 700, color: 'var(--c-text-primary)' }}>{t.pomodoro.advancedSettings}</span>
        <span onClick={onClose} style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--c-text-faint)', cursor: 'pointer', lineHeight: 1 }}>×</span>
      </div>
      <SettingRow label={t.pomodoro.autoBreak} sub={t.pomodoro.autoBreakSub} right={<Toggle value={s.autoBreak} onChange={v => setS(p => ({ ...p, autoBreak: v }))} />} />
      <SettingRow label={t.pomodoro.autoFocus} sub={t.pomodoro.autoFocusSub} right={<Toggle value={s.autoFocus} onChange={v => setS(p => ({ ...p, autoFocus: v }))} />} />
      <SettingRow label={t.pomodoro.longBreak} sub={t.pomodoro.longBreakSub} right={<Stepper value={s.longBreakEvery} onChange={v => setS(p => ({ ...p, longBreakEvery: v }))} min={2} max={8} />} />
      <SettingRow label={t.pomodoro.longBreakDur} sub={t.pomodoro.longBreakDurSub} right={<Stepper value={s.longBreakDur} onChange={v => setS(p => ({ ...p, longBreakDur: v }))} min={5} max={30} step={5} />} />
      <div style={{ height: '0.5px', background: 'var(--c-border)' }} />
      <div onClick={() => { onSave(s); onClose() }} style={{ height: 24, background: 'var(--c-text-primary)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <span style={{ fontFamily: 'Inter', fontSize: 9, fontWeight: 600, color: 'white' }}>{t.common.save}</span>
      </div>
    </div>
  )
}

const PencilIcon = () => (
  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3.32861 7.30267e-08C3.42779 0.0033966 3.52184 0.0476383 3.59087 0.123369C3.6599 0.1991 3.69849 0.300382 3.69849 0.405797C3.69849 0.511212 3.6599 0.612494 3.59087 0.688225C3.52184 0.763956 3.42779 0.808198 3.32861 0.811594H1.14579C1.04449 0.811706 0.947381 0.854531 0.875791 0.93066C0.804202 1.00679 0.76399 1.11 0.76399 1.2176V6.78282C0.76399 7.00669 0.934647 7.18841 1.14618 7.18841H6.38497C6.59571 7.18841 6.76677 7.00711 6.76677 6.7824V4.46356C6.76677 4.35593 6.80701 4.25272 6.87865 4.17662C6.95029 4.10051 7.04745 4.05776 7.14876 4.05776C7.25007 4.05776 7.34724 4.10051 7.41887 4.17662C7.49051 4.25272 7.53076 4.35593 7.53076 4.46356V6.7824C7.53076 7.10533 7.41 7.41503 7.19505 7.64337C6.9801 7.87172 6.68856 8 6.38457 8H1.14579C0.841868 7.99989 0.550434 7.87156 0.335569 7.64322C0.120704 7.41489 -1.82197e-08 7.10525 0 6.7824V1.21718C-9.02867e-09 1.0573 0.0296498 0.898991 0.0872557 0.751288C0.144862 0.603586 0.229295 0.469386 0.335733 0.356355C0.442172 0.243324 0.568529 0.153676 0.707588 0.0925314C0.846647 0.0313871 0.995683 -5.53062e-05 1.14618 7.30267e-08H3.32861ZM7.04141 0.0459553C7.26126 0.1079 7.46177 0.23054 7.62258 0.401424C7.7834 0.572308 7.89878 0.785351 7.95702 1.01892C8.01527 1.2525 8.01429 1.49828 7.95421 1.73133C7.89412 1.96437 7.77705 2.17638 7.6149 2.34582L4.51687 5.63689C4.3859 5.77602 4.22834 5.88311 4.0545 5.95183L3.26313 6.26424C3.10117 6.32808 2.92536 6.34119 2.7566 6.30203C2.58783 6.26287 2.43318 6.17307 2.31103 6.04331C2.18888 5.91354 2.10435 5.74927 2.06749 5.56998C2.03062 5.39069 2.04297 5.20394 2.10306 5.03188L2.39714 4.1912C2.46183 4.00653 2.56304 3.83916 2.69361 3.70003L5.79243 0.408959C5.95197 0.236793 6.15154 0.112526 6.3709 0.0487727C6.59026 -0.0149811 6.82158 -0.0159531 7.04141 0.0459553ZM6.39966 1.05444L3.30163 4.34551C3.25797 4.39188 3.22424 4.44796 3.2028 4.50951L2.90872 5.3502C2.90578 5.35836 2.90511 5.36725 2.9068 5.3758C2.90849 5.38435 2.91245 5.39221 2.91823 5.39843C2.924 5.40465 2.93134 5.40898 2.93936 5.41089C2.94739 5.41281 2.95576 5.41223 2.96349 5.40922L3.75566 5.09639C3.8132 5.07362 3.86559 5.03736 3.90925 4.99099L7.00728 1.70034C7.04904 1.65843 7.08247 1.60806 7.10559 1.55219C7.12872 1.49632 7.14106 1.43609 7.1419 1.37506C7.14274 1.31404 7.13205 1.25346 7.11047 1.1969C7.08889 1.14033 7.05685 1.08894 7.01625 1.04576C6.97565 1.00258 6.92732 0.968476 6.8741 0.945477C6.82089 0.922477 6.76387 0.911044 6.70643 0.911853C6.64898 0.912663 6.59227 0.925698 6.53965 0.950188C6.48702 0.974679 6.43956 1.01013 6.40005 1.05444H6.39966Z" fill="#B5B5B5"/>
  </svg>
)

const ColonIcon = ({ color = 'black' }: { color?: string }) => (
  <svg width="4" height="17" viewBox="0 0 4 17" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 1.99257C4 2.54771 3.80917 3.02107 3.42751 3.41264C3.04585 3.80421 2.57745 4 2.0223 4C1.45725 4 0.978935 3.80669 0.587361 3.42007C0.195787 3.03346 0 2.55762 0 1.99257C0 1.43742 0.198265 0.966542 0.594796 0.579925C0.991326 0.193308 1.46716 0 2.0223 0C2.56753 0 3.03346 0.195787 3.42007 0.587361C3.80669 0.978934 4 1.44734 4 1.99257Z" fill={color}/>
    <path d="M4 14.9926C4 15.5477 3.80917 16.0211 3.42751 16.4126C3.04585 16.8042 2.57745 17 2.0223 17C1.45725 17 0.978935 16.8067 0.587361 16.4201C0.195787 16.0335 0 15.5576 0 14.9926C0 14.4374 0.198265 13.9665 0.594796 13.5799C0.991326 13.1933 1.46716 13 2.0223 13C2.56753 13 3.03346 13.1958 3.42007 13.5874C3.80669 13.9789 4 14.4473 4 14.9926Z" fill={color}/>
  </svg>
)

const SpinnerIcon = () => (
  <svg width="7" height="9" viewBox="0 0 7 9" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3.5 9L0 5.7L0.890909 4.86L3.5 7.32L6.10909 4.86L7 5.7L3.5 9ZM3.5 1.68L0.890909 4.14L0 3.3L3.5 0L7 3.3L6.10909 4.14L3.5 1.68Z" fill="#515151"/>
  </svg>
)

const PauseIcon = () => (
  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0 8H2.66612V0H0V8ZM5.33303 8H8V0H5.33303V8Z" fill="#4C4C4C"/>
  </svg>
)

const PlayIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7.48775e-07 0.891331V9.10826C-0.000221002 9.26641 0.0488149 9.42176 0.142069 9.55835C0.235324 9.69493 0.369433 9.80782 0.530615 9.88542C0.691798 9.96302 0.87424 10.0025 1.05919 9.99988C1.24415 9.99723 1.42494 9.95252 1.58299 9.87035L9.49872 5.76122C9.65175 5.68182 9.77827 5.57004 9.86607 5.43667C9.95387 5.3033 10 5.15284 10 4.9998C10 4.84675 9.95387 4.69629 9.86607 4.56292C9.77827 4.42955 9.65175 4.31778 9.49872 4.23837L1.58221 0.129239C1.42417 0.0472423 1.24346 0.00267688 1.05862 0.000116873C0.873788 -0.00244314 0.691484 0.0370943 0.530424 0.114671C0.369363 0.192248 0.235349 0.30507 0.142134 0.441557C0.0489198 0.578044 -0.000136378 0.73328 7.48775e-07 0.891331Z" fill="#515151"/>
  </svg>
)

const ResetIcon = () => (
  <svg width="11" height="12" viewBox="0 0 11 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.4504 5.05071H5.7834L6.03828 4.79485L7.4416 3.38274C6.87293 2.85953 6.13342 2.52825 5.32149 2.52825C3.54481 2.52834 2.13789 3.98141 2.13789 5.72649C2.13789 7.51251 3.58556 8.92465 5.32149 8.92473C6.76313 8.92473 8.00656 7.8885 8.38008 6.5136L8.41035 6.40227H10.3938L10.3605 6.58001C9.91521 8.99452 7.82249 10.8768 5.27852 10.8769C2.46864 10.8769 0.149612 8.59218 0.149612 5.72649C0.149613 2.8608 2.46864 0.576101 5.27852 0.576101C6.65117 0.576143 7.89924 1.11629 8.82539 1.99407L10.1936 0.621023L10.4504 0.36321V5.05071Z" fill="#4C4C4C" stroke="#4C4C4C" strokeWidth="0.3"/>
  </svg>
)

const FOCUS_PRESETS = [15, 30, 45]
const BREAK_PRESETS = [5, 10, 15]

const TimeSelector = ({
  label, presets, value, onChange, disabled = false
}: { label: string; presets: number[]; value: number; onChange: (v: number) => void; disabled?: boolean }) => {
  const [custom, setCustom] = useState(false)
  const [customVal, setCustomVal] = useState(value)

  const handleSpinner = () => {
    setCustom(true)
    setCustomVal(value)
  }

  const handleCustomChange = (delta: number) => {
    const next = Math.max(1, customVal + delta)
    setCustomVal(next)
    onChange(next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      <span style={{ fontFamily: 'Inter', fontSize: 9, fontWeight: 500, color: 'var(--c-text-primary)' }}>{label}</span>
      <div style={{ position: 'relative', width: 104, height: 25 }}>
        <svg width="104" height="25" viewBox="0 0 81 19" fill="none" style={{ position: 'absolute', top: 0, left: 0 }}>
          <path d="M20.1 0.0499992V18.05M40.1 0.0499992V18.05M60.1 0.0499992V18.05M9.05 18.05H71.05C76.0206 18.05 80.05 14.0206 80.05 9.05C80.05 4.07944 76.0206 0.0499992 71.05 0.0499992H9.05C4.07944 0.0499992 0.05 4.07944 0.05 9.05C0.05 14.0206 4.07944 18.05 9.05 18.05Z" stroke="black" strokeWidth="0.1"/>
        </svg>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 104, height: 25, display: 'flex' }}>
          {presets.map((p) => (
            <div key={p} onClick={() => { setCustom(false); onChange(p) }} style={{
              width: 26, height: 25, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}>
              <span style={{
                fontFamily: 'Inter', fontSize: 10,
                color: !custom && value === p ? 'var(--c-text-base)' : 'var(--c-text-primary)',
                fontWeight: !custom && value === p ? 700 : 500,
              }}>{p}</span>
            </div>
          ))}
          {/* Spinner cell */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            onClick={handleSpinner}>
            {custom ? (
              <input
                autoFocus
                type="number"
                min={1}
                value={customVal}
                onClick={e => e.stopPropagation()}
                onChange={e => { const v = Math.max(1, parseInt(e.target.value) || 1); setCustomVal(v); onChange(v) }}
                onWheel={e => { e.preventDefault(); handleCustomChange(e.deltaY < 0 ? 1 : -1) }}
                onBlur={() => setCustom(false)}
                style={{
                  width: 22, height: 17, border: 'none', outline: 'none', background: 'transparent',
                  fontFamily: 'Inter', fontSize: 9, fontWeight: 600, color: 'var(--c-text-base)',
                  textAlign: 'center', padding: 0,
                  MozAppearance: 'textfield',
                } as React.CSSProperties}
              />
            ) : <SpinnerIcon />}
          </div>
        </div>
      </div>
    </div>
  )
}

const HabitItem = ({ habit, checked, onCheck, onUncheck }: { habit: { id: string; name: string; icon: string }; checked: boolean; onCheck: () => void; onUncheck: () => void }) => {
  const startX = useRef(0)
  const [offset, setOffset] = useState(0)
  const [done, setDone] = useState(checked)
  useEffect(() => { setDone(checked) }, [checked])

  const onMouseDown = (e: React.MouseEvent) => {
    if (done) return
    startX.current = e.clientX
    const onMove = (ev: MouseEvent) => {
      const dx = Math.max(0, Math.min(ev.clientX - startX.current, 80))
      setOffset(dx)
      if (dx >= 80) { setDone(true); setOffset(0); onCheck(); cleanup() }
    }
    const onUp = () => { setOffset(0); cleanup() }
    const cleanup = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div onDoubleClick={() => { if (done) { setDone(false); onUncheck() } }}
      style={{ background: 'var(--c-bg-card)', borderRadius: 10, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', flexShrink: 0, cursor: done ? 'pointer' : 'default' }}>
      <div onMouseDown={onMouseDown} style={{
        width: 28, height: 28, flexShrink: 0, cursor: done ? 'default' : 'grab',
        transform: `translateX(${offset}px)`, transition: offset === 0 ? 'transform 0.2s' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        filter: done ? 'grayscale(0.4) opacity(0.5)' : 'none',
      }}>
        <img src={`/habits/${habit.icon}.png`} style={{ width: 24, height: 24, objectFit: 'contain' }} />
      </div>
      <span style={{ fontFamily: 'Inter', fontSize: 9, fontWeight: 500, color: done ? 'var(--c-text-faint)' : 'var(--c-text-primary)', textDecoration: done ? 'line-through' : 'none', flex: 1 }}>{habit.name}</span>
    </div>
  )
}

// Generate last N days as YYYY-MM-DD strings (called at render time, not module load)
const lastNDays = (n: number) => Array.from({ length: n }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - (n - 1 - i)); return d.toISOString().slice(0, 10)
})

const PAGE_SIZE = 5
const MAX_HABITS = 100

const DAYS_SHORT = ['M','T','W','T','F','S','S']

const DeleteConfirmModal = ({ habitName, onConfirm, onCancel }: { habitName: string; onConfirm: () => void; onCancel: () => void }) => {
  const t = useT()
  return (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
    onClick={onCancel}>
    <div onClick={e => e.stopPropagation()} style={{
      width: 320, background: 'var(--c-bg-card)', borderRadius: 14, border: '0.5px solid var(--c-border)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: '20px 22px',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <span style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 700, color: 'var(--c-text-primary)' }}>{t.common.delete} Habit</span>
      <span style={{ fontFamily: 'Inter', fontSize: 10, color: 'var(--c-text-secondary)', lineHeight: 1.6 }}>
        Are you sure you want to delete <b>{habitName}</b>?<br />
        All check-in records will be permanently removed.
      </span>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
        <div onClick={onCancel} style={{ height: 28, padding: '0 14px', borderRadius: 7, background: 'var(--c-bg-muted)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <span style={{ fontFamily: 'Inter', fontSize: 9, fontWeight: 600, color: 'var(--c-text-muted)' }}>{t.common.cancel}</span>
        </div>
        <div onClick={onConfirm} style={{ height: 28, padding: '0 14px', borderRadius: 7, background: '#e81123', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <span style={{ fontFamily: 'Inter', fontSize: 9, fontWeight: 600, color: 'white' }}>{t.common.delete}</span>
        </div>
      </div>
    </div>
  </div>
  )
}

const EditHabitModal = ({ habit, onClose }: { habit: { id: string; name: string; days: number[]; time?: string; reminder: boolean }; onClose: () => void }) => {
  const { updateHabit } = useScheduleStore()
  const t = useT()
  const initDays = (habit.days.length === 0 || habit.days.length === 7) ? [0,1,2,3,4,5,6] : habit.days
  const [days, setDays] = useState<number[]>(initDays)
  const [time, setTime] = useState(habit.time ?? '07:00')
  const [reminder, setReminder] = useState(habit.reminder)
  const toggleDay = (i: number) => setDays(d => d.includes(i) ? d.filter(x => x !== i) : [...d, i].sort((a,b) => a-b))
  const allSelected = days.length === 7
  const toggleAll = () => setDays(allSelected ? [] : [0,1,2,3,4,5,6])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 320, background: 'var(--c-bg-card)', borderRadius: 14, border: '0.5px solid var(--c-border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: '20px 22px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <span onClick={onClose} style={{ fontFamily: 'Inter', fontSize: 16, color: 'var(--c-text-faint)', cursor: 'pointer' }}>×</span>
        </div>
        {/* Time */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'Inter', fontSize: 8, fontWeight: 600, color: 'var(--c-text-primary)' }}>Time</span>
          <input type="time" value={time} onChange={e => setTime(e.target.value)}
            style={{ height: 28, border: '0.5px solid var(--c-border)', borderRadius: 8, padding: '0 10px', fontFamily: 'Inter', fontSize: 10, color: 'var(--c-text-base)', outline: 'none', background: 'var(--c-bg-input)' }} />
        </div>
        {/* Repeat */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontFamily: 'Inter', fontSize: 8, fontWeight: 600, color: 'var(--c-text-primary)' }}>{t.habits.repeat}</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {DAYS_SHORT.map((d, i) => (
              <div key={i} onClick={() => toggleDay(i)} style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: days.includes(i) ? 'var(--c-text-primary)' : 'var(--c-bg-muted)', cursor: 'pointer',
                fontFamily: 'Inter', fontSize: 8, fontWeight: 600, color: days.includes(i) ? 'white' : 'var(--c-text-muted)',
              }}>{d}</div>
            ))}
            <div onClick={toggleAll} style={{
              height: 28, padding: '0 10px', borderRadius: 14, display: 'flex', alignItems: 'center',
              background: allSelected ? 'var(--c-text-primary)' : 'var(--c-bg-muted)', cursor: 'pointer',
              fontFamily: 'Inter', fontSize: 8, fontWeight: 600, color: allSelected ? 'white' : 'var(--c-text-muted)',
            }}>{t.habits.every}</div>
          </div>
        </div>
        {/* Reminder */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'Inter', fontSize: 8, fontWeight: 600, color: 'var(--c-text-primary)' }}>{t.habits.reminder}</span>
          <div onClick={() => setReminder(r => !r)} style={{ width: 28, height: 16, borderRadius: 8, background: reminder ? '#83B5B5' : 'var(--c-border)', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.18s' }}>
            <div style={{ position: 'absolute', top: 2, left: reminder ? 14 : 2, width: 12, height: 12, borderRadius: '50%', background: 'white', transition: 'left 0.18s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
          </div>
        </div>
        <div style={{ height: '0.5px', background: 'var(--c-border)' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <div onClick={onClose} style={{ height: 28, padding: '0 14px', borderRadius: 7, background: 'var(--c-bg-muted)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <span style={{ fontFamily: 'Inter', fontSize: 9, fontWeight: 600, color: 'var(--c-text-muted)' }}>{t.common.cancel}</span>
          </div>
          <div onClick={async () => { await updateHabit(habit.id, days, reminder ? time : undefined, time); onClose() }}
            style={{ height: 28, padding: '0 14px', borderRadius: 7, background: 'var(--c-text-primary)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <span style={{ fontFamily: 'Inter', fontSize: 9, fontWeight: 600, color: 'white' }}>{t.common.save}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const TrackerView = ({ habits, checkedHabits }: { habits: { id: string; name: string; icon: string; color?: string; days: number[]; reminder: boolean; time?: string }[]; checkedHabits: Record<string, string[]> }) => {
  const { deleteHabit } = useScheduleStore()
  const { theme } = useThemeStore()
  const t = useT()
  const [page, setPage] = useState(0)
  const [editingHabit, setEditingHabit] = useState<typeof habits[0] | null>(null)
  const [deletingHabit, setDeletingHabit] = useState<typeof habits[0] | null>(null)
  const capped = habits.slice(0, MAX_HABITS)
  const totalPages = Math.ceil(capped.length / PAGE_SIZE)
  const pageHabits = capped.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  if (capped.length === 0) return (
    <div style={{ fontFamily: 'Inter', fontSize: 9, color: 'var(--c-text-faint)', padding: '8px 0' }}>No habits yet. Click Add Habits to get started.</div>
  )
  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pageHabits.map(h => {
          const checked = new Set(checkedHabits[h.id] ?? [])
          const total = checked.size
          const activeDays = (h.days.length === 0 || h.days.length === 7) ? [0,1,2,3,4,5,6] : h.days
          return (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Icon + name */}
              <div style={{ width: 66, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--c-bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={`/habits/${h.icon}.png`} style={{ width: 42, height: 42, objectFit: 'contain' }} />
                </div>
                <span style={{ fontFamily: 'Inter', fontSize: 9, fontWeight: 500, color: 'var(--c-text-primary)', textAlign: 'center', lineHeight: 1.2 }}>{h.name}</span>
              </div>
              {/* Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 8px)', gridTemplateRows: 'repeat(5, 8px)', gap: 5, flexShrink: 0 }}>
                {Array.from({ length: 120 }, (_, i) => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: 2, background: i < total ? (h.color ?? '#83B5B5') : 'var(--c-border)', transition: 'background 0.15s' }} />
                ))}
              </div>
              {/* Stats box */}
              <div style={{ width: 200, height: 100, background: 'var(--c-bg-subtle)', borderRadius: 10, border: '0.5px solid var(--c-border)', flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 12px', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'Inter', fontSize: 10, color: 'var(--c-text-faint)' }}>Total</span>
                  <span style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 600, color: 'var(--c-text-primary)' }}>{total}d</span>
                </div>
                {/* Days row */}
                <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginTop: 2 }}>
                  {DAYS_SHORT.map((d, i) => {
                    const active = activeDays.includes(i)
                    return (
                      <div key={i} style={{
                        width: 14, height: 14, borderRadius: '50%',
                        border: `1px solid ${active ? 'var(--c-text-primary)' : 'var(--c-border)'}`,
                        background: active ? 'var(--c-text-primary)' : (theme === 'dark' ? '#fff' : 'var(--c-bg-card)'),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontFamily: 'Inter', fontSize: 7, fontWeight: 700, color: active ? 'white' : (theme === 'dark' ? '#000' : 'var(--c-text-xfaint)') }}>{d}</span>
                      </div>
                    )
                  })}
                </div>
                {/* Edit / Delete */}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, marginTop: 4 }}>
                  <div onClick={() => setEditingHabit(h)} style={{ flex: 1, height: 14, borderRadius: 4, background: 'var(--c-bg-card)', border: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <span style={{ fontFamily: 'Inter', fontSize: 7, fontWeight: 600, color: 'var(--c-text-primary)' }}>{t.common.edit}</span>
                  </div>
                  <div onClick={() => setDeletingHabit(h)} style={{ flex: 1, height: 14, borderRadius: 4, background: 'var(--c-bg-card)', border: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <span style={{ fontFamily: 'Inter', fontSize: 7, fontWeight: 600, color: 'var(--c-text-primary)' }}>{t.common.delete}</span>
                  </div>
                </div>
              </div>
              {/* Awards */}
              <div style={{ width: 180, flexShrink: 0, borderTop: '0.5px solid var(--c-border)', borderBottom: '0.5px solid var(--c-border)', height: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 4px' }}>
                {[
                  { threshold: 7,   src: '/award/奖牌.png',  label: 'Medal' },
                  { threshold: 30,  src: '/award/奖杯.png',  label: 'Trophy' },
                  { threshold: 120, src: '/award/王冠.png',  label: 'Crown' },
                ].map(({ threshold, src, label }) => {
                  const earned = total >= threshold
                  return (
                    <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, opacity: earned ? 1 : 0.2 }}>
                      <img src={src} style={{ width: 30, height: 30, objectFit: 'contain' }} />
                      <span style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 600, color: earned ? 'var(--c-text-primary)' : 'var(--c-text-faint)' }}>{label}</span>
                      <span style={{ fontFamily: 'Inter', fontSize: 9, color: 'var(--c-text-faint)' }}>{threshold}d</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 6, flexShrink: 0 }}>
          <div onClick={() => setPage(p => Math.max(0, p - 1))} style={{ width: 20, height: 20, borderRadius: 5, background: page === 0 ? 'var(--c-bg-muted)' : 'var(--c-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: page === 0 ? 'default' : 'pointer' }}>
            <span style={{ fontFamily: 'Inter', fontSize: 10, color: page === 0 ? 'var(--c-text-faint)' : 'white' }}>‹</span>
          </div>
          {Array.from({ length: totalPages }, (_, i) => (
            <div key={i} onClick={() => setPage(i)} style={{ width: 6, height: 6, borderRadius: '50%', background: page === i ? 'var(--c-text-primary)' : 'var(--c-border)', cursor: 'pointer', transition: 'background 0.15s' }} />
          ))}
          <div onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} style={{ width: 20, height: 20, borderRadius: 5, background: page === totalPages - 1 ? 'var(--c-bg-muted)' : 'var(--c-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: page === totalPages - 1 ? 'default' : 'pointer' }}>
            <span style={{ fontFamily: 'Inter', fontSize: 10, color: page === totalPages - 1 ? 'var(--c-text-faint)' : 'white' }}>›</span>
          </div>
        </div>
      )}
    </div>
    {editingHabit && <EditHabitModal habit={editingHabit} onClose={() => setEditingHabit(null)} />}
    {deletingHabit && (
      <DeleteConfirmModal
        habitName={deletingHabit.name}
        onConfirm={async () => { await deleteHabit(deletingHabit.id); setDeletingHabit(null) }}
        onCancel={() => setDeletingHabit(null)}
      />
    )}
    </>
  )
}

export const PomodoroPage = () => {
  const { events, habits, checkedHabits, checkHabit, uncheckHabit, doneTaskIds, toggleTaskDone, todayStr } = useScheduleStore()
  const { theme } = useThemeStore()
  const t = useT()
  const isDark = theme === 'dark'
  const {
    sessions: history, addSession,
    running, isFocus, focusMin, breakMin,
    taskName, advSettings, finished,
    setTaskName, setFocusMin, setBreakMin, setAdvSettings,
    playPause, reset,
  } = usePomodoroStore()

  const todayEvents = events.filter(e => e.date === todayStr)
  const todayDow = (new Date().getDay() + 6) % 7
  const todayHabits = habits.filter(h => h.days.length === 0 || h.days.includes(todayDow))
  const [editing, setEditing] = useState(false)
  const [selectedTask, setSelectedTask] = useState<string | null>(null)
  const [showAdv, setShowAdv] = useState(false)
  const [showHabits, setShowHabits] = useState(false)
  const [bottomTab, setBottomTab] = useState<'Tracker'|'Task Breakdown'|'Statistics'>('Tracker')
  const [historyView, setHistoryView] = useState<'Daily'|'Weekly'|'Monthly'>('Daily')
  const [breakdown, setBreakdown] = useState<Record<string, { id: string; name: string; icon: string; note: string; done: boolean }[]>>({})
  const breakdownLoadedRef = useRef(false)

  // Load breakdown from backend on mount
  useEffect(() => {
    apiFetch('/settings/')
      .then(r => r.json())
      .then(data => {
        if (data.task_breakdown) {
          try { setBreakdown(JSON.parse(data.task_breakdown)) } catch {}
        }
        breakdownLoadedRef.current = true
      })
      .catch(() => { breakdownLoadedRef.current = true })
  }, [])

  // Save breakdown to backend whenever it changes (debounced).
  // Guard: skip the initial empty-state write before load completes.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!breakdownLoadedRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      apiFetch('/settings/', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { task_breakdown: JSON.stringify(breakdown) } }),
      }).catch(() => {})
    }, 500)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [breakdown])

  // Display seconds — derived from store, updated via rAF (UI only)
  const [displaySecs, setDisplaySecs] = useState<number>(() =>
    usePomodoroStore.getState().getSecondsLeft()
  )
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const loop = () => {
      setDisplaySecs(usePomodoroStore.getState().getSecondsLeft())
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  const secs = displaySecs
  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')

  const handlePlayPause = () => playPause()
  const handleReset = () => reset()

  const status = finished ? 'Finished' : running ? (isFocus ? 'Focusing' : 'Relaxing') : null

  return (
    <><div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '8px 10px', gap: 8, boxSizing: 'border-box', overflow: 'hidden' }}>
      {/* Main row: D + right column */}
      <div style={{ display: 'flex', gap: 10 }}>
      {/* Container D */}
      <div style={{
        width: 255, flexShrink: 0, alignSelf: 'flex-start', background: 'var(--c-bg-subtle)', borderRadius: 17,
        border: '0.5px solid var(--c-border)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', padding: '10px 14px 10px', boxSizing: 'border-box', gap: 6,
      }}>
        {/* Task name label */}
        <div style={{ width: 128, height: 23, background: 'var(--c-bg-card)', borderRadius: 10, border: '0.5px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer' }}
          onClick={() => setEditing(true)}>
          {editing ? (
            <input autoFocus value={taskName} onChange={e => setTaskName(e.target.value)} onBlur={() => setEditing(false)} onKeyDown={e => e.key === 'Enter' && setEditing(false)}
              style={{ border: 'none', outline: 'none', background: 'transparent', fontFamily: 'Inter', fontSize: 10, fontWeight: 500, color: 'var(--c-text-primary)', width: 94, textAlign: 'center' }} />
          ) : (
            <span style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 500, color: 'var(--c-text-primary)', maxWidth: 94, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{taskName}</span>
          )}
          <PencilIcon />
        </div>

        {/* Dial */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={isDark ? '/pomodoro-dial-dark.png' : '/pomodoro-dial.png'} style={{ width: 227, height: 227, objectFit: 'contain' }} />
          <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontFamily: "'Londrina Outline', cursive", fontSize: 64, fontWeight: 400, color: 'var(--c-text-base)', lineHeight: 1 }}>{mm}</span>
              <ColonIcon color={isDark ? 'white' : 'black'} />
              <span style={{ fontFamily: "'Londrina Outline', cursive", fontSize: 64, fontWeight: 400, color: 'var(--c-text-base)', lineHeight: 1 }}>{ss}</span>
            </div>
            {status && <span style={{ fontFamily: 'Inter', fontSize: 18, fontWeight: 800, color: 'var(--c-text-primary)', letterSpacing: '0.48px' }}>{status}</span>}
          </div>
        </div>

        {/* Time selectors */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <TimeSelector label={t.pomodoro.focus} presets={FOCUS_PRESETS} value={focusMin} onChange={v => { if (!running) setFocusMin(v) }} disabled={running} />
          <TimeSelector label={t.pomodoro.break} presets={BREAK_PRESETS} value={breakMin} onChange={v => { if (!running) setBreakMin(v) }} disabled={running} />
        </div>

        {/* Advanced settings */}
        <div style={{ position: 'relative' }}>
          <div onClick={() => setShowAdv(p => !p)} style={{ width: 85, height: 17, background: 'var(--c-text-secondary)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <span style={{ fontFamily: 'Inter', fontSize: 8, fontWeight: 600, color: 'white' }}>{t.pomodoro.advancedSettings}</span>
          </div>
          {showAdv && <AdvancedSettingsPopup onClose={() => setShowAdv(false)} onSave={s => setAdvSettings(s)} />}
        </div>

        {/* Action buttons */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 19, alignItems: 'center' }}>
          <div onClick={handlePlayPause} style={{ width: 36, height: 36, borderRadius: '50%', background: '#D9D9D9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            {running ? <PauseIcon /> : <PlayIcon />}
          </div>
          <div onClick={handleReset} style={{ width: 36, height: 36, borderRadius: '50%', background: '#D9D9D9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ResetIcon />
          </div>
        </div>
        </div>
      </div>

      {/* Right column: E + F */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, alignSelf: 'stretch' }}>
        <div style={{ display: 'flex', gap: 10, flex: '1 1 0', minHeight: 0 }}>
        {/* Container E — Today's Tasks */}
        <div style={{ flex: 6, background: 'var(--c-bg-subtle)', borderRadius: 15, border: '0.5px solid var(--c-border)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 6px' }}>
            <span style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 700, color: 'var(--c-text-primary)' }}>{t.pomodoro.todayTasks}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'Inter', fontSize: 8, fontWeight: 400, color: 'var(--c-text-muted)' }}>{todayEvents.length} tasks</span>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {todayEvents.map(ev => {
              const active = selectedTask === ev.id
              const done = doneTaskIds.includes(ev.id)
              return (
                <div key={ev.id} onClick={() => { setSelectedTask(ev.id); setTaskName(ev.title) }} style={{
                  height: 20, display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
                  borderLeft: active ? `2px solid ${ev.color}` : '2px solid transparent', paddingLeft: 4,
                }}>
                  <div onClick={e => { e.stopPropagation(); toggleTaskDone(ev.id) }} style={{
                    width: 9, height: 9, borderRadius: 2, flexShrink: 0, border: `1px solid ${ev.color}`,
                    background: done ? ev.color : 'transparent', cursor: 'pointer',
                  }} />
                  <span style={{ fontFamily: 'Inter', fontSize: 9, fontWeight: 500, color: done ? 'var(--c-text-faint)' : 'var(--c-text-base)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: done ? 'line-through' : 'none' }}>{ev.title}</span>
                  <span style={{ fontFamily: 'Inter', fontSize: 8, color: 'var(--c-text-faint)' }}>{ev.startTime}</span>
                  {active && <span style={{ fontSize: 8, color: ev.color }}>●</span>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Container G */}
        <div style={{ flex: 4, background: 'var(--c-bg-subtle)', borderRadius: 15, border: '0.5px solid var(--c-border)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px 6px', flexShrink: 0 }}>
            <span style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 700, color: 'var(--c-text-primary)' }}>{t.pomodoro.todayHabits}</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, padding: '0 10px 10px' }}>
            {todayHabits.length === 0 ? (
              <span style={{ fontFamily: 'Inter', fontSize: 9, color: 'var(--c-text-faint)', padding: '4px 0' }}>{t.pomodoro.noHabitsToday}</span>
            ) : todayHabits.map(h => (
              <HabitItem key={h.id} habit={h} checked={(checkedHabits[h.id] ?? []).includes(todayStr)} onCheck={() => checkHabit(h.id, todayStr)} onUncheck={() => uncheckHabit(h.id, todayStr)} />
            ))}
          </div>
        </div>
        </div>{/* end E+G row */}

        {/* Container F — Focus History */}
        <div style={{ width: '100%', flex: '1 1 0', minHeight: 0, background: 'var(--c-bg-subtle)', borderRadius: 15, border: '0.5px solid var(--c-border)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px 4px', flexShrink: 0 }}>
            <span style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 700, color: 'var(--c-text-primary)' }}>{t.pomodoro.focusHistory}</span>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
          {/* Vertical view switcher */}
          {(() => {
            const views: { key: 'Daily'|'Weekly'|'Monthly'; label: string }[] = [
              { key: 'Daily', label: t.pomodoro.daily },
              { key: 'Weekly', label: t.pomodoro.weekly },
              { key: 'Monthly', label: t.schedule.monthly },
            ]
            const idx = views.findIndex(v => v.key === historyView)
            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px', alignSelf: 'stretch' }}>
                <div style={{
                  position: 'relative', width: 46, height: 84, background: 'var(--c-bg-muted)', borderRadius: 8,
                  border: '0.5px solid var(--c-border)', display: 'flex', flexDirection: 'column',
                  padding: '2px', boxSizing: 'border-box',
                }}>
                  {/* sliding pill */}
                  <div style={{
                    position: 'absolute', left: 2, right: 2,
                    height: 'calc(33.333% - 2.67px)',
                    top: `calc(${idx * 33.333}% + 2px)`,
                    background: 'var(--c-text-primary)', borderRadius: 6,
                    transition: 'top 0.22s cubic-bezier(0.4,0,0.2,1)',
                    pointerEvents: 'none',
                  }} />
                  {views.map(v => (
                    <div key={v.key} onClick={() => setHistoryView(v.key)} style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', position: 'relative', zIndex: 1,
                    }}>
                      <span style={{
                        fontFamily: 'Inter', fontSize: 7, fontWeight: 600,
                        color: historyView === v.key ? 'var(--c-bg-page)' : 'var(--c-text-muted)',
                        transition: 'color 0.22s',
                      }}>{v.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
          {/* Content */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {(() => {
            const now = new Date()
            const filtered = history.filter(h => {
              const d = new Date(h.date)
              if (historyView === 'Daily') return h.date === todayStr
              if (historyView === 'Weekly') {
                const dow = now.getDay()
                const monday = new Date(now); monday.setDate(now.getDate() - ((dow + 6) % 7)); monday.setHours(0,0,0,0)
                const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23,59,59,999)
                return d >= monday && d <= sunday
              }
              return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
            })
            if (filtered.length === 0) return (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'Inter', fontSize: 9, fontWeight: 400, color: 'var(--c-text-faint)' }}>No focus sessions yet. Start one!</span>
              </div>
            )
            const totalMins = filtered.reduce((s, h) => s + h.mins, 0)
            const COLORS = ['#83B5B5','#F9CE9C','#C1D09D','#BFC5D5','#9BB8AF','#AEC8A3','#8F9CB3','#E8BFB3','#F3D8C8','#D4CDC0']
            const grouped: Record<string, number> = {}
            filtered.forEach(h => { grouped[h.task] = (grouped[h.task] || 0) + h.mins })
            const entries = Object.entries(grouped)
            const R = 70, CX = 87, CY = 87, STROKE = 22
            const circ = 2 * Math.PI * R
            let offset = 0
            const arcs = entries.map(([task, mins], i) => {
              const dash = (mins / totalMins) * circ
              const arc = { task, mins, color: COLORS[i % COLORS.length], dasharray: `${dash} ${circ - dash}`, dashoffset: circ / 4 - offset }
              offset += dash
              return arc
            })
            return (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 14px 14px', gap: 12 }}>
                {/* Donut */}
                <div style={{ position: 'relative', flexShrink: 0, alignSelf: 'center' }}>
                  <svg width="157" height="157" viewBox="0 0 174 174">
                    <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--c-border)" strokeWidth={STROKE} />
                    {arcs.map((a, i) => (
                      <circle key={i} cx={CX} cy={CY} r={R} fill="none"
                        stroke={a.color} strokeWidth={STROKE}
                        strokeDasharray={a.dasharray}
                        strokeDashoffset={a.dashoffset}
                        strokeLinecap="butt"
                      />
                    ))}
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: "'Londrina Outline', cursive", fontSize: 40, fontWeight: 400, color: 'var(--c-text-base)', lineHeight: 1 }}>{totalMins}</span>
                    <span style={{ fontFamily: 'Inter', fontSize: 7, fontWeight: 500, color: 'var(--c-text-muted)', marginTop: 1 }}>min</span>
                  </div>
                </div>
                {/* Bars */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, overflow: 'hidden' }}>
                  {entries.map(([task, mins], i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontFamily: 'Inter', fontSize: 9, fontWeight: 500, color: 'var(--c-text-base)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{task}</span>
                        <span style={{ fontFamily: 'Inter', fontSize: 8, fontWeight: 600, color: COLORS[i % COLORS.length], flexShrink: 0 }}>{mins}m</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: 'var(--c-bg-muted)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: COLORS[i % COLORS.length], width: `${(mins / totalMins) * 100}%`, transition: 'width 0.3s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
          </div>{/* end content */}
          </div>{/* end row */}
        </div>{/* end Container F */}
      </div>{/* end right column */}
      </div>{/* end main row */}

      {/* Bottom tab bar */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
        {([
          { key: 'Tracker' as const, label: t.pomodoro.tracker },
          { key: 'Task Breakdown' as const, label: t.pomodoro.taskBreakdown },
          { key: 'Statistics' as const, label: t.pomodoro.statistics },
        ]).map(tab => (
          <div key={tab.key} onClick={() => setBottomTab(tab.key)} style={{
            height: 26, padding: '0 14px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: bottomTab === tab.key ? 'var(--c-text-primary)' : 'var(--c-bg-muted)',
            border: '0.5px solid var(--c-border)',
            cursor: 'pointer', transition: 'background 0.18s',
          }}>
            <span style={{ fontFamily: 'Inter', fontSize: 9, fontWeight: 600, color: bottomTab === tab.key ? 'var(--c-bg-page)' : 'var(--c-text-muted)', transition: 'color 0.18s' }}>{tab.label}</span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div onClick={() => setShowHabits(true)} style={{ width: 86, height: 24, background: 'var(--c-text-primary)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer' }}>
          <PlusCircleIcon color="var(--c-bg-page)" size={8} />
          <span style={{ fontFamily: 'Inter', fontSize: 8, fontWeight: 600, color: 'var(--c-bg-page)', letterSpacing: '0.32px' }}>{t.pomodoro.addHabits}</span>
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, display: bottomTab === 'Tracker' ? 'flex' : 'none', flexDirection: 'column' }}>
        <TrackerView habits={habits} checkedHabits={checkedHabits} />
      </div>
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, display: bottomTab === 'Task Breakdown' ? 'flex' : 'none', flexDirection: 'column' }}>
        <TaskBreakdownView habits={habits} breakdown={breakdown} setBreakdown={setBreakdown} />
      </div>
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, display: bottomTab === 'Statistics' ? 'flex' : 'none', flexDirection: 'column' }}>
        <StatisticsView sessions={history} />
      </div>
    </div>
    {showHabits && <AddHabitsModal onClose={() => setShowHabits(false)} />}
    </>
  )
}
