import { useState, useRef, useEffect } from 'react'
import { useScheduleStore } from '../../store/scheduleStore'
import { CheckboxIcon, PlusCircleIcon } from '../../components/icons/NavIcons'
import { useT } from '../../i18n'

type Menu = { id: string; x: number; y: number }

export const ContainerB = () => {
  const { goals, addGoal, toggleGoal, editGoal, deleteGoal } = useScheduleStore()
  const [adding, setAdding] = useState(false)
  const [newText, setNewText] = useState('')
  const [menu, setMenu] = useState<Menu | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const t = useT()

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menu])

  const sorted = [...goals].sort((a, b) => {
    if (a.completed === b.completed) return 0
    return a.completed ? 1 : -1
  })

  const handleAdd = () => {
    if (newText.trim()) {
      const yearMonth = new Date().toISOString().slice(0, 7)
      addGoal(newText.trim(), yearMonth)
      setNewText('')
    }
    setAdding(false)
  }

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    setMenu({ id, x: e.clientX, y: e.clientY })
  }

  const startEdit = (id: string, text: string) => {
    setEditingId(id)
    setEditText(text)
    setMenu(null)
  }

  const commitEdit = () => {
    if (editingId && editText.trim()) editGoal(editingId, editText.trim())
    setEditingId(null)
  }

  return (
    <div style={{
      flex: '287 0 0', minWidth: 0, height: 87, background: 'var(--c-bg-subtle)', borderRadius: 18,
      border: '0.5px solid var(--c-border)', padding: '8px 12px',
      boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 600, color: 'var(--c-text-secondary)' }}>{t.schedule.monthlyKeyGoals}</span>
        <div style={{ cursor: 'pointer' }} onClick={() => setAdding(true)}>
          <PlusCircleIcon color="#ACACAC" size={12} />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', alignContent: 'start', gap: '0 8px' }}>
        {adding && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <input autoFocus value={newText} onChange={e => setNewText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false) }}
              onBlur={handleAdd}
              style={{ fontFamily: 'Inter', fontSize: 10, border: 'none', background: 'transparent', outline: 'none', flex: 1, color: 'var(--c-text-base)' }}
              placeholder={t.schedule.newGoal} />
          </div>
        )}
        {sorted.map(g => (
          <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2, cursor: 'pointer' }}
            onClick={() => toggleGoal(g.id)}
            onContextMenu={e => handleContextMenu(e, g.id)}>
            <CheckboxIcon checked={g.completed} />
            {editingId === g.id ? (
              <input autoFocus value={editText} onChange={e => setEditText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null) }}
                onBlur={commitEdit}
                onClick={e => e.stopPropagation()}
                style={{ fontFamily: 'Inter', fontSize: 10, border: 'none', background: 'transparent', outline: 'none', flex: 1, color: 'var(--c-text-base)' }} />
            ) : (
              <span style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 400, color: 'var(--c-text-base)', textDecoration: g.completed ? 'line-through' : 'none', opacity: g.completed ? 0.5 : 1 }}>
                {g.text}
              </span>
            )}
          </div>
        ))}
      </div>

      {menu && (
        <div ref={menuRef} onClick={e => e.stopPropagation()} style={{
          position: 'fixed', top: menu.y, left: menu.x, zIndex: 1000,
          background: 'var(--c-bg-card)', borderRadius: 6, border: '0.5px solid var(--c-border)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', overflow: 'hidden', minWidth: 100,
        }}>
          {[
            { label: t.schedule.editGoal, action: () => { const g = goals.find(g => g.id === menu.id); if (g) startEdit(g.id, g.text) } },
            { label: t.schedule.deleteGoal, action: () => { deleteGoal(menu.id); setMenu(null) }, danger: true },
          ].map(item => (
            <div key={item.label} onClick={item.action} style={{
              padding: '6px 14px', fontFamily: 'Inter', fontSize: 10, fontWeight: 500,
              color: item.danger ? '#e05555' : 'var(--c-text-base)', cursor: 'pointer',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
