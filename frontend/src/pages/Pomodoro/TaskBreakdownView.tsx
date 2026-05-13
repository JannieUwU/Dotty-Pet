import { useState, useEffect } from 'react'
import type React from 'react'
import { useT } from '../../i18n'

const TAG_ICONS = [
  '中心动态发布','会议管理','信息','公文交换','出差审批','固定资产',
  '工作汇报','常用资源','标签','知识产权','综合审批','通知发布','锤子','非正式文登记','靶子',
]

interface SubTask { id: string; name: string; icon: string; note: string; done: boolean }
interface BreakdownData { [habitId: string]: SubTask[] }

const COLS = 4
const ROW_H = 100
const NODE_R = 18

// Returns node positions only (no path beyond first/last node)
function buildSnake(n: number, W: number, startY: number) {
  if (n === 0) return { segments: [], pts: [] }

  const margin = 60
  const runW = W - margin * 2
  const colW = runW / (COLS - 1)
  const rows = Math.ceil(n / COLS)

  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / COLS)
    const col = i % COLS
    const x = row % 2 === 0 ? margin + col * colW : margin + (COLS - 1 - col) * colW
    pts.push({ x, y: startY + row * ROW_H })
  }

  // Build segments: node-to-node paths (for per-segment coloring)
  // Each segment i connects pts[i] to pts[i+1]
  const segments: string[] = []
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    const rowA = Math.floor(i / COLS), rowB = Math.floor((i + 1) / COLS)
    if (rowA === rowB) {
      // Same row: straight line
      segments.push(`M ${a.x} ${a.y} L ${b.x} ${b.y}`)
    } else {
      // Cross-row: go to row end, arc, come to next node
      const goRight = rowA % 2 === 0
      const xEnd = goRight ? margin + runW : margin
      const yNext = a.y + ROW_H
      const sweep = goRight ? 1 : 0
      segments.push(`M ${a.x} ${a.y} L ${xEnd} ${a.y} A ${ROW_H / 2} ${ROW_H / 2} 0 0 ${sweep} ${xEnd} ${yNext} L ${b.x} ${b.y}`)
    }
  }

  return { segments, pts }
}

const IconPicker = ({ selected, color, onSelect }: { selected: string; color: string; onSelect: (ic: string) => void }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
    {TAG_ICONS.map(ic => (
      <div key={ic} onClick={() => onSelect(ic)} style={{ aspectRatio: '1', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: selected === ic ? color + '22' : 'var(--c-bg-subtle)', border: selected === ic ? `1.5px solid ${color}` : '1px solid var(--c-border)' }}>
        <img src={`/tags/${ic}.png`} style={{ width: 20, height: 20, objectFit: 'contain' }} />
      </div>
    ))}
  </div>
)

interface EditModalProps {
  task: SubTask; color: string; index: number; total: number
  onSave: (t: SubTask) => void; onDelete: () => void
  onInsertBefore: () => void; onInsertAfter: () => void; onClose: () => void
}
const EditModal = ({ task, color, index, total, onSave, onDelete, onInsertBefore, onInsertAfter, onClose }: EditModalProps) => {
  const [name, setName] = useState(task.name)
  const [icon, setIcon] = useState(task.icon)
  const [note, setNote] = useState(task.note)
  const [done, setDone] = useState(task.done)
  const t = useT()
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--c-bg-card)', borderRadius: 14, padding: '18px 20px', width: 300, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
        <span style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 700, color: 'var(--c-text-primary)' }}>{t.pomodoro.editSubTask}</span>

        <input value={name} onChange={e => setName(e.target.value)} placeholder={t.pomodoro.namePlaceholder}
          style={{ height: 30, border: '0.5px solid var(--c-border)', borderRadius: 7, padding: '0 10px', fontFamily: 'Inter', fontSize: 10, outline: 'none', background: 'var(--c-bg-input)', color: 'var(--c-text-base)' }} />

        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder={t.pomodoro.notePlaceholder}
          style={{ height: 52, border: '0.5px solid var(--c-border)', borderRadius: 7, padding: '6px 10px', fontFamily: 'Inter', fontSize: 10, outline: 'none', resize: 'none', background: 'var(--c-bg-input)', color: 'var(--c-text-base)' }} />

        <div>
          <div style={{ fontFamily: 'Inter', fontSize: 8, fontWeight: 600, color: 'var(--c-text-muted)', marginBottom: 6 }}>{t.pomodoro.icon}</div>
          <IconPicker selected={icon} color={color} onSelect={setIcon} />
        </div>

        <div onClick={() => setDone(d => !d)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${done ? color : 'var(--c-border)'}`, background: done ? color : 'var(--c-bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {done && <span style={{ color: 'white', fontSize: 10, lineHeight: 1 }}>✓</span>}
          </div>
          <span style={{ fontFamily: 'Inter', fontSize: 9, color: 'var(--c-text-primary)' }}>{t.pomodoro.markAsDone}</span>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {index > 0 && (
            <div onClick={onInsertBefore} style={{ flex: 1, height: 26, borderRadius: 6, background: 'var(--c-bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <span style={{ fontFamily: 'Inter', fontSize: 8, color: 'var(--c-text-muted)' }}>{t.pomodoro.insertBefore}</span>
            </div>
          )}
          {index < total - 1 && (
            <div onClick={onInsertAfter} style={{ flex: 1, height: 26, borderRadius: 6, background: 'var(--c-bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <span style={{ fontFamily: 'Inter', fontSize: 8, color: 'var(--c-text-muted)' }}>{t.pomodoro.insertAfter}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
          <div onClick={onDelete} style={{ height: 28, padding: '0 14px', borderRadius: 7, background: '#fff0f0', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <span style={{ fontFamily: 'Inter', fontSize: 9, color: '#ff6b6b' }}>{t.common.delete}</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div onClick={onClose} style={{ height: 28, padding: '0 14px', borderRadius: 7, background: 'var(--c-bg-muted)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <span style={{ fontFamily: 'Inter', fontSize: 9, color: 'var(--c-text-muted)' }}>{t.common.cancel}</span>
            </div>
            <div onClick={() => { if (name.trim()) { onSave({ ...task, name: name.trim(), icon, note, done }); onClose() } }}
              style={{ height: 28, padding: '0 14px', borderRadius: 7, background: 'var(--c-text-primary)', display: 'flex', alignItems: 'center', cursor: 'pointer', opacity: name.trim() ? 1 : 0.4 }}>
              <span style={{ fontFamily: 'Inter', fontSize: 9, fontWeight: 600, color: 'white' }}>{t.common.save}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const TaskBreakdownView = ({ habits, breakdown, setBreakdown }: {
  habits: { id: string; name: string; icon: string; color?: string }[]
  breakdown: BreakdownData
  setBreakdown: React.Dispatch<React.SetStateAction<BreakdownData>>
}) => {
  const [selectedHabit, setSelectedHabit] = useState(habits[0]?.id ?? '')
  const [page, setPage] = useState(0)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const t = useT()

  // Keep selectedHabit valid: if the selected habit was deleted or habits
  // list changed, fall back to the first available habit.
  useEffect(() => {
    if (habits.length === 0) {
      setSelectedHabit('')
      return
    }
    if (!habits.find(h => h.id === selectedHabit)) {
      setSelectedHabit(habits[0].id)
    }
  }, [habits])

  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const newTask = (): SubTask => ({ id: uid(), name: t.pomodoro.newTask, icon: TAG_ICONS[0], note: '', done: false })

  const ICONS_PER_PAGE = 20
  const totalPages = Math.ceil(habits.length / ICONS_PER_PAGE)
  const pageHabits = habits.slice(page * ICONS_PER_PAGE, (page + 1) * ICONS_PER_PAGE)
  const habit = habits.find(h => h.id === selectedHabit)
  const color = habit?.color ?? '#83B5B5'
  const tasks: SubTask[] = breakdown[selectedHabit] ?? []

  const setTasks = (fn: (t: SubTask[]) => SubTask[]) => {
    if (!selectedHabit) return
    setBreakdown(b => ({ ...b, [selectedHabit]: fn(b[selectedHabit] ?? []) }))
  }

  const addTask = (name: string, icon: string) =>
    setTasks(t => [...t, { id: uid(), name, icon, note: '', done: false }])

  const W = 500, n = tasks.length
  const svgH = Math.max(160, Math.ceil(n / COLS) * ROW_H + 60)
  const { segments, pts } = buildSnake(n, W, 50)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
      {/* Habit selector */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flexShrink: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 6, flex: 1 }}>
          {pageHabits.map(h => {
            const sel = h.id === selectedHabit
            return (
              <div key={h.id} onClick={() => setSelectedHabit(h.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: sel ? (h.color ?? '#83B5B5') + '22' : 'var(--c-bg-muted)', border: sel ? `2px solid ${h.color ?? '#83B5B5'}` : '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                  <img src={`/habits/${h.icon}.png`} style={{ width: 32, height: 32, objectFit: 'contain' }} />
                </div>
                <span style={{ fontFamily: 'Inter', fontSize: 8, fontWeight: 500, color: sel ? 'var(--c-text-primary)' : 'var(--c-text-muted)', textAlign: 'center', maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
              </div>
            )
          })}
        </div>
        {totalPages > 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div onClick={() => setPage(p => Math.max(0, p - 1))} style={{ width: 20, height: 20, borderRadius: 4, background: page === 0 ? 'var(--c-bg-muted)' : 'var(--c-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: page === 0 ? 'default' : 'pointer' }}>
              <span style={{ fontSize: 10, color: page === 0 ? 'var(--c-text-faint)' : 'white' }}>‹</span>
            </div>
            <div onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} style={{ width: 20, height: 20, borderRadius: 4, background: page === totalPages - 1 ? 'var(--c-bg-muted)' : 'var(--c-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: page === totalPages - 1 ? 'default' : 'pointer' }}>
              <span style={{ fontSize: 10, color: page === totalPages - 1 ? 'var(--c-text-faint)' : 'white' }}>›</span>
            </div>
          </div>
        )}
      </div>

      {/* Canvas card */}
      <div style={{ flex: 1, background: 'var(--c-bg-card)', borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', overflow: 'auto', position: 'relative', display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10 }}>
          <div onClick={() => addTask(t.pomodoro.newTask, TAG_ICONS[0])} style={{ height: 26, padding: '0 12px', borderRadius: 7, background: 'var(--c-text-primary)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <span style={{ fontFamily: 'Inter', fontSize: 9, fontWeight: 600, color: 'white' }}>{t.pomodoro.addNode}</span>
          </div>
        </div>
        {tasks.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'Inter', fontSize: 9, color: 'var(--c-text-faint)' }}>{t.pomodoro.noSubTasks}</span>
          </div>
        ) : (
          <svg width={W + 40} height={svgH} style={{ display: 'block' }}>
            {/* Segments: gray base, highlight if both endpoints done */}
            {segments.map((d, i) => {
              const lit = tasks[i]?.done && tasks[i + 1]?.done
              return <path key={i} d={d} fill="none" stroke={lit ? color : 'var(--c-border)'} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
            })}
            {pts.map((pt, i) => {
              const task = tasks[i]
              return (
                <g key={task.id} transform={`translate(${pt.x + 20}, ${pt.y})`} style={{ cursor: 'pointer' }}
                  onClick={() => setEditingIdx(i)}>
                  <circle r={NODE_R} fill={task.done ? color : 'var(--c-bg-card)'} stroke={task.done ? color : 'var(--c-border)'} strokeWidth={1.5} />
                  <image href={`/tags/${task.icon}.png`} x={-12} y={-12} width={24} height={24} style={{ opacity: task.done ? 0.9 : 0.6 }} />
                  <text y={NODE_R + 12} textAnchor="middle" fontFamily="Inter" fontSize={10} fill={task.done ? 'var(--c-text-primary)' : 'var(--c-text-muted)'} fontWeight={task.done ? 600 : 400}>
                    {task.name.length > 10 ? task.name.slice(0, 10) + '…' : task.name}
                  </text>
                </g>
              )
            })}
          </svg>
        )}
      </div>

      {editingIdx !== null && tasks[editingIdx] && (
        <EditModal
          task={tasks[editingIdx]}
          color={color}
          index={editingIdx}
          total={tasks.length}
          onSave={t => setTasks(ts => ts.map((x, i) => i === editingIdx ? t : x))}
          onDelete={() => { setTasks(ts => ts.filter((_, i) => i !== editingIdx)); setEditingIdx(null) }}
          onInsertBefore={() => { setTasks(ts => [...ts.slice(0, editingIdx), newTask(), ...ts.slice(editingIdx)]); setEditingIdx(null) }}
          onInsertAfter={() => { setTasks(ts => [...ts.slice(0, editingIdx + 1), newTask(), ...ts.slice(editingIdx + 1)]); setEditingIdx(null) }}
          onClose={() => setEditingIdx(null)}
        />
      )}
    </div>
  )
}
