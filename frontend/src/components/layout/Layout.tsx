import type React from 'react'
import { useAppStore } from '../../store/appStore'
import { Sidebar } from './Sidebar'
import { GitMonitorPanel } from '../git/GitMonitorPanel'
import { VSCodeCommandPalette } from '../vscode/VSCodeCommandPalette'
import { LoginModal } from '../auth/LoginModal'
import { SchedulePage } from '../../pages/Schedule/SchedulePage'
import { DashboardPage } from '../../pages/Dashboard/DashboardPage'
import { DesktopPetPage } from '../../pages/DesktopPet/DesktopPetPage'
import { PomodoroPage } from '../../pages/Pomodoro/PomodoroPage'
import { ResourceLibraryPage } from '../../pages/ResourceLibrary/ResourceLibraryPage'
import { SettingPage } from '../../pages/Setting/SettingPage'
import { QuickStartPage } from '../../pages/QuickStart/QuickStartPage'

const ALL_PAGES: Array<{ key: string; el: React.ReactElement }> = [
  { key: 'dashboard',        el: <DashboardPage /> },
  { key: 'desktop-pet',      el: <DesktopPetPage /> },
  { key: 'schedule',         el: <SchedulePage /> },
  { key: 'pomodoro',         el: <PomodoroPage /> },
  { key: 'resource-library', el: <ResourceLibraryPage /> },
  { key: 'setting',          el: <SettingPage /> },
  { key: 'quick-start',      el: <QuickStartPage /> },
]

export const Layout = () => {
  const { currentPage } = useAppStore()

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'var(--c-bg-app)',
      display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
    }}>
      {/* Title bar */}
      <div style={{
        height: 32, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        paddingRight: 8,
        // @ts-ignore — Electron CSS property
        WebkitAppRegion: 'drag',
        background: 'var(--c-bg-app)',
        borderBottom: '0.5px solid var(--c-border-light)',
        position: 'relative',
      }}>
        <span style={{
          fontFamily: 'Inter', fontSize: 12, fontWeight: 600,
          color: 'var(--c-text-base)', letterSpacing: '0.3px', pointerEvents: 'none',
        }}>
          Dotty Pet
        </span>
        <div style={{ position: 'absolute', right: 0, top: 0, display: 'flex', gap: 2, WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={() => (window as any).electron?.minimize()}
            title="最小化"
            style={{
              width: 46, height: 32, border: 'none', background: 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--c-text-secondary)', fontSize: 16, lineHeight: 1,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            &#x2212;
          </button>
          <button
            onClick={() => (window as any).electron?.close()}
            title="关闭"
            style={{
              width: 46, height: 32, border: 'none', background: 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--c-text-secondary)', fontSize: 14, lineHeight: 1,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e81123'; e.currentTarget.style.color = 'white' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-text-secondary)' }}
          >
            &#x2715;
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', padding: '0 10px 10px', gap: 10, overflow: 'hidden' }}>
        <Sidebar />
        <div style={{ flex: 1, overflow: 'hidden', borderRadius: 8, position: 'relative' }}>
          {ALL_PAGES.map(({ key, el }) => (
            <div key={key} style={{ position: 'absolute', inset: 0, display: currentPage === key ? 'block' : 'none' }}>
              {el}
            </div>
          ))}
        </div>
      </div>
      <GitMonitorPanel />
      <VSCodeCommandPalette />
      <LoginModal />
    </div>
  )
}
