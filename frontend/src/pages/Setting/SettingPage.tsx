import { useState } from 'react'
import type React from 'react'
import { useThemeStore, type Theme } from '../../store/themeStore'
import { useLanguageStore } from '../../store/languageStore'
import { useDataStore, type RetentionMonths } from '../../store/dataStore'
import { useT } from '../../i18n'
import type { Lang } from '../../i18n'

// ── Types ─────────────────────────────────────────────────────────────────────

type NavItem = 'appearance' | 'language' | 'data'

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    fontSize: 9, fontWeight: 700, color: 'var(--c-text-faint)',
    letterSpacing: '0.45px', textTransform: 'uppercase', marginBottom: 14,
  }}>
    {children}
  </div>
)

const Row = ({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode
}) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '11px 0', borderBottom: '0.5px solid var(--c-border-xlight)',
  }}>
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-primary)' }}>{label}</div>
      {hint && <div style={{ fontSize: 9, color: 'var(--c-text-faint)', marginTop: 2 }}>{hint}</div>}
    </div>
    <div style={{ flexShrink: 0, marginLeft: 16 }}>{children}</div>
  </div>
)

// ── Toggle ────────────────────────────────────────────────────────────────────

const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => Promise<void> }) => (
  <div
    onClick={() => onChange(!value)}
    style={{
      width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
      background: value ? '#83B5B5' : '#E0E0E0',
      position: 'relative', transition: 'background 0.2s ease',
    }}
  >
    <div style={{
      position: 'absolute', top: 3, left: value ? 19 : 3,
      width: 14, height: 14, borderRadius: '50%', background: 'white',
      boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
      transition: 'left 0.2s cubic-bezier(0.34,1.56,0.64,1)',
    }} />
  </div>
)

// ── Chip selector ─────────────────────────────────────────────────────────────

function ChipGroup<T extends string>({
  options, value, onChange, disabled,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  disabled?: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => !disabled && onChange(opt.value)}
            style={{
              padding: '5px 12px',
              borderRadius: 8,
              border: active ? '1px solid #83B5B5' : '1px solid var(--c-border)',
              background: active ? 'var(--c-accent-tint)' : 'var(--c-bg-card)',
              color: active ? '#4a8a8a' : 'var(--c-text-muted)',
              fontSize: 10, fontWeight: active ? 700 : 500,
              cursor: disabled ? 'default' : 'pointer',
              transition: 'all 0.15s ease',
              opacity: disabled ? 0.45 : 1,
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Coming-soon badge ─────────────────────────────────────────────────────────

const ComingSoon = () => (
  <span style={{
    fontSize: 8, fontWeight: 700, letterSpacing: '0.04em',
    color: 'var(--c-text-faint)', background: 'var(--c-bg-muted)',
    border: '0.5px solid var(--c-border)',
    borderRadius: 5, padding: '2px 6px',
  }}>
    COMING SOON
  </span>
)

// ── Panels ────────────────────────────────────────────────────────────────────

const AppearancePanel = () => {
  const { theme, setTheme } = useThemeStore()
  const t = useT()

  return (
    <div>
      <SectionTitle>{t.settings.appearance}</SectionTitle>

      <Row
        label={t.settings.theme}
        hint={t.settings.chooseTheme}
      >
        <ChipGroup<Theme>
          options={[
            { value: 'light', label: t.settings.light },
            { value: 'dark',  label: t.settings.dark  },
          ]}
          value={theme}
          onChange={setTheme}
        />
      </Row>

      {/* Preview swatches — always show both, highlight the active one */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--c-text-faint)', letterSpacing: '0.04em', marginBottom: 10 }}>
          {t.settings.preview}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {/* Light swatch */}
          <div
            onClick={() => setTheme('light')}
            style={{
              flex: 1, borderRadius: 10,
              border: theme === 'light' ? '1.5px solid #83B5B5' : '1px solid #E0E0E0',
              overflow: 'hidden', cursor: 'pointer',
              boxShadow: theme === 'light' ? '0 0 0 3px rgba(131,181,181,0.15)' : 'none',
              transition: 'all 0.2s ease',
            }}>
            <div style={{ background: '#FCFCFC', padding: '10px 12px' }}>
              <div style={{ width: 40, height: 6, borderRadius: 3, background: '#E8E8E8', marginBottom: 6 }} />
              <div style={{ width: 60, height: 6, borderRadius: 3, background: '#F0F0F0' }} />
            </div>
            <div style={{ background: 'white', padding: '8px 12px', borderTop: '0.5px solid #F0F0F0' }}>
              <div style={{ width: '70%', height: 5, borderRadius: 3, background: '#F4F4F4', marginBottom: 5 }} />
              <div style={{ width: '50%', height: 5, borderRadius: 3, background: '#F4F4F4' }} />
            </div>
            <div style={{ padding: '6px 12px', background: '#FCFCFC', borderTop: '0.5px solid #F0F0F0' }}>
              <div style={{ fontSize: 8, color: theme === 'light' ? '#83B5B5' : '#ABABAB', fontWeight: 700 }}>{t.settings.light}</div>
            </div>
          </div>

          {/* Dark swatch */}
          <div
            onClick={() => setTheme('dark')}
            style={{
              flex: 1, borderRadius: 10,
              border: theme === 'dark' ? '1.5px solid #83B5B5' : '1px solid #E0E0E0',
              overflow: 'hidden', cursor: 'pointer',
              boxShadow: theme === 'dark' ? '0 0 0 3px rgba(131,181,181,0.15)' : 'none',
              transition: 'all 0.2s ease',
            }}>
            <div style={{ background: '#1e1e1e', padding: '10px 12px' }}>
              <div style={{ width: 40, height: 6, borderRadius: 3, background: '#333', marginBottom: 6 }} />
              <div style={{ width: 60, height: 6, borderRadius: 3, background: '#2a2a2a' }} />
            </div>
            <div style={{ background: '#252525', padding: '8px 12px', borderTop: '0.5px solid #333' }}>
              <div style={{ width: '70%', height: 5, borderRadius: 3, background: '#333', marginBottom: 5 }} />
              <div style={{ width: '50%', height: 5, borderRadius: 3, background: '#333' }} />
            </div>
            <div style={{ padding: '6px 12px', background: '#1e1e1e', borderTop: '0.5px solid #333' }}>
              <div style={{ fontSize: 8, color: theme === 'dark' ? '#83B5B5' : '#666', fontWeight: 700 }}>{t.settings.dark}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

const LanguagePanel = () => {
  const { language, setLanguage } = useLanguageStore()
  const t = useT()

  return (
    <div>
      <SectionTitle>{t.settings.language}</SectionTitle>

      <Row
        label={t.settings.displayLanguage}
        hint={t.settings.languageHint}
      >
        <ChipGroup<Lang>
          options={[
            { value: 'en', label: t.settings.english },
            { value: 'zh', label: t.settings.chinese },
          ]}
          value={language}
          onChange={setLanguage}
        />
      </Row>

      {/* Language preview card */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--c-text-faint)', letterSpacing: '0.04em', marginBottom: 10 }}>
          {t.settings.preview}
        </div>
        <div style={{
          borderRadius: 10, border: '0.5px solid var(--c-border)',
          background: 'var(--c-bg-subtle)', padding: '14px 16px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <PreviewLine label="Dashboard"   value={t.settings.previewLabels.dashboard} />
          <PreviewLine label="Schedule"    value={t.settings.previewLabels.schedule} />
          <PreviewLine label="Focus Timer" value={t.settings.previewLabels.focusTimer} />
          <PreviewLine label="Habits"      value={t.settings.previewLabels.habits} />
          <PreviewLine label="Settings"    value={t.settings.previewLabels.settings} />
        </div>
      </div>
    </div>
  )
}

const PreviewLine = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <span style={{ fontSize: 9, color: 'var(--c-text-faint)' }}>{label}</span>
    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--c-text-base)' }}>{value}</span>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────

const DataPanel = () => {
  const { retention, setRetention, pruning, pruneNow, lastPrune, pruneError,
          clearResourcesOnLogout, setClearResourcesOnLogout } = useDataStore()
  const t = useT()
  const { language } = useLanguageStore()

  const retentionOptions: { value: RetentionMonths; label: string }[] = [
    { value: '1',  label: t.settings.months['1']  },
    { value: '3',  label: t.settings.months['3']  },
    { value: '6',  label: t.settings.months['6']  },
    { value: '12', label: t.settings.months['12'] },
  ]

  const cutoffDate = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - Number(retention))
    return d.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', year: 'numeric' })
  })()

  return (
    <div>
      <SectionTitle>{t.settings.dataStorage}</SectionTitle>

      <Row
        label={t.settings.reviewRetention}
        hint={t.settings.retentionHint(Number(retention), cutoffDate)}
      >
        <ChipGroup<RetentionMonths>
          options={retentionOptions}
          value={retention}
          onChange={setRetention}
        />
      </Row>

      <Row
        label={t.settings.clearResourcesOnLogout}
        hint={t.settings.clearResourcesOnLogoutHint}
      >
        <Toggle
          value={clearResourcesOnLogout}
          onChange={setClearResourcesOnLogout}
        />
      </Row>

      {/* Visual timeline */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--c-text-faint)', letterSpacing: '0.04em', marginBottom: 10 }}>
          {t.settings.retentionWindow}
        </div>
        <RetentionTimeline months={Number(retention)} />
      </div>

      {/* Prune now */}
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={pruneNow}
          disabled={pruning}
          style={{
            alignSelf: 'flex-start',
            height: 30, padding: '0 16px', borderRadius: 8,
            border: '0.5px solid var(--c-border)',
            background: pruning ? 'var(--c-bg-muted)' : 'var(--c-bg-card)',
            color: pruning ? 'var(--c-text-faint)' : 'var(--c-text-primary)',
            fontSize: 10, fontWeight: 600, cursor: pruning ? 'default' : 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {pruning ? t.settings.pruning : t.settings.pruneNow}
        </button>

        {lastPrune && (
          <div style={{
            fontSize: 9, color: 'var(--c-text-faint)',
            background: 'var(--c-bg-subtle)', borderRadius: 8,
            padding: '8px 12px', border: '0.5px solid var(--c-border-light)',
            display: 'flex', flexDirection: 'column', gap: 3,
          }}>
            <span style={{ fontWeight: 700, color: '#83B5B5' }}>
              {t.settings.pruneSuccess(lastPrune.total_deleted)}
            </span>
            <span>{t.settings.pruneCutoff(lastPrune.cutoff)}</span>
            {Object.entries(lastPrune.deleted).filter(([, n]) => n > 0).map(([table, n]) => (
              <span key={table} style={{ color: 'var(--c-text-xfaint)' }}>
                {t.settings.pruneTable(table, n)}
              </span>
            ))}
          </div>
        )}

        {pruneError && (
          <div style={{
            fontSize: 9, color: '#cc3333',
            background: '#fff0f0', borderRadius: 8,
            padding: '8px 12px', border: '0.5px solid #ffcccc',
          }}>
            {t.settings.pruneError}
          </div>
        )}
      </div>
    </div>
  )
}

const RetentionTimeline = ({ months }: { months: number }) => {
  const now   = new Date()
  const total = 12  // show 12-month window
  const kept  = Math.min(months, total)

  const labels = Array.from({ length: total }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (total - 1 - i), 1)
    return d.toLocaleDateString('en-US', { month: 'short' })
  })

  return (
    <div>
      {/* Bar */}
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
        <div style={{
          flex: total - kept,
          background: 'var(--c-bg-muted)',
          transition: 'flex 0.3s ease',
        }} />
        <div style={{
          flex: kept,
          background: 'linear-gradient(90deg, rgba(131,181,181,0.3), #83B5B5)',
          transition: 'flex 0.3s ease',
        }} />
      </div>
      {/* Month labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 8, color: 'var(--c-text-xfaint)' }}>{labels[0]}</span>
        <span style={{ fontSize: 8, color: '#83B5B5', fontWeight: 700 }}>
          {labels[total - kept]} → now
        </span>
        <span style={{ fontSize: 8, color: 'var(--c-text-xfaint)' }}>{labels[total - 1]}</span>
      </div>
    </div>
  )
}

// ── Nav sidebar ───────────────────────────────────────────────────────────────

// ── Root ──────────────────────────────────────────────────────────────────────

export const SettingPage = () => {
  const [active, setActive] = useState<NavItem>('appearance')
  const t = useT()

  const NAV_ITEMS: { key: NavItem; label: string; icon: string }[] = [
    { key: 'appearance', label: t.settings.appearance, icon: '◑' },
    { key: 'language',   label: t.settings.language,   icon: '文' },
    { key: 'data',       label: t.settings.data,       icon: '⊞' },
  ]

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', fontFamily: 'Inter',
      background: 'var(--c-bg-page)', borderRadius: 18,
      border: '0.5px solid var(--c-border)',
      overflow: 'hidden',
    }}>

      {/* Left nav */}
      <div style={{
        width: 160, flexShrink: 0,
        borderRight: '0.5px solid var(--c-border-light)',
        padding: '24px 12px',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--c-text-primary)',
          letterSpacing: '0.02em', marginBottom: 16, paddingLeft: 8,
        }}>
          {t.settings.title}
        </div>

        {NAV_ITEMS.map(item => {
          const isActive = item.key === active
          return (
            <button
              key={item.key}
              onClick={() => setActive(item.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', borderRadius: 8,
                border: 'none', cursor: 'pointer', textAlign: 'left',
                background: isActive ? 'var(--c-accent-tint)' : 'transparent',
                transition: 'background 0.15s ease',
                width: '100%',
              }}
            >
              <span style={{
                fontSize: 13, width: 18, textAlign: 'center',
                color: isActive ? '#4a8a8a' : 'var(--c-text-xfaint)',
              }}>
                {item.icon}
              </span>
              <span style={{
                fontSize: 11, fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--c-text-primary)' : 'var(--c-text-muted)',
              }}>
                {item.label}
              </span>
              {isActive && (
                <div style={{
                  marginLeft: 'auto', width: 3, height: 3,
                  borderRadius: '50%', background: '#83B5B5',
                }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Right content */}
      <div style={{
        flex: 1, minWidth: 0,
        padding: '28px 32px',
        overflowY: 'auto',
        background: 'var(--c-bg-card)',
      }}>
        {active === 'appearance' && <AppearancePanel />}
        {active === 'language'   && <LanguagePanel />}
        {active === 'data'       && <DataPanel />}
      </div>
    </div>
  )
}
