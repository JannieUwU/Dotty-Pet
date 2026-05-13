import type React from 'react'
import { usePetStore } from '../usePetStore'
import { useT } from '../../../i18n'

const FC = '#83B5B5'

export const ModelPanel = () => {
  const {
    modelName, recentModels, modelLoading, modelError,
    pickAndLoadVrm, loadVrm, resetModel, removeRecentModel,
  } = usePetStore()
  const t = useT()

  return (
    <div style={panelStyle}>
      <div style={panelTitle}>{t.desktopPet.model.title}</div>

      {/* Current model */}
      <div style={currentModelBox}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>📦</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={modelNameStyle}>{modelName}</div>
          <div style={modelSubStyle}>
            {modelName === 'DEFAULT AVATAR' ? t.desktopPet.model.builtIn : t.desktopPet.model.custom}
          </div>
        </div>
        {modelName !== 'DEFAULT AVATAR' && (
          <button onClick={resetModel} style={btnSecondary}>{t.desktopPet.model.reset}</button>
        )}
      </div>

      {/* Import button */}
      <div
        onClick={modelLoading ? undefined : pickAndLoadVrm}
        onKeyDown={e => { if (!modelLoading && (e.key === 'Enter' || e.key === ' ')) pickAndLoadVrm() }}
        style={dropZone(modelLoading)}
        role="button"
        tabIndex={modelLoading ? -1 : 0}
        aria-label="Import VRM model"
        aria-disabled={modelLoading}
      >
        {modelLoading ? (
          <span style={{ fontSize: 26 }}>⏳</span>
        ) : (
          <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="32" height="32">
            <path d="M891.1 295.4H604.2c-17.5 0-34.4-6.6-47.2-18.6L444.1 171.6c-12.8-12-29.7-18.6-47.2-18.6H133.4c-38.2 0-69.2 31-69.2 69.2v587.6c0 38.2 31 69.2 69.2 69.2h757.8c38.2 0 69.2-31 69.2-69.2V364.7c0-38.3-31-69.3-69.3-69.3z" fill="#FFF7D4"/>
            <path d="M868 153H535.4c-19.7 0-29.4 24-15.2 37.7l67 64.6c4.1 3.9 9.5 6.1 15.2 6.1H868c12.1 0 21.9-9.8 21.9-21.9v-64.6c0-12.1-9.9-21.9-21.9-21.9z" fill="#EEEEEE"/>
          </svg>
        )}
        <span style={{ fontSize: 10, color: 'var(--c-text-muted)' }}>
          {modelLoading ? t.desktopPet.model.loading : t.desktopPet.model.clickToImport}
        </span>
        <span style={{ fontSize: 9, color: 'var(--c-text-faint)' }}>{t.desktopPet.model.maxSize}</span>
      </div>

      {modelError && (
        <div style={errorBox}>{modelError}</div>
      )}

      {/* Recent models */}
      {recentModels.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={sectionLabel}>{t.desktopPet.model.recent}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {recentModels.map(p => {
              const name = p.split(/[\\/]/).pop()?.replace(/\.vrm$/i, '') ?? p
              return (
                <div key={p} style={recentItem}>
                  <span
                    style={{ ...recentName, cursor: 'pointer' }}
                    onClick={() => loadVrm(p)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') loadVrm(p) }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Load ${name}`}
                  >
                    {name}
                  </span>
                  <span style={{ fontSize: 9, color: FC, cursor: 'pointer', flexShrink: 0 }}
                    onClick={() => loadVrm(p)}>{t.desktopPet.model.load}</span>
                  <button
                    onClick={e => { e.stopPropagation(); removeRecentModel(p) }}
                    style={deleteBtn}
                    aria-label={`Remove ${name} from recent`}
                    title="Remove from recent"
                  >✕</button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── styles ────────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  background: 'var(--c-bg-subtle)', borderRadius: 14, border: '0.5px solid var(--c-border)',
  padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
  flexShrink: 0,
}
const panelTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--c-text-primary)', marginBottom: 2,
}
const currentModelBox: React.CSSProperties = {
  background: 'var(--c-bg-card)', borderRadius: 10, padding: '10px 12px',
  display: 'flex', alignItems: 'center', gap: 10,
  border: '0.5px solid var(--c-border-light)',
}
const modelNameStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'var(--c-text-primary)',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}
const modelSubStyle: React.CSSProperties = {
  fontSize: 9, color: 'var(--c-text-faint)', marginTop: 2,
}
const dropZone = (loading: boolean): React.CSSProperties => ({
  border: `1.5px dashed ${loading ? 'var(--c-border)' : 'var(--c-border)'}`,
  borderRadius: 10, padding: '18px 0',
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
  cursor: loading ? 'default' : 'pointer',
  background: loading ? 'var(--c-bg-subtle)' : 'var(--c-bg-card)',
  transition: 'border-color 0.15s',
})
const errorBox: React.CSSProperties = {
  background: '#fff0f0', border: '0.5px solid #ffcccc', borderRadius: 8,
  padding: '8px 10px', fontSize: 9, color: '#cc3333',
}
const sectionLabel: React.CSSProperties = {
  fontSize: 9, fontWeight: 600, color: 'var(--c-text-faint)', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: 6,
}
const recentItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '7px 10px', borderRadius: 8,
  background: 'var(--c-bg-card)', cursor: 'pointer',
  border: '0.5px solid var(--c-border-light)',
}
const recentName: React.CSSProperties = {
  fontSize: 10, color: 'var(--c-text-primary)', flex: 1,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}
const deleteBtn: React.CSSProperties = {
  width: 16, height: 16, borderRadius: 4,
  border: 'none', background: 'transparent',
  fontFamily: 'Inter', fontSize: 9, color: 'var(--c-text-faint)',
  cursor: 'pointer', flexShrink: 0, padding: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  lineHeight: 1,
}
const btnSecondary: React.CSSProperties = {
  height: 26, padding: '0 10px', borderRadius: 7,
  border: 'none', background: 'var(--c-text-primary)',
  fontFamily: 'Inter', fontSize: 9, color: 'white', cursor: 'pointer',
  flexShrink: 0,
}
