import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuthStore } from '../../store/authStore'
import { getAvatarColor, getAvatarInitial } from '../../utils/avatar'

// LoginPage — rendered as a full-screen standalone window (no backdrop, no drag).
// Shown by Electron when the user is not logged in. The window is 420x560, frameless.

const MAX_AVATAR_SIZE_BYTES = 10 * 1024 * 1024
const CROP_OUTPUT_SIZE = 320
const CROP_PREVIEW_SIZE = 160
const MIN_CROP_ZOOM = 0.01
const MAX_CROP_ZOOM = 5

type CropImageSize = { width: number; height: number }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const getContainedCropImageSize = (naturalWidth: number, naturalHeight: number, zoom: number) => {
  if (!naturalWidth || !naturalHeight) return { width: CROP_PREVIEW_SIZE * zoom, height: CROP_PREVIEW_SIZE * zoom }
  const aspectRatio = naturalWidth / naturalHeight
  if (aspectRatio >= 1) return { width: CROP_PREVIEW_SIZE * zoom, height: (CROP_PREVIEW_SIZE / aspectRatio) * zoom }
  return { width: CROP_PREVIEW_SIZE * aspectRatio * zoom, height: CROP_PREVIEW_SIZE * zoom }
}

const getMaxCropOffset = (imageSize: CropImageSize) => ({
  x: Math.max(0, (imageSize.width - CROP_PREVIEW_SIZE) / 2),
  y: Math.max(0, (imageSize.height - CROP_PREVIEW_SIZE) / 2),
})

const clampCropOffset = (value: number, axis: 'x' | 'y', imageSize: CropImageSize) => {
  const maxOffset = getMaxCropOffset(imageSize)[axis]
  return clamp(value, -maxOffset, maxOffset)
}

export const LoginPage = () => {
  const cropDragStateRef = useRef<{ startX: number; startY: number; startCropX: number; startCropY: number } | null>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarDataUrl, setAvatarDataUrl] = useState('')
  const [avatarError, setAvatarError] = useState('')
  const [cropImageSrc, setCropImageSrc] = useState('')
  const [cropImageSize, setCropImageSize] = useState<CropImageSize>({ width: 0, height: 0 })
  const [cropZoom, setCropZoom] = useState(1)
  const [cropX, setCropX] = useState(0)
  const [cropY, setCropY] = useState(0)
  const [emailFocused, setEmailFocused] = useState(false)

  const { rememberedAccounts, mode, error, setMode, login, register, clearError } = useAuthStore()

  useEffect(() => {
    window.setTimeout(() => emailInputRef.current?.focus(), 80)
  }, [])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const s = cropDragStateRef.current
      if (!s) return
      const previewImageSize = getContainedCropImageSize(cropImageSize.width, cropImageSize.height, cropZoom)
      setCropX(clampCropOffset(s.startCropX + event.clientX - s.startX, 'x', previewImageSize))
      setCropY(clampCropOffset(s.startCropY + event.clientY - s.startY, 'y', previewImageSize))
    }
    const handlePointerUp = () => { cropDragStateRef.current = null }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [cropZoom, cropImageSize])

  const filteredAccounts = rememberedAccounts.filter((account) => {
    if (mode !== 'login') return false
    const q = email.trim().toLowerCase()
    if (!q) return true
    return account.email.toLowerCase().includes(q) || account.name.toLowerCase().includes(q)
  })
  const showSuggestions = mode === 'login' && emailFocused && filteredAccounts.length > 0

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (mode === 'login') {
      login({ email, password })
    } else {
      register({ email, password, displayName, avatarDataUrl })
    }
  }

  const switchMode = (next: 'login' | 'register') => {
    clearError()
    setEmail(''); setPassword(''); setDisplayName('')
    setAvatarDataUrl(''); setAvatarError('')
    setCropImageSrc(''); setCropImageSize({ width: 0, height: 0 })
    setCropZoom(1); setCropX(0); setCropY(0); setEmailFocused(false)
    setMode(next)
  }

  const beginAvatarCrop = (file: File) => {
    clearError(); setAvatarError('')
    if (!file.type.startsWith('image/')) { setAvatarError('Please choose an image file.'); return }
    if (file.size > MAX_AVATAR_SIZE_BYTES) { setAvatarError('Image must be smaller than 10 MB.'); return }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      const img = new Image()
      img.onerror = () => setAvatarError('Could not load this image.')
      img.onload = () => {
        setCropImageSrc(reader.result as string)
        setCropImageSize({ width: img.naturalWidth, height: img.naturalHeight })
        setCropZoom(1); setCropX(0); setCropY(0)
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  }

  const applyCrop = () => {
    if (!cropImageSrc) return
    const img = new Image()
    img.onerror = () => { setAvatarError('Could not load image.'); setCropImageSrc('') }
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = CROP_OUTPUT_SIZE; canvas.height = CROP_OUTPUT_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const previewSize = getContainedCropImageSize(img.naturalWidth, img.naturalHeight, cropZoom)
      const scale = CROP_OUTPUT_SIZE / CROP_PREVIEW_SIZE
      const w = previewSize.width * scale, h = previewSize.height * scale
      const x = (CROP_OUTPUT_SIZE - w) / 2 + cropX * scale
      const y = (CROP_OUTPUT_SIZE - h) / 2 + cropY * scale
      ctx.drawImage(img, x, y, w, h)
      setAvatarDataUrl(canvas.toDataURL('image/png'))
      setCropImageSrc(''); setCropImageSize({ width: 0, height: 0 })
      setCropZoom(1); setCropX(0); setCropY(0)
    }
    img.src = cropImageSrc
  }

  const setCropZoomPercent = (value: number) => {
    if (Number.isNaN(value)) return
    const nextZoom = clamp(value / 100, MIN_CROP_ZOOM, MAX_CROP_ZOOM)
    const nextSize = getContainedCropImageSize(cropImageSize.width, cropImageSize.height, nextZoom)
    setCropZoom(nextZoom)
    setCropX(cur => clampCropOffset(cur, 'x', nextSize))
    setCropY(cur => clampCropOffset(cur, 'y', nextSize))
  }

  const cropBaseSize = getContainedCropImageSize(cropImageSize.width, cropImageSize.height, 1)

  return (
    <div style={{
      width: '100%', height: '100%', background: '#F9FAFB',
      display: 'flex', flexDirection: 'column',
      // @ts-ignore — Electron drag region
      WebkitAppRegion: 'drag',
    }}>
      {/* Frameless title bar */}
      <div style={{
        height: 36, flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 12px',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.3px', pointerEvents: 'none' }}>
          Dotty Pet
        </span>
        <button
          onClick={() => window.electron?.close?.()}
          style={{
            // @ts-ignore
            WebkitAppRegion: 'no-drag',
            width: 28, height: 28, border: 'none', background: 'transparent',
            cursor: 'pointer', borderRadius: 6, color: '#9CA3AF', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#e81123'; (e.currentTarget as HTMLButtonElement).style.color = 'white' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF' }}
        >
          &#x2715;
        </button>
      </div>

      {/* Scrollable content area */}
      <div style={{
        flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'flex-start',
        justifyContent: 'center', padding: '8px 32px 24px',
        // @ts-ignore
        WebkitAppRegion: 'no-drag',
      }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          {/* Heading */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 22, fontWeight: 850, color: '#111827', letterSpacing: '-0.3px' }}>
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 5 }}>
              {mode === 'login' ? 'Sign in to your local account.' : 'Register a local account on this device.'}
            </div>
          </div>

          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 6, background: '#F3F4F6', borderRadius: 10, padding: 4, marginBottom: 18 }}>
            {(['login', 'register'] as const).map(m => (
              <button key={m} type="button" onClick={() => switchMode(m)} style={{
                flex: 1, height: 30, borderRadius: 7, border: 'none',
                background: mode === m ? '#FFFFFF' : 'transparent',
                color: mode === m ? '#111827' : '#6B7280',
                boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer', fontSize: 12, fontWeight: 700,
              }}>
                {m === 'login' ? 'Sign in' : 'Register'}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '0.5px solid rgba(239,68,68,0.26)',
              color: '#A32020', borderRadius: 9, padding: '8px 11px',
              fontSize: 11, lineHeight: 1.6, marginBottom: 14,
            }}>
              {error}
            </div>
          )}

          {/* Crop UI */}
          {cropImageSrc && (
            <div style={{ border: '0.5px solid #E0E0E0', borderRadius: 12, padding: 10, marginBottom: 14, background: '#FAFAFA' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#333' }}>Crop avatar</div>
                <input type="range" min="1" max="500" step="1" value={Math.round(cropZoom * 100)}
                  onChange={e => setCropZoomPercent(Number(e.target.value))}
                  style={{ width: 100, accentColor: '#1F2937', cursor: 'pointer' }} />
              </div>
              <div style={{
                width: CROP_PREVIEW_SIZE, height: CROP_PREVIEW_SIZE, borderRadius: 10,
                overflow: 'hidden', background: '#E5E7EB', margin: '0 auto 8px',
                position: 'relative', cursor: 'grab', touchAction: 'none',
              }}
                onPointerDown={e => { e.preventDefault(); cropDragStateRef.current = { startX: e.clientX, startY: e.clientY, startCropX: cropX, startCropY: cropY } }}>
                <div style={{ position: 'absolute', left: '50%', top: '50%', width: cropBaseSize.width, height: cropBaseSize.height, pointerEvents: 'none', transform: `translate(calc(-50% + ${cropX}px), calc(-50% + ${cropY}px))` }}>
                  <img src={cropImageSrc} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none', transform: `scale(${cropZoom})`, transformOrigin: 'center' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={applyCrop} style={{ flex: 1, height: 30, borderRadius: 8, border: 'none', background: '#1F2937', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 800 }}>Use crop</button>
                <button type="button" onClick={() => { setCropImageSrc(''); setCropImageSize({ width: 0, height: 0 }) }} style={{ flex: 1, height: 30, borderRadius: 8, border: '0.5px solid #D6D6D6', background: '#fff', color: '#333', cursor: 'pointer', fontSize: 11, fontWeight: 800 }}>Cancel</button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#374151', fontWeight: 700, marginBottom: 5 }}>Email</div>
              <div style={{ position: 'relative' }}>
                <input
                  ref={emailInputRef}
                  value={email}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => window.setTimeout(() => setEmailFocused(false), 120)}
                  onChange={e => { clearError(); setEmail(e.target.value); setEmailFocused(true) }}
                  placeholder="you@example.com"
                  style={{ width: '100%', height: 38, borderRadius: 9, border: '1px solid #D1D5DB', padding: '0 12px', outline: 'none', fontSize: 12, boxSizing: 'border-box', background: '#fff' }}
                />
                {showSuggestions && (
                  <div style={{ position: 'absolute', top: 42, left: 0, right: 0, background: '#fff', border: '0.5px solid #DADADA', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.10)', overflow: 'hidden', zIndex: 10 }}>
                    {filteredAccounts.map(account => (
                      <button key={account.id} type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { clearError(); setEmail(account.email); setEmailFocused(false) }}
                        style={{ width: '100%', border: 'none', background: '#fff', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ width: 24, height: 24, borderRadius: '50%', background: account.avatarDataUrl ? `url(${account.avatarDataUrl}) center/cover` : getAvatarColor(account.email), color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 850, flexShrink: 0 }}>
                          {account.avatarDataUrl ? '' : getAvatarInitial(account.name)}
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#111' }}>{account.name}</span>
                          <span style={{ display: 'block', fontSize: 10, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{account.email}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: mode === 'register' ? 12 : 20 }}>
              <div style={{ fontSize: 11, color: '#374151', fontWeight: 700, marginBottom: 5 }}>Password</div>
              <input value={password} type="password"
                onChange={e => { clearError(); setPassword(e.target.value) }}
                placeholder="At least 6 characters"
                style={{ width: '100%', height: 38, borderRadius: 9, border: '1px solid #D1D5DB', padding: '0 12px', outline: 'none', fontSize: 12, boxSizing: 'border-box', background: '#fff' }} />
            </div>

            {mode === 'register' && (
              <>
                {/* Username */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: '#374151', fontWeight: 700, marginBottom: 5 }}>
                    Username <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span>
                  </div>
                  <input value={displayName}
                    onChange={e => { clearError(); setDisplayName(e.target.value) }}
                    placeholder="Letters, numbers, underscore"
                    style={{ width: '100%', height: 38, borderRadius: 9, border: '1px solid #D1D5DB', padding: '0 12px', outline: 'none', fontSize: 12, boxSizing: 'border-box', background: '#fff' }} />
                </div>

                {/* Avatar */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: '#374151', fontWeight: 700, marginBottom: 5 }}>
                    Avatar <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, border: '1px solid #E5E7EB', borderRadius: 10, background: '#FAFAFA' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: avatarDataUrl ? `url(${avatarDataUrl}) center/cover` : getAvatarColor(displayName || email), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 850 }}>
                      {avatarDataUrl ? '' : getAvatarInitial(displayName || email)}
                    </div>
                    <label style={{ height: 30, padding: '0 10px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: '#fff', color: '#374151', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                      Choose image
                      <input type="file" accept="image/*" onChange={e => { if (e.target.files?.[0]) beginAvatarCrop(e.target.files[0]); e.currentTarget.value = '' }} style={{ display: 'none' }} />
                    </label>
                    {avatarDataUrl && (
                      <button type="button" onClick={() => setAvatarDataUrl('')} style={{ height: 30, padding: '0 8px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: '#fff', color: '#6B7280', cursor: 'pointer', fontSize: 11 }}>Remove</button>
                    )}
                  </div>
                  {avatarError && <div style={{ fontSize: 10, color: '#A32020', marginTop: 5 }}>{avatarError}</div>}
                </div>
              </>
            )}

            <button type="submit" style={{ width: '100%', height: 40, borderRadius: 10, border: 'none', background: '#1F2937', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
