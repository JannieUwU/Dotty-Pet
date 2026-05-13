import type React from 'react'
import { useAppStore, NavPage } from '../../store/appStore'
import { useGitMonitorStore } from '../../store/gitMonitorStore'
import { useVSCodeStore } from '../../store/vscodeStore'
import { useAuthStore } from '../../store/authStore'
import { useThemeStore } from '../../store/themeStore'
import { useT } from '../../i18n'
import { getAvatarColor, getAvatarInitial } from '../../utils/avatar'
import { NavItem } from '../ui/NavItem'
import {
  DashboardIcon, DesktopPetIcon, ScheduleIcon, PomodoroIcon,
  ResourceLibraryIcon, SettingIcon, QuickStartIcon
} from '../icons/NavIcons'

const SectionLabel = ({ label }: { label: string }) => (
  <div style={{
    fontFamily: 'Inter', fontSize: 9, fontWeight: 700,
    color: 'var(--c-text-faint)',
    paddingLeft: 10, marginTop: 14, marginBottom: 4, letterSpacing: '0.5px',
  }}>
    {label}
  </div>
)

export const Sidebar = () => {
  const { currentPage, setPage } = useAppStore()
  const { openPanel } = useGitMonitorStore()
  const { openPalette } = useVSCodeStore()
  const { user, openLogin } = useAuthStore()
  const { theme } = useThemeStore()
  const t = useT()
  const isDark = theme === 'dark'

  return (
    <div style={{
      width: 203, minHeight: '100%',
      background: 'var(--c-bg-sidebar)',
      borderRadius: 8,
      border: '0.5px solid var(--c-border)',
      display: 'flex', flexDirection: 'column',
      padding: '14px 11px 12px',
      boxSizing: 'border-box', flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingLeft: 2 }}>
        <img src={isDark ? '/logo-dark.png' : '/logo.png'} style={{ width: 26, height: 29, objectFit: 'contain' }} alt="logo" />
        <span style={{ fontFamily: 'Roboto', fontSize: 14, fontWeight: 800, letterSpacing: '0.42px', color: 'var(--c-text-primary)' }}>
          Dotty Pet
        </span>
      </div>

      <SectionLabel label={t.nav.general} />
      {([
        ['dashboard', <DashboardIcon />, t.nav.dashboard],
        ['desktop-pet', <DesktopPetIcon />, t.nav.desktopPet],
        ['schedule', <ScheduleIcon />, t.nav.schedule],
        ['pomodoro', <PomodoroIcon />, t.nav.pomodoro],
        ['resource-library', <ResourceLibraryIcon />, t.nav.resourceLibrary],
      ] as [NavPage, React.ReactNode, string][]).map(([page, icon, label]) => (
        <NavItem key={page} icon={icon} label={label} active={currentPage === page} onClick={() => setPage(page)} />
      ))}

      <SectionLabel label={t.nav.more} />
      {([
        ['setting', <SettingIcon />, t.nav.setting],
        ['quick-start', <QuickStartIcon />, t.nav.quickStart],
      ] as [NavPage, React.ReactNode, string][]).map(([page, icon, label]) => (
        <NavItem key={page} icon={icon} label={label} active={currentPage === page} onClick={() => setPage(page)} />
      ))}

      <SectionLabel label={t.nav.hotkeys} />
      <div style={{ display: 'flex', gap: 10, paddingLeft: 10, marginTop: 6 }}>
        <img src="/vscode.png" style={{ width: 25, height: 24, objectFit: 'contain', cursor: 'pointer' }} title="VSCode" onClick={() => void openPalette()} />
        <img
          src={isDark ? '/github-dark.png' : '/github.png'}
          style={{ width: 27, height: 27, objectFit: 'contain', cursor: 'pointer' }}
          title="Git Monitor"
          onClick={openPanel}
        />
      </div>

      <div style={{ flex: 1 }} />

      {/* User card */}
      <div
        onClick={() => openLogin()}
        style={{
          width: '100%', height: 55,
          background: 'var(--c-bg-card)',
          borderRadius: 6,
          border: '0.5px solid var(--c-border)',
          display: 'flex', alignItems: 'center',
          gap: 10, padding: '0 10px', boxSizing: 'border-box', cursor: 'pointer',
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: user ? (user.avatarDataUrl ? `url(${user.avatarDataUrl}) center / cover` : getAvatarColor(user.email)) : '#D9D9D9',
          color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800,
        }}>
          {user && !user.avatarDataUrl ? getAvatarInitial(user.name) : ''}
        </div>
        <div>
          <div style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 700, letterSpacing: '0.30px', color: 'var(--c-text-primary)' }}>
            {user ? user.name : t.nav.guest}
          </div>
          <div style={{ fontFamily: 'Inter', fontSize: 8, fontWeight: 300, letterSpacing: '0.24px', color: 'var(--c-text-muted)', marginTop: 2 }}>
            {user ? user.email : t.nav.clickToSignIn}
          </div>
        </div>
      </div>
    </div>
  )
}
