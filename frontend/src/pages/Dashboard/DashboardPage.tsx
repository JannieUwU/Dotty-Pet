import { DashboardHero } from './DashboardHero'
import { DashboardSnapshotRow } from './DashboardSnapshotRow'
import { DashboardIntroCard } from './DashboardIntroCard'
import { DashboardDeadlineCard } from './DashboardDeadlineCard'
import { DashboardRecentCard } from './DashboardRecentCard'

export const DashboardPage = () => (
  <div style={{
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    gap: 10, padding: '10px 12px', boxSizing: 'border-box',
    fontFamily: 'Inter',
    background: 'var(--c-bg-page)',
    borderRadius: 18,
    border: '0.5px solid var(--c-border)',
    overflow: 'hidden',
  }}>
    <DashboardHero />
    <DashboardSnapshotRow />
    <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10 }}>
      <DashboardIntroCard />
      <div style={{ flex: 0.35, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <DashboardDeadlineCard />
        <DashboardRecentCard />
      </div>
    </div>
  </div>
)
