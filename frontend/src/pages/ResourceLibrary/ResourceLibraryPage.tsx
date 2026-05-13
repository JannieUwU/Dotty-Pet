import { useState, useRef, useEffect, useCallback } from 'react'
import { useT } from '../../i18n'
import { apiFetch, API_BASE } from '../../utils/api'

const API = '/resources'

// ── types ─────────────────────────────────────────────────────────────────────

interface FileItem {
  id: number; name: string; file_type: string; size: string
  date: string; folder_id: number
}

interface Folder {
  id: number; name: string; color: string; count: number
}

// ── constants ─────────────────────────────────────────────────────────────────

const FOLDER_COLORS = ['#83B5B5', '#F9CE9C', '#C1D09D', '#BFC5D5']

const MAX_FILE_BYTES = 200 * 1024 * 1024 // 200 MB — must match backend
const ALLOWED_TYPES = new Set([
  'png','jpg','jpeg','gif','bmp','webp','tiff',
  'pdf','mp4','mov','avi','mkv',
  'docx','doc','xlsx','xls','pptx','ppt',
  'txt','md','zip','rar','7z','csv','json','xml',
])
const UPLOAD_CONCURRENCY = 3 // max simultaneous uploads

const FolderIcon = ({ color, size = 32 }: { color: string; size?: number }) => (
  <svg viewBox="0 0 1260 1024" width={size} height={size * 0.81}>
    <path d="M1171.561 157.538H601.797L570.814 61.44A88.222 88.222 0 0 0 486.794 0H88.747A88.747 88.747 0 0 0 0 88.747v846.506A88.747 88.747 0 0 0 88.747 1024H1171.56a88.747 88.747 0 0 0 88.747-88.747V246.285a88.747 88.747 0 0 0-88.747-88.747z m-1082.814 0V88.747h398.047l22.055 68.791z" fill={color} />
  </svg>
)

const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: '#E8534A', png: '#4A90D9', jpg: '#4A90D9', jpeg: '#4A90D9',
  mp4: '#9B59B6', docx: '#2980B9', xlsx: '#27AE60', pptx: '#E67E22', default: '#95A5A6'
}

const FileTypeIcon = ({ type }: { type: string }) => {
  const color = FILE_TYPE_COLORS[type.toLowerCase()] ?? FILE_TYPE_COLORS.default
  return (
    <div style={{ width: 101, height: 101, borderRadius: 10, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontFamily: 'Inter', fontSize: 15, fontWeight: 700, color: 'white', textTransform: 'uppercase' }}>{type.slice(0, 4)}</span>
    </div>
  )
}

const IMAGE_TYPES = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff'])

const FileThumbnail = ({ file }: { file: FileItem }) => {
  const t = file.file_type.toLowerCase()
  const canThumb = t === 'pdf' || IMAGE_TYPES.has(t)
  const [thumbState, setThumbState] = useState<'loading' | 'ok' | 'fallback'>(canThumb ? 'loading' : 'fallback')

  if (thumbState === 'fallback') {
    return <FileTypeIcon type={file.file_type} />
  }

  return (
    <div style={{ width: 101, height: 101, borderRadius: 10, overflow: 'hidden', background: 'var(--c-bg-muted)', flexShrink: 0, position: 'relative' }}>
      {thumbState === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FileTypeIcon type={file.file_type} />
        </div>
      )}
      <img
        src={`${API}/files/${file.id}/thumb`}
        alt={file.name}
        onLoad={() => setThumbState('ok')}
        onError={() => setThumbState('fallback')}
        style={{
          width: 101, height: 101, objectFit: 'cover',
          visibility: thumbState === 'ok' ? 'visible' : 'hidden',
        }}
      />
    </div>
  )
}

// ── modals ────────────────────────────────────────────────────────────────────

const NewFolderModal = ({ onConfirm, onClose }: { onConfirm: (name: string, color: string) => Promise<void>; onClose: () => void }) => {
  const [name, setName] = useState('')
  const [color, setColor] = useState(FOLDER_COLORS[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const t = useT()

  const submit = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      await onConfirm(name.trim(), color)
      onClose()
    } catch {
      setError(t.resourceLibrary.failCreate)
      setBusy(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--c-bg-card)', borderRadius: 14, padding: '18px 20px', width: 260, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
        <span style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 700, color: 'var(--c-text-primary)' }}>{t.resourceLibrary.newFolder}</span>
        <input autoFocus value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder={t.resourceLibrary.folderName} style={{ height: 30, border: '0.5px solid var(--c-border)', borderRadius: 7, padding: '0 10px', fontFamily: 'Inter', fontSize: 10, outline: 'none', background: 'var(--c-bg-input)', color: 'var(--c-text-base)' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          {FOLDER_COLORS.map(c => (
            <div key={c} onClick={() => setColor(c)} style={{ width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer', border: color === c ? '2.5px solid var(--c-text-primary)' : '2px solid transparent' }} />
          ))}
        </div>
        {error && <span style={{ fontFamily: 'Inter', fontSize: 8, color: '#e05' }}>{error}</span>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <div onClick={onClose} style={{ height: 28, padding: '0 14px', borderRadius: 7, background: 'var(--c-bg-muted)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <span style={{ fontFamily: 'Inter', fontSize: 9, color: 'var(--c-text-muted)' }}>{t.common.cancel}</span>
          </div>
          <div onClick={submit}
            style={{ height: 28, padding: '0 14px', borderRadius: 7, background: 'var(--c-text-primary)', display: 'flex', alignItems: 'center', cursor: name.trim() && !busy ? 'pointer' : 'not-allowed', opacity: name.trim() && !busy ? 1 : 0.4 }}>
            <span style={{ fontFamily: 'Inter', fontSize: 9, fontWeight: 600, color: 'white' }}>{busy ? '...' : t.common.create}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const ContextMenu = ({ x, y, onRename, onDelete, onInfo, onClose }: { x: number; y: number; onRename: () => void; onDelete: () => void; onInfo: () => void; onClose: () => void }) => {
  const t = useT()
  return (
  <>
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={onClose} />
    <div style={{ position: 'fixed', left: x, top: y, background: 'var(--c-bg-card)', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', padding: '4px 0', zIndex: 201, minWidth: 130 }}>
      {[
        { label: t.common.rename, action: onRename },
        { label: t.common.info, action: onInfo },
        { label: t.common.delete, action: onDelete, danger: true },
      ].map(item => (
        <div key={item.label} onClick={() => { item.action(); onClose() }}
          style={{ padding: '7px 14px', fontFamily: 'Inter', fontSize: 9, color: item.danger ? '#ff6b6b' : 'var(--c-text-primary)', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          {item.label}
        </div>
      ))}
    </div>
  </>
  )
}

const InfoModal = ({ lines, onClose }: { lines: string[]; onClose: () => void }) => {
  const t = useT()
  return (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: 'var(--c-bg-card)', borderRadius: 14, padding: '18px 20px', width: 240, display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
      <span style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 700, color: 'var(--c-text-primary)' }}>{t.common.info}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {lines.map((line, i) => {
          const [label, ...rest] = line.split(': ')
          return (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <span style={{ fontFamily: 'Inter', fontSize: 9, color: 'var(--c-text-faint)', width: 48, flexShrink: 0 }}>{label}</span>
              <span style={{ fontFamily: 'Inter', fontSize: 9, color: 'var(--c-text-base)', wordBreak: 'break-all' }}>{rest.join(': ')}</span>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div onClick={onClose} style={{ height: 28, padding: '0 14px', borderRadius: 7, background: 'var(--c-text-primary)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <span style={{ fontFamily: 'Inter', fontSize: 9, fontWeight: 600, color: 'white' }}>{t.common.ok}</span>
        </div>
      </div>
    </div>
  </div>
  )
}

const RenameModal = ({ current, onConfirm, onClose }: { current: string; onConfirm: (n: string) => Promise<void>; onClose: () => void }) => {
  const [name, setName] = useState(current)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const t = useT()

  const submit = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      await onConfirm(name.trim())
      onClose()
    } catch {
      setError(t.resourceLibrary.failRename)
      setBusy(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--c-bg-card)', borderRadius: 14, padding: '18px 20px', width: 240, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
        <span style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 700, color: 'var(--c-text-primary)' }}>{t.common.rename}</span>
        <input autoFocus value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          style={{ height: 30, border: '0.5px solid var(--c-border)', borderRadius: 7, padding: '0 10px', fontFamily: 'Inter', fontSize: 10, outline: 'none', background: 'var(--c-bg-input)', color: 'var(--c-text-base)' }} />
        {error && <span style={{ fontFamily: 'Inter', fontSize: 8, color: '#e05' }}>{error}</span>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <div onClick={onClose} style={{ height: 28, padding: '0 14px', borderRadius: 7, background: 'var(--c-bg-muted)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <span style={{ fontFamily: 'Inter', fontSize: 9, color: 'var(--c-text-muted)' }}>{t.common.cancel}</span>
          </div>
          <div onClick={submit}
            style={{ height: 28, padding: '0 14px', borderRadius: 7, background: 'var(--c-text-primary)', display: 'flex', alignItems: 'center', cursor: name.trim() && !busy ? 'pointer' : 'not-allowed', opacity: name.trim() && !busy ? 1 : 0.4 }}>
            <span style={{ fontFamily: 'Inter', fontSize: 9, fontWeight: 600, color: 'white' }}>{busy ? '...' : t.common.save}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────

export const ResourceLibraryPage = () => {
  const [folders, setFolders] = useState<Folder[]>([])
  const [files, setFiles] = useState<FileItem[]>([])
  const [openFolder, setOpenFolder] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sort, setSort] = useState<'date' | 'name'>('date')
  const [search, setSearch] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [showAddChoice, setShowAddChoice] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: number; kind: 'folder' | 'file' } | null>(null)
  const [renaming, setRenaming] = useState<{ id: number; kind: 'folder' | 'file'; current: string } | null>(null)
  const [infoLines, setInfoLines] = useState<string[] | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0) // track nested dragenter/dragleave to avoid flicker
  const t = useT()

  // Load folders on mount
  useEffect(() => {
    apiFetch(`${API}/folders`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(setFolders)
      .catch(() => {})
  }, [])

  // Load files when folder opens; clear when going back to root
  useEffect(() => {
    if (openFolder === null) { setFiles([]); return }
    apiFetch(`${API}/folders/${openFolder}/files`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(setFiles)
      .catch(() => {})
  }, [openFolder])

  const currentFolder = folders.find(f => f.id === openFolder)

  const displayFiles = files
    .filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : b.date.localeCompare(a.date))

  const displayFolders = folders.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))

  const addFolder = async (name: string, color: string) => {
    const res = await apiFetch(`${API}/folders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    setFolders(fs => [...fs, data])
  }

  const deleteFolder = async (id: number) => {
    try {
      const res = await apiFetch(`${API}/folders/${id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) throw new Error(await res.text())
      setFolders(fs => fs.filter(f => f.id !== id))
      if (openFolder === id) setOpenFolder(null)
    } catch (e) { console.error('Delete folder failed:', e) }
  }

  const renameFolder = async (id: number, name: string) => {
    const res = await apiFetch(`${API}/folders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    setFolders(fs => fs.map(f => f.id === id ? data : f))
  }

  const deleteFile = async (id: number) => {
    try {
      const res = await apiFetch(`${API}/files/${id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) throw new Error(await res.text())
      setFiles(fi => fi.filter(f => f.id !== id))
      setFolders(fs => fs.map(f => f.id === openFolder ? { ...f, count: Math.max(0, f.count - 1) } : f))
    } catch (e) { console.error('Delete file failed:', e) }
  }

  const renameFile = async (id: number, name: string) => {
    const res = await apiFetch(`${API}/files/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    setFiles(fi => fi.map(f => f.id === id ? data : f))
  }

  // useCallback so the ref captured in handleDrop/input onChange is stable
  const importFile = useCallback(async (file: File, targetFolder: number) => {
    // Client-side validation — fast rejection before any network round-trip
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_TYPES.has(ext)) {
      console.warn(`Skipped "${file.name}": file type ".${ext}" is not allowed`)
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      console.warn(`Skipped "${file.name}": exceeds 200 MB limit`)
      return
    }

    const form = new FormData()
    form.append('file', file)
    try {
      const res = await apiFetch(`${API}/folders/${targetFolder}/files`, { method: 'POST', body: form })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      // Only update state if user is still in the same folder
      setOpenFolder(cur => {
        if (cur === targetFolder) {
          setFiles(fi => [data, ...fi])
          setFolders(fs => fs.map(f => f.id === targetFolder ? { ...f, count: f.count + 1 } : f))
        }
        return cur
      })
    } catch (e) { console.error('Import failed:', e) }
  }, [])

  // Upload files with bounded concurrency to avoid saturating the connection
  const importFiles = useCallback(async (fileList: File[], targetFolder: number) => {
    let i = 0
    const worker = async () => {
      while (i < fileList.length) {
        const f = fileList[i++]
        await importFile(f, targetFolder)
      }
    }
    const workers = Array.from({ length: Math.min(UPLOAD_CONCURRENCY, fileList.length) }, worker)
    await Promise.all(workers)
  }, [importFile])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current = 0
    setDragOver(false)
    if (openFolder === null) return
    const target = openFolder
    const fileList = Array.from(e.dataTransfer.files)
    if (!fileList.length) return
    setLoading(true)
    importFiles(fileList, target).finally(() => setLoading(false))
  }

  const onContextMenu = (e: React.MouseEvent, id: number, kind: 'folder' | 'file') => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, id, kind })
  }

  const ctxTarget = contextMenu
    ? (contextMenu.kind === 'folder' ? folders.find(f => f.id === contextMenu.id) : files.find(f => f.id === contextMenu.id))
    : null

  const breadcrumb = openFolder
    ? [{ label: t.resourceLibrary.library, action: () => setOpenFolder(null) }, { label: currentFolder?.name ?? '', action: () => {} }]
    : [{ label: t.resourceLibrary.library, action: () => {} }]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '10px 12px', gap: 8, boxSizing: 'border-box', fontFamily: 'Inter' }}
      onDragEnter={e => { e.preventDefault(); if (openFolder !== null) { dragCounterRef.current++; setDragOver(true) } }}
      onDragOver={e => e.preventDefault()}
      onDragLeave={() => { dragCounterRef.current--; if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; setDragOver(false) } }}
      onDrop={handleDrop}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
          {breadcrumb.map((b, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {i > 0 && <span style={{ fontSize: 9, color: 'var(--c-text-xfaint)' }}>›</span>}
              <span onClick={b.action} style={{ fontSize: 10, fontWeight: i === breadcrumb.length - 1 ? 700 : 400, color: i === breadcrumb.length - 1 ? 'var(--c-text-primary)' : 'var(--c-text-muted)', cursor: i < breadcrumb.length - 1 ? 'pointer' : 'default' }}>{b.label}</span>
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--c-bg-subtle)', borderRadius: 8, padding: '0 8px', height: 26 }}>
          <span style={{ fontSize: 10, color: 'var(--c-text-xfaint)' }}>⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.resourceLibrary.search}
            style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'Inter', fontSize: 9, color: 'var(--c-text-primary)', width: 100 }} />
        </div>

        {openFolder !== null && (
          <>
            <div style={{ display: 'flex', background: 'var(--c-bg-muted)', borderRadius: 7, padding: 2, gap: 2 }}>
              {(['grid', 'list'] as const).map(m => (
                <div key={m} onClick={() => setViewMode(m)} style={{ height: 20, padding: '0 8px', borderRadius: 5, background: viewMode === m ? 'var(--c-bg-card)' : 'transparent', display: 'flex', alignItems: 'center', cursor: 'pointer', boxShadow: viewMode === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                  <span style={{ fontSize: 9, color: 'var(--c-text-primary)' }}>{m === 'grid' ? '⊞' : '☰'}</span>
                </div>
              ))}
            </div>
            <select value={sort} onChange={e => setSort(e.target.value as 'date' | 'name')}
              style={{ height: 24, border: '0.5px solid var(--c-border)', borderRadius: 6, fontFamily: 'Inter', fontSize: 8, color: 'var(--c-text-primary)', padding: '0 4px', outline: 'none', background: 'var(--c-bg-card)' }}>
              <option value="date">{t.resourceLibrary.recent}</option>
              <option value="name">{t.resourceLibrary.name}</option>
            </select>
          </>
        )}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, border: dragOver ? '2px dashed #83B5B5' : '2px solid transparent', borderRadius: 12, transition: 'border 0.15s', position: 'relative' }}>

        {loading && (
          <div style={{ position: 'absolute', top: 8, right: 8, fontFamily: 'Inter', fontSize: 8, color: '#83B5B5' }}>{t.resourceLibrary.importing}</div>
        )}

        {openFolder === null ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12, padding: 4 }}>
            {displayFolders.map(folder => (
              <div key={folder.id} onDoubleClick={() => setOpenFolder(folder.id)}
                onContextMenu={e => onContextMenu(e, folder.id, 'folder')}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', padding: '10px 6px', borderRadius: 10 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <FolderIcon color={folder.color} size={58} />
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--c-text-primary)', textAlign: 'center', maxWidth: 108, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
                <span style={{ fontSize: 10, color: 'var(--c-text-xfaint)' }}>{folder.count} items</span>
              </div>
            ))}

            <div style={{ position: 'relative' }}>
              <div onClick={() => setShowAddChoice(v => !v)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', padding: '10px 6px', borderRadius: 10, border: '1.5px dashed var(--c-border)', minHeight: 90 }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#83B5B5')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--c-border)')}>
                <span style={{ fontSize: 22, color: 'var(--c-text-xfaint)', lineHeight: 1 }}>+</span>
                <span style={{ fontSize: 8, color: 'var(--c-text-xfaint)' }}>{t.resourceLibrary.newBtn}</span>
              </div>
              {showAddChoice && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setShowAddChoice(false)} />
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, background: 'var(--c-bg-card)', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', padding: '4px 0', zIndex: 101, minWidth: 130 }}>
                    <div onClick={() => { setShowNewFolder(true); setShowAddChoice(false) }}
                      style={{ padding: '7px 14px', fontFamily: 'Inter', fontSize: 9, color: 'var(--c-text-primary)', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      {t.resourceLibrary.newFolder}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, padding: 4 }}>
            {displayFiles.map(file => (
              <div key={file.id}
                onClick={() => apiFetch(`${API}/files/${file.id}/open`, { method: 'POST' })}
                onContextMenu={e => onContextMenu(e, file.id, 'file')}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', padding: '10px 6px', borderRadius: 10, position: 'relative' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <FileThumbnail key={file.id} file={file} />
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--c-text-primary)', textAlign: 'center', maxWidth: 123, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                <span style={{ fontSize: 10, color: 'var(--c-text-xfaint)' }}>{file.size}</span>
              </div>
            ))}
            <div onClick={() => fileInputRef.current?.click()}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', padding: '10px 6px', borderRadius: 10, border: '1.5px dashed var(--c-border)', minHeight: 80 }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#83B5B5')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--c-border)')}>
              <span style={{ fontSize: 20, color: 'var(--c-text-xfaint)', lineHeight: 1 }}>+</span>
              <span style={{ fontSize: 7, color: 'var(--c-text-xfaint)' }}>{t.resourceLibrary.importBtn}</span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px 80px', padding: '4px 10px', borderBottom: '0.5px solid var(--c-border-xlight)' }}>
              {[t.resourceLibrary.name, t.resourceLibrary.type, t.resourceLibrary.size, t.resourceLibrary.date].map(h => (
                <span key={h} style={{ fontSize: 8, fontWeight: 600, color: 'var(--c-text-xfaint)', textTransform: 'uppercase' }}>{h}</span>
              ))}
            </div>
            {displayFiles.map(file => (
              <div key={file.id}
                onClick={() => apiFetch(`${API}/files/${file.id}/open`, { method: 'POST' })}
                onContextMenu={e => onContextMenu(e, file.id, 'file')}
                style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px 80px', padding: '7px 10px', borderRadius: 6, cursor: 'pointer', alignItems: 'center' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <span style={{ fontSize: 9, color: 'var(--c-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                <span style={{ fontSize: 8, color: 'var(--c-text-muted)', textTransform: 'uppercase' }}>{file.file_type}</span>
                <span style={{ fontSize: 8, color: 'var(--c-text-muted)' }}>{file.size}</span>
                <span style={{ fontSize: 8, color: 'var(--c-text-muted)' }}>{file.date}</span>
              </div>
            ))}
            <div onClick={() => fileInputRef.current?.click()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 6, cursor: 'pointer', border: '1px dashed var(--c-border)', margin: '4px 0' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#83B5B5')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--c-border)')}>
              <span style={{ fontSize: 12, color: 'var(--c-text-xfaint)' }}>+</span>
              <span style={{ fontSize: 8, color: 'var(--c-text-xfaint)' }}>{t.resourceLibrary.importFile}</span>
            </div>
          </div>
        )}
      </div>

      {dragOver && openFolder !== null && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(131,181,181,0.1)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontFamily: 'Inter', fontSize: 11, color: '#83B5B5', fontWeight: 600 }}>{t.resourceLibrary.dropToImport}</span>
        </div>
      )}

      <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }}
        onChange={e => {
          const fileList = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (!fileList.length || openFolder === null) return
          const target = openFolder
          setLoading(true)
          importFiles(fileList, target).finally(() => setLoading(false))
        }} />

      {showNewFolder && <NewFolderModal onConfirm={addFolder} onClose={() => setShowNewFolder(false)} />}
      {renaming && (
        <RenameModal current={renaming.current}
          onConfirm={name => renaming.kind === 'folder' ? renameFolder(renaming.id, name) : renameFile(renaming.id, name)}
          onClose={() => setRenaming(null)} />
      )}
      {infoLines && <InfoModal lines={infoLines} onClose={() => setInfoLines(null)} />}
      {contextMenu && ctxTarget && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y}
          onRename={() => setRenaming({ id: contextMenu.id, kind: contextMenu.kind, current: ctxTarget.name })}
          onDelete={() => contextMenu.kind === 'folder' ? deleteFolder(contextMenu.id) : deleteFile(contextMenu.id)}
          onInfo={() => {
            const f = ctxTarget
            if ('file_type' in f) {
              setInfoLines([`Name: ${f.name}`, `Type: ${f.file_type}`, `Size: ${(f as FileItem).size}`, `Date: ${(f as FileItem).date}`])
            } else {
              setInfoLines([`Name: ${f.name}`, `Items: ${(f as Folder).count}`])
            }
          }}
          onClose={() => setContextMenu(null)} />
      )}
    </div>
  )
}
