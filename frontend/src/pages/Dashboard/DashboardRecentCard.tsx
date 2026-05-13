import { useEffect, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { useT } from '../../i18n'
import { dashboardCardStyle, dashboardMutedStyle, dashboardTitleStyle } from './dashboardStyles'

export const DashboardRecentCard = () => {
  const { recentFeatures, setPage } = useAppStore()
  const [now, setNow] = useState(() => Date.now())
  const t = useT()

  const formatRelativeTime = (usedAt: number) => {
    const diffSec = Math.max(0, Math.floor((now - usedAt) / 1000))
    if (diffSec < 10) return t.dashboard.justNow
    if (diffSec < 60) return t.dashboard.secAgo(diffSec)
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return t.dashboard.minAgo(diffMin)
    const diffHour = Math.floor(diffMin / 60)
    if (diffHour < 24) return t.dashboard.hrAgo(diffHour)
    const diffDay = Math.floor(diffHour / 24)
    return t.dashboard.dayAgo(diffDay)
  }

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div style={{
      ...dashboardCardStyle, flex: 1, padding: '16px 18px',
      display: 'flex', flexDirection: 'column', minHeight: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#BFC5D5', flexShrink: 0 }} />
        <div style={dashboardTitleStyle}>{t.dashboard.recentlyUsed}</div>
      </div>
      <div style={{ ...dashboardMutedStyle, marginTop: 4, marginBottom: 14 }}>{t.dashboard.recentSubtitle}</div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
        {recentFeatures.length === 0 ? (
          <div style={{ borderRadius: 10, background: 'rgba(191,197,213,0.08)', border: '0.5px dashed var(--c-border)', padding: '14px 12px', fontSize: 9, color: 'var(--c-text-faint)' }}>
            {t.dashboard.noRecentActions}
          </div>
        ) : recentFeatures.map((item, index) => (
          <div key={item.id} onClick={() => setPage(item.page)} style={{
            padding: index === recentFeatures.length - 1 ? '10px 0 0' : '10px 0',
            borderBottom: index === recentFeatures.length - 1 ? 'none' : '0.5px solid var(--c-border-light)',
            cursor: 'pointer', borderRadius: 8,
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(191,197,213,0.12)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text-base)', lineHeight: 1.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
            <div style={{ fontSize: 9, color: 'var(--c-text-muted)', marginTop: 2, lineHeight: 1.7, wordBreak: 'break-word' }}>{item.detail}</div>
            <div style={{ fontSize: 8, color: 'var(--c-text-faint)', marginTop: 4, letterSpacing: '0.1px' }}>{t.dashboard.lastUsed} {formatRelativeTime(item.usedAt)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
