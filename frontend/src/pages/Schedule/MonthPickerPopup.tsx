import { useState } from 'react'

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

interface Props {
  year: number
  month: number
  onSelect: (year: number, month: number) => void
  onClose: () => void
}

export const MonthPickerPopup = ({ year, month, onSelect, onClose }: Props) => {
  const [pickerYear, setPickerYear] = useState(year)

  return (
    <div style={{
      position: 'absolute', top: 32, left: 0, zIndex: 50,
      background: 'var(--c-bg-card)', borderRadius: 8, border: '0.5px solid var(--c-border)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.12)', padding: 10, width: 160,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <button onClick={() => setPickerYear(y => y - 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter', fontSize: 10, color: 'var(--c-text-base)' }}>{'<'}</button>
        <span style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 700, color: 'var(--c-text-base)' }}>{pickerYear}</span>
        <button onClick={() => setPickerYear(y => y + 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter', fontSize: 10, color: 'var(--c-text-base)' }}>{'>'}</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        {MONTHS.map((m, i) => (
          <div key={m} onClick={() => { onSelect(pickerYear, i); onClose() }} style={{
            fontFamily: 'Inter', fontSize: 9, fontWeight: 600,
            textAlign: 'center', padding: '4px 2px', borderRadius: 4, cursor: 'pointer',
            background: pickerYear === year && i === month ? 'var(--c-text-primary)' : 'transparent',
            color: pickerYear === year && i === month ? 'white' : 'var(--c-text-secondary)',
          }}>
            {m}
          </div>
        ))}
      </div>
    </div>
  )
}
