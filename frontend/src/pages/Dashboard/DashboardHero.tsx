import { useEffect, useState } from 'react'
import { useT } from '../../i18n'

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const pad = (value: number) => String(value).padStart(2, '0')

const formatNow = (date: Date) => {
  const yy = pad(date.getFullYear() % 100)
  const mm = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  const hh = pad(date.getHours())
  const min = pad(date.getMinutes())
  const ss = pad(date.getSeconds())
  const weekday = WEEKDAY[date.getDay()]
  return `${yy}/${mm}/${dd}, ${weekday}, ${hh}:${min}:${ss}`
}

export const DashboardHero = () => {
  const [now, setNow] = useState(() => new Date())
  const t = useT()

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div style={{
      height: 126, borderRadius: 14,
      border: '0.5px solid var(--c-border)',
      background: 'linear-gradient(135deg, var(--c-bg-sidebar) 0%, var(--c-bg-subtle) 55%, var(--c-bg-sidebar) 100%)',
      padding: '18px 20px', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', justifyContent: 'center', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <div style={{
          height: 22, padding: '0 9px', borderRadius: 999,
          background: 'var(--c-bg-card)', border: '0.5px solid var(--c-border)',
          display: 'flex', alignItems: 'center',
          fontSize: 9, fontWeight: 600, color: 'var(--c-text-muted)',
        }}>
          {formatNow(now)}
        </div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--c-text-base)', letterSpacing: '-0.4px' }}>
        {t.dashboard.welcomeBack}
      </div>
      <div style={{ width: 470, maxWidth: '100%', fontSize: 11, lineHeight: 1.8, color: 'var(--c-text-secondary)', marginTop: 8 }}>
        {t.dashboard.welcomeDesc}
      </div>
    </div>
  )
}
