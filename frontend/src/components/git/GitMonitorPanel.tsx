import type React from 'react'
import { useEffect, useRef } from 'react'
import { useGitMonitorStore } from '../../store/gitMonitorStore'
import { useT } from '../../i18n'
import { useThemeStore } from '../../store/themeStore'
import type { GitChangedFile, GitDiffSection } from '../../types/git'

// ── colour helpers ─────────────────────────────────────────────────────────

const diffLineColor = (line: string) => {
  if (line.startsWith('+') && !line.startsWith('+++')) return 'var(--git-add)'
  if (line.startsWith('-') && !line.startsWith('---')) return 'var(--git-del)'
  if (line.startsWith('@@')) return 'var(--git-hunk)'
  if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ')) return 'var(--git-head)'
  return 'var(--c-text-base)'
}

const stateColor: Record<string, string> = {
  staged: 'var(--git-add)', modified: 'var(--git-warn)', untracked: 'var(--git-head)',
  deleted: 'var(--git-del)', renamed: 'var(--git-hunk)', conflicted: 'var(--git-del)',
}

const getStatusCode = (f: GitChangedFile) =>
  f.indexStatus === '?' ? '??' : `${f.indexStatus}${f.workingTreeStatus}`

// ── sub-components ─────────────────────────────────────────────────────────

const Btn = ({ onClick, disabled, children, danger }: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode; danger?: boolean
}) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding: '3px 8px', fontSize: 11, borderRadius: 4,
    border: '1px solid var(--c-border)',
    background: danger ? 'var(--git-del-bg)' : 'var(--c-bg-subtle)',
    color: danger ? 'var(--git-del)' : 'var(--c-text-base)',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
    whiteSpace: 'nowrap',
  }}>
    {children}
  </button>
)

const DiffView = ({ sections }: { sections: GitDiffSection[] }) => {
  const t = useT()
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 10, color: 'var(--c-text-faint)', marginBottom: 4 }}>
        <span style={{ color: 'var(--git-add)' }}>{t.git.legendAdded}</span>{'  '}
        <span style={{ color: 'var(--git-del)' }}>{t.git.legendRemoved}</span>{'  '}
        <span style={{ color: 'var(--git-hunk)' }}>{t.git.legendHunk}</span>{'  '}
        <span style={{ color: 'var(--git-head)' }}>{t.git.legendHeader}</span>
      </div>
      {sections.map((sec, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text-faint)', marginBottom: 3 }}>
            {sec.label === 'Staged'       && t.git.sectionStaged}
            {sec.label === 'Working Tree' && t.git.sectionWorkingTree}
            {sec.label === 'Untracked'    && t.git.sectionUntracked}
            {sec.label === 'Info'         && t.git.sectionInfo}
          </div>
          <pre style={{
            fontSize: 10, lineHeight: 1.5, margin: 0, padding: '6px 8px',
            background: 'var(--c-bg-subtle)', borderRadius: 4, border: '1px solid var(--c-border)',
            overflowX: 'auto', whiteSpace: 'pre',
          }}>
            {sec.diff.split('\n').map((line, j) => (
              <span key={j} style={{ display: 'block', color: diffLineColor(line) }}>{line}</span>
            ))}
          </pre>
        </div>
      ))}
    </div>
  )
}

const FileCard = ({ file }: { file: GitChangedFile }) => {
  const { viewDiff, clearDiff, openFile, stageFile, unstageFile,
          selectedDiffPath, diff, diffLoading, fileActionTarget, fileActionKind } = useGitMonitorStore()
  const t = useT()
  const isSelected = selectedDiffPath === file.path
  const isActing = fileActionTarget === file.path
  const code = getStatusCode(file)
  const statusExplain = t.git.statusExplain[code] ?? `index=${file.indexStatus} tree=${file.workingTreeStatus}`

  return (
    <div style={{
      border: '1px solid var(--c-border)', borderRadius: 6, padding: '8px 10px',
      marginBottom: 6, background: isSelected ? 'var(--c-accent-tint)' : 'var(--c-bg-card)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 10,
          background: stateColor[file.state] + '22', color: stateColor[file.state],
        }}>
          {file.state}
        </span>
        <span style={{ fontSize: 11, color: 'var(--c-text-base)', flex: 1, wordBreak: 'break-all' }}>{file.path}</span>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <Btn onClick={() => isSelected ? clearDiff() : viewDiff(file.path)} disabled={diffLoading && isSelected}>
            {isSelected ? t.git.closeDiff : t.git.viewDiff}
          </Btn>
          <Btn onClick={() => openFile(file.path)} disabled={isActing && fileActionKind === 'open'}>
            {t.git.openInVSCode}
          </Btn>
          {file.state !== 'untracked' && file.indexStatus !== ' ' ? (
            <Btn onClick={() => unstageFile(file.path)} disabled={isActing && fileActionKind === 'unstage'}>
              {t.git.unstage}
            </Btn>
          ) : (
            <Btn onClick={() => stageFile(file.path)} disabled={isActing && fileActionKind === 'stage'}>
              {t.git.stage}
            </Btn>
          )}
        </div>
      </div>
      <div style={{ fontSize: 10, color: 'var(--c-text-faint)', marginTop: 4 }}>
        <code style={{ background: 'var(--c-bg-subtle)', padding: '1px 4px', borderRadius: 3, marginRight: 6 }}>{code}</code>
        {statusExplain}
      </div>
      {isSelected && diffLoading && (
        <div style={{ fontSize: 11, color: 'var(--c-text-faint)', marginTop: 6 }}>{t.git.diffLoadingMsg}</div>
      )}
      {isSelected && !diffLoading && diff && <DiffView sections={diff.sections} />}
    </div>
  )
}

// ── main panel ─────────────────────────────────────────────────────────────

export const GitMonitorPanel = () => {
  const {
    isOpen, closePanel, loading, summary, error,
    repoPath, selectRepository, refresh,
    commitMessage, setCommitMessage, commit, committing,
  } = useGitMonitorStore()
  const t = useT()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && repoPath) refresh()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) closePanel()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
      pointerEvents: 'none',
    }}>
      <div ref={panelRef} style={{
        width: 420, height: '100%',
        background: 'var(--c-bg-card)',
        borderLeft: '1px solid var(--c-border)',
        boxShadow: '-4px 0 16px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column', pointerEvents: 'all',
        fontFamily: 'Inter, -apple-system, sans-serif',
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 14px', borderBottom: '1px solid var(--c-border)',
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          background: 'var(--c-bg-subtle)',
        }}>
          <img src={isDark ? '/github-dark.png' : '/github.png'} style={{ width: 20, height: 20 }} alt="git" />
          <span style={{ fontWeight: 700, fontSize: 13, flex: 1, color: 'var(--c-text-primary)' }}>{t.git.title}</span>
          <Btn onClick={() => refresh()} disabled={loading}>
            {loading ? t.git.loading : t.git.refresh}
          </Btn>
          <Btn onClick={selectRepository}>{t.git.chooseRepo}</Btn>
          <button onClick={closePanel} style={{
            border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 16, color: 'var(--c-text-faint)', padding: '0 4px',
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
          {error && (
            <div style={{
              padding: '8px 10px', background: 'var(--git-del-bg)',
              border: '1px solid var(--git-del)', borderRadius: 6,
              fontSize: 12, color: 'var(--git-del)', marginBottom: 10,
            }}>
              {error}
            </div>
          )}

          {!summary && !error && (
            <div style={{ fontSize: 12, color: 'var(--c-text-faint)', textAlign: 'center', marginTop: 40 }}>
              {t.git.noRepo}
            </div>
          )}

          {summary && (
            <>
              {/* Repo overview */}
              <div style={{
                background: 'var(--c-bg-subtle)', border: '1px solid var(--c-border)',
                borderRadius: 6, padding: '10px 12px', marginBottom: 12,
              }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: 'var(--c-text-primary)' }}>{summary.repoName}</div>
                <div style={{ fontSize: 10, color: 'var(--c-text-faint)', marginBottom: 6, wordBreak: 'break-all' }}>{summary.repoPath}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, color: 'var(--c-text-base)' }}>
                  <span>🌿 <strong>{summary.branch}</strong></span>
                  <span style={{ color: summary.isDirty ? 'var(--git-warn)' : 'var(--git-add)' }}>
                    {summary.isDirty ? t.git.dirty : t.git.clean}
                  </span>
                  {summary.ahead  > 0 && <span>{t.git.ahead(summary.ahead)}</span>}
                  {summary.behind > 0 && <span>{t.git.behind(summary.behind)}</span>}
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {[
                  { label: t.git.staged,    count: summary.stagedCount,    color: 'var(--git-add)'  },
                  { label: t.git.modified,  count: summary.modifiedCount,  color: 'var(--git-warn)' },
                  { label: t.git.untracked, count: summary.untrackedCount, color: 'var(--git-head)' },
                ].map(({ label, count, color }) => (
                  <div key={label} style={{
                    flex: 1, background: 'var(--c-bg-subtle)', border: '1px solid var(--c-border)',
                    borderRadius: 6, padding: '6px 8px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color }}>{count}</div>
                    <div style={{ fontSize: 10, color: 'var(--c-text-faint)' }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Last commit */}
              {summary.lastCommitMessage && (
                <div style={{
                  background: 'var(--c-bg-subtle)', border: '1px solid var(--c-border)',
                  borderRadius: 6, padding: '8px 10px', marginBottom: 12, fontSize: 11,
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 2, color: 'var(--c-text-primary)' }}>{t.git.lastCommit}</div>
                  <div style={{ color: 'var(--c-text-base)', marginBottom: 2 }}>{summary.lastCommitMessage}</div>
                  <div style={{ color: 'var(--c-text-faint)' }}>{summary.lastCommitAuthor} · {summary.lastCommitAt.slice(0, 10)}</div>
                </div>
              )}

              {/* Changed files */}
              {summary.files.length > 0 ? (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-faint)', marginBottom: 6 }}>
                    {t.git.changedFiles(summary.files.length)}
                  </div>
                  {summary.files.map(f => <FileCard key={f.path} file={f} />)}
                </>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--c-text-faint)', textAlign: 'center', padding: '16px 0' }}>
                  {t.git.noChanges}
                </div>
              )}

              {/* Commit */}
              <div style={{ marginTop: 14, borderTop: '1px solid var(--c-border)', paddingTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: 'var(--c-text-primary)' }}>
                  {t.git.commitStaged}
                </div>
                <textarea
                  value={commitMessage}
                  onChange={e => setCommitMessage(e.target.value)}
                  placeholder={t.git.commitPlaceholder}
                  rows={3}
                  style={{
                    width: '100%', boxSizing: 'border-box', fontSize: 12,
                    padding: '6px 8px', borderRadius: 4, border: '1px solid var(--c-border)',
                    resize: 'vertical', fontFamily: 'inherit', outline: 'none',
                    background: 'var(--c-bg-input)', color: 'var(--c-text-base)',
                  }}
                />
                <button
                  onClick={commit}
                  disabled={committing || !commitMessage.trim() || summary.stagedCount === 0}
                  style={{
                    marginTop: 6, width: '100%', padding: '7px 0', fontSize: 12,
                    fontWeight: 600, borderRadius: 4, border: 'none',
                    background: committing || !commitMessage.trim() || summary.stagedCount === 0
                      ? 'var(--c-border)' : 'var(--git-add)',
                    color: '#fff',
                    cursor: committing || !commitMessage.trim() || summary.stagedCount === 0 ? 'default' : 'pointer',
                  }}
                >
                  {committing ? t.git.committing : t.git.commitBtn(summary.stagedCount)}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
