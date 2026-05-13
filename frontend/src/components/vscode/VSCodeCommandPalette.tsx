import { useEffect, useMemo, useRef, useState } from 'react'
import { useVSCodeStore } from '../../store/vscodeStore'
import { useT } from '../../i18n'

interface PaletteCommand {
  id: string
  title: string
  detail: string
  tag: string
  run: () => void
}

const getItemName = (itemPath: string) => {
  const parts = itemPath.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? itemPath
}

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  Project: { bg: '#E8F3FF', color: '#175B9F' },
  Folder:  { bg: '#F0F7E8', color: '#3B6E16' },
  Recent:  { bg: '#FFF3D8', color: '#8A5A00' },
  System:  { bg: '#F1EEFF', color: '#5235A8' },
  Tool:    { bg: '#FFECEC', color: '#9C2929' },
  Create:  { bg: '#EAF8F2', color: '#1F6B49' },
}

export const VSCodeCommandPalette = () => {
  const dragStateRef = useRef<{
    pointerId: number; startX: number; startY: number; startLeft: number; startTop: number
  } | null>(null)
  const resizeStateRef = useRef<{
    pointerId: number; startX: number; startY: number; startWidth: number; startHeight: number
  } | null>(null)
  const [position, setPosition] = useState({ left: 245, top: 72 })
  const [size, setSize] = useState({ width: 610, height: 470 })
  const [recentExpanded, setRecentExpanded] = useState(false)
  const [projectCreatorOpen, setProjectCreatorOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const {
    isOpen, activeIndex, busy, recentItems, status, error, checkResult,
    closePalette, setActiveIndex, moveActive, openPath, revealLocalItem,
    createFile, createProject, checkVSCode,
  } = useVSCodeStore()
  const t = useT()

  const commands = useMemo<PaletteCommand[]>(() => [
    {
      id: 'open-recent',
      title: t.vscode.openRecent,
      detail: t.vscode.openRecentDetail(recentItems.length),
      tag: 'Recent',
      run: () => setRecentExpanded((v) => !v),
    },
    {
      id: 'reveal-local',
      title: t.vscode.openLocal,
      detail: t.vscode.openLocalDetail,
      tag: 'System',
      run: () => void revealLocalItem(),
    },
    {
      id: 'create-file',
      title: t.vscode.createFile,
      detail: t.vscode.createFileDetail,
      tag: 'Create',
      run: () => void createFile(),
    },
    {
      id: 'create-project',
      title: t.vscode.createProject,
      detail: projectCreatorOpen
        ? t.vscode.createProjectDetailOpen(projectName.trim())
        : t.vscode.createProjectDetailClosed,
      tag: 'Create',
      run: () => setProjectCreatorOpen((v) => !v),
    },
    {
      id: 'check-vscode',
      title: t.vscode.checkVSCode,
      detail: checkResult
        ? checkResult.available
          ? t.vscode.checkVSCodeAvailable(checkResult.strategy, checkResult.version)
          : t.vscode.checkVSCodeUnavailable
        : t.vscode.checkVSCodeDefault,
      tag: 'Tool',
      run: () => void checkVSCode(),
    },
  ], [
    t, checkResult, createFile, createProject, projectCreatorOpen,
    projectName, recentItems, revealLocalItem, checkVSCode,
  ])

  const safeActiveIndex = commands.length === 0 ? 0 : Math.min(activeIndex, commands.length - 1)

  useEffect(() => {
    if (!isOpen || activeIndex === safeActiveIndex) return
    setActiveIndex(safeActiveIndex)
  }, [activeIndex, isOpen, safeActiveIndex, setActiveIndex])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape')    { e.preventDefault(); closePalette(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1, commands.length); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); moveActive(-1, commands.length); return }
      if (e.key === 'Enter')     { e.preventDefault(); commands[safeActiveIndex]?.run() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [commands, closePalette, isOpen, moveActive, safeActiveIndex])

  useEffect(() => {
    if (!isOpen) return
    const handlePointerMove = (e: PointerEvent) => {
      const drag = dragStateRef.current
      if (drag) {
        const maxLeft = window.innerWidth - size.width - 10
        const maxTop  = window.innerHeight - 60
        setPosition({
          left: Math.min(maxLeft, Math.max(10, drag.startLeft + e.clientX - drag.startX)),
          top:  Math.min(maxTop,  Math.max(10, drag.startTop  + e.clientY - drag.startY)),
        })
        return
      }
      const resize = resizeStateRef.current
      if (resize) {
        setSize({
          width:  Math.max(480, resize.startWidth  + e.clientX - resize.startX),
          height: Math.max(330, resize.startHeight + e.clientY - resize.startY),
        })
      }
    }
    const handlePointerUp = () => { dragStateRef.current = null; resizeStateRef.current = null }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isOpen])

  useEffect(() => {
    setProjectCreatorOpen(false)
    setRecentExpanded(false)
    setProjectName('')
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      <div style={{
        position: 'absolute', top: position.top, left: position.left,
        width: size.width, height: size.height,
        background: 'var(--c-bg-card)',
        borderRadius: 16, border: '1px solid var(--c-border)',
        boxShadow: '0 28px 80px rgba(0,0,0,0.18)',
        zIndex: 30, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 16px 12px',
          borderBottom: '1px solid var(--c-border)',
          background: 'var(--c-bg-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'grab', userSelect: 'none' }}>
            <div
              onPointerDown={(e) => {
                dragStateRef.current = {
                  pointerId: e.pointerId, startX: e.clientX, startY: e.clientY,
                  startLeft: position.left, startTop: position.top,
                }
              }}
              style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <img src="/vscode.png" alt="VS Code" style={{ width: 22, height: 22, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ color: 'var(--c-text-primary)', fontSize: 14, fontWeight: 800 }}>
                  {t.vscode.title}
                </div>
                <div style={{ color: 'var(--c-text-faint)', fontSize: 10, marginTop: 2 }}>
                  {t.vscode.dragHint}
                </div>
              </div>
            </div>
            <button
              onClick={closePalette}
              title="Close"
              style={{
                width: 30, height: 30, borderRadius: 8,
                border: '1px solid var(--c-border)',
                background: 'var(--c-bg-muted)',
                color: 'var(--c-text-muted)',
                cursor: 'pointer', fontSize: 18, lineHeight: '26px', flexShrink: 0,
              }}
            >×</button>
          </div>
        </div>

        {/* Status bar */}
        {(status || error || busy) && (
          <div style={{
            padding: '10px 16px',
            background: error ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.08)',
            color: error ? '#A32020' : '#1D4ED8',
            fontSize: 11, lineHeight: 1.6,
            borderBottom: '1px solid var(--c-border)',
          }}>
            {busy ? t.vscode.running : error ?? status}
          </div>
        )}

        {/* Command list */}
        <div style={{ overflowY: 'auto', padding: 8, flex: 1 }}>
          {commands.map((command, index) => {
            const active = index === safeActiveIndex
            const tagStyle = TAG_COLORS[command.tag] ?? { bg: '#E9EDF5', color: '#29364A' }
            const tagLabel = t.vscode.tagLabels[command.tag] ?? command.tag

            return (
              <div key={command.id}>
                <button
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={command.run}
                  disabled={busy}
                  style={{
                    width: '100%', minHeight: 62, border: 'none', borderRadius: 11,
                    background: active ? 'rgba(59,130,246,0.08)' : 'transparent',
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                    cursor: busy ? 'not-allowed' : 'pointer', textAlign: 'left',
                    opacity: busy ? 0.65 : 1,
                  }}
                >
                  <span style={{
                    flexShrink: 0, minWidth: 58, height: 24, borderRadius: 999,
                    background: tagStyle.bg, color: tagStyle.color,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800,
                  }}>
                    {tagLabel}
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{
                      display: 'block', color: 'var(--c-text-primary)',
                      fontSize: 13, fontWeight: 750, lineHeight: 1.4,
                    }}>
                      {command.title}
                    </span>
                    <span style={{
                      display: 'block', color: 'var(--c-text-faint)',
                      fontSize: 11, lineHeight: 1.5, marginTop: 2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {command.detail}
                    </span>
                  </span>
                </button>

                {/* Recent items dropdown */}
                {command.id === 'open-recent' && recentExpanded && (
                  <div style={{
                    margin: '0 10px 8px 80px', borderRadius: 11,
                    border: '1px solid var(--c-border)', overflow: 'hidden',
                    background: 'var(--c-bg-subtle)',
                  }}>
                    {recentItems.length === 0 ? (
                      <div style={{ padding: '10px 12px', color: 'var(--c-text-faint)', fontSize: 11 }}>
                        {t.vscode.noRecent}
                      </div>
                    ) : recentItems.map((item) => (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => void openPath(item.path)}
                        disabled={busy}
                        style={{
                          width: '100%', minHeight: 42, border: 'none',
                          borderBottom: '1px solid var(--c-border)',
                          background: 'transparent', color: 'var(--c-text-base)',
                          cursor: busy ? 'not-allowed' : 'pointer',
                          textAlign: 'left', padding: '8px 11px',
                          display: 'flex', alignItems: 'center', gap: 10,
                        }}
                      >
                        <span style={{
                          flexShrink: 0, width: 42,
                          color: item.type === 'folder' ? '#3B6E16' : '#175B9F',
                          fontSize: 10, fontWeight: 850, textTransform: 'uppercase',
                        }}>
                          {item.type}
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--c-text-primary)' }}>
                            {getItemName(item.path)}
                          </span>
                          <span style={{
                            display: 'block', fontSize: 10, color: 'var(--c-text-faint)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 420,
                          }}>
                            {item.path}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Project creator input */}
                {command.id === 'create-project' && projectCreatorOpen && (
                  <div style={{ margin: '0 10px 8px 80px', display: 'flex', gap: 8 }}>
                    <input
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return
                        const name = projectName.trim()
                        if (!name) return
                        void createProject(name).then((ok) => {
                          if (!ok) return
                          setProjectName('')
                          setProjectCreatorOpen(false)
                        })
                      }}
                      placeholder={t.vscode.projectPlaceholder}
                      disabled={busy}
                      style={{
                        flex: 1, height: 34, borderRadius: 9,
                        border: '1px solid var(--c-border)',
                        background: 'var(--c-bg-input)', color: 'var(--c-text-base)',
                        outline: 'none', padding: '0 10px', fontSize: 11,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const name = projectName.trim()
                        if (!name) return
                        void createProject(name).then((ok) => {
                          if (!ok) return
                          setProjectName('')
                          setProjectCreatorOpen(false)
                        })
                      }}
                      disabled={busy || !projectName.trim()}
                      style={{
                        width: 74, height: 34, borderRadius: 9,
                        border: '1px solid var(--c-border)',
                        background: projectName.trim() ? 'var(--c-text-primary)' : 'var(--c-bg-muted)',
                        color: projectName.trim() ? 'white' : 'var(--c-text-faint)',
                        cursor: busy || !projectName.trim() ? 'not-allowed' : 'pointer',
                        fontSize: 11, fontWeight: 850,
                      }}
                    >
                      {t.vscode.create}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Resize handle */}
        <div
          onPointerDown={(e) => {
            e.preventDefault()
            resizeStateRef.current = {
              pointerId: e.pointerId, startX: e.clientX, startY: e.clientY,
              startWidth: size.width, startHeight: size.height,
            }
          }}
          title="Resize"
          style={{
            position: 'absolute', right: 0, bottom: 0, width: 22, height: 22,
            cursor: 'nwse-resize',
            background: 'linear-gradient(135deg, transparent 0 48%, rgba(0,0,0,0.18) 49% 55%, transparent 56%), linear-gradient(135deg, transparent 0 63%, rgba(0,0,0,0.12) 64% 70%, transparent 71%)',
          }}
        />
      </div>
    </>
  )
}
