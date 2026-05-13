import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuthStore, isStrongPassword } from '../../store/authStore'
import { getAvatarColor, getAvatarInitial } from '../../utils/avatar'
import { useT } from '../../i18n'
import { API_BASE } from '../../utils/api'

const MAX_AVATAR_SIZE_BYTES = 10 * 1024 * 1024
const CROP_OUTPUT_SIZE = 320
const CROP_PREVIEW_SIZE = 170
const MIN_CROP_ZOOM = 0.01
const MAX_CROP_ZOOM = 5
const RESEND_COOLDOWN = 120

type CropTarget = 'register' | 'account'
type CropImageSize = {
  width: number
  height: number
}

const clamp = (value: number, min: number, max: number) => (
  Math.min(max, Math.max(min, value))
)

const getContainedCropImageSize = (
  naturalWidth: number,
  naturalHeight: number,
  zoom: number,
) => {
  if (!naturalWidth || !naturalHeight) {
    return {
      width: CROP_PREVIEW_SIZE * zoom,
      height: CROP_PREVIEW_SIZE * zoom,
    }
  }

  const aspectRatio = naturalWidth / naturalHeight
  if (aspectRatio >= 1) {
    return {
      width: CROP_PREVIEW_SIZE * zoom,
      height: (CROP_PREVIEW_SIZE / aspectRatio) * zoom,
    }
  }

  return {
    width: CROP_PREVIEW_SIZE * aspectRatio * zoom,
    height: CROP_PREVIEW_SIZE * zoom,
  }
}

const getMaxCropOffset = (imageSize: CropImageSize) => ({
  x: Math.max(0, (imageSize.width - CROP_PREVIEW_SIZE) / 2),
  y: Math.max(0, (imageSize.height - CROP_PREVIEW_SIZE) / 2),
})

const clampCropOffset = (
  value: number,
  axis: 'x' | 'y',
  imageSize: CropImageSize,
) => {
  const maxOffset = getMaxCropOffset(imageSize)[axis]
  return clamp(value, -maxOffset, maxOffset)
}

export const LoginModal = ({ forceOpen = false }: { forceOpen?: boolean }) => {
  const emailInputRef = useRef<HTMLInputElement>(null)
  const t = useT()
  const dragStateRef = useRef<{
    startX: number
    startY: number
    startLeft: number
    startTop: number
  } | null>(null)
  const cropDragStateRef = useRef<{
    startX: number
    startY: number
    startCropX: number
    startCropY: number
  } | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [accountName, setAccountName] = useState('')
  const [avatarDataUrl, setAvatarDataUrl] = useState('')
  const [avatarError, setAvatarError] = useState('')
  const [cropImageSrc, setCropImageSrc] = useState('')
  const [cropImageSize, setCropImageSize] = useState<CropImageSize>({ width: 0, height: 0 })
  const [cropTarget, setCropTarget] = useState<CropTarget>('register')
  const [cropZoom, setCropZoom] = useState(1)
  const [cropX, setCropX] = useState(0)
  const [cropY, setCropY] = useState(0)
  const [emailFocused, setEmailFocused] = useState(false)
  const [position, setPosition] = useState({ left: 360, top: 118 })
  const [verificationCode, setVerificationCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [codeVerified, setCodeVerified] = useState(false)
  const [sendCooldown, setSendCooldown] = useState(0)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Change-password sub-view state
  const [changingPassword, setChangingPassword] = useState(false)
  const [cpCurrentPw, setCpCurrentPw] = useState('')
  const [cpCurrentPwOk, setCpCurrentPwOk] = useState(false)
  const [cpCode, setCpCode] = useState('')
  const [cpCodeOk, setCpCodeOk] = useState(false)
  const [cpCodeSent, setCpCodeSent] = useState(false)
  const [cpCooldown, setCpCooldown] = useState(0)
  const cpCooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [cpNewPw, setCpNewPw] = useState('')
  const [cpConfirmPw, setCpConfirmPw] = useState('')
  const [cpSuccess, setCpSuccess] = useState(false)
  const {
    user,
    rememberedAccounts,
    isLoginOpen,
    mode,
    error,
    closeLogin,
    setMode,
    login,
    register,
    sendVerificationCode,
    verifyCode,
    changePassword,
    updateAvatar,
    updateName,
    logout,
    clearError,
  } = useAuthStore()

  // Keep accountName in sync with the current user's name
  useEffect(() => {
    if (user) setAccountName(user.name)
  }, [user?.name])

  useEffect(() => {
    if (!isLoginOpen) return
    setEmail('')
    setPassword('')
    setDisplayName('')
    setAccountName(user?.name ?? '')
    setAvatarDataUrl('')
    setAvatarError('')
    setCropImageSrc('')
    setCropImageSize({ width: 0, height: 0 })
    setCropZoom(1)
    setCropX(0)
    setCropY(0)
    setEmailFocused(false)
    setVerificationCode('')
    setCodeSent(false)
    setCodeVerified(false)
    setSendCooldown(0)
    if (cooldownRef.current) clearInterval(cooldownRef.current)
    setChangingPassword(false)
    setCpCurrentPw('')
    setCpCurrentPwOk(false)
    setCpCode('')
    setCpCodeOk(false)
    setCpCodeSent(false)
    setCpCooldown(0)
    if (cpCooldownRef.current) clearInterval(cpCooldownRef.current)
    setCpNewPw('')
    setCpConfirmPw('')
    setCpSuccess(false)
    if (!user) {
      window.setTimeout(() => emailInputRef.current?.focus(), 0)
    }
  }, [isLoginOpen, user])

  useEffect(() => {
    if (!isLoginOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!forceOpen) closeLogin()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isLoginOpen, closeLogin, forceOpen])

  useEffect(() => {
    if (!isLoginOpen) return

    const handlePointerMove = (event: PointerEvent) => {
      const cropDragState = cropDragStateRef.current
      if (cropDragState) {
        const previewImageSize = getContainedCropImageSize(
          cropImageSize.width,
          cropImageSize.height,
          cropZoom,
        )
        setCropX(clampCropOffset(
          cropDragState.startCropX + event.clientX - cropDragState.startX,
          'x',
          previewImageSize,
        ))
        setCropY(clampCropOffset(
          cropDragState.startCropY + event.clientY - cropDragState.startY,
          'y',
          previewImageSize,
        ))
        return
      }

      const dragState = dragStateRef.current
      if (!dragState) return

      setPosition({
        left: Math.min(window.innerWidth - 400, Math.max(10, dragState.startLeft + event.clientX - dragState.startX)),
        top: Math.min(window.innerHeight - 60, Math.max(10, dragState.startTop + event.clientY - dragState.startY)),
      })
    }

    const handlePointerUp = () => {
      dragStateRef.current = null
      cropDragStateRef.current = null
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isLoginOpen, cropZoom, cropImageSize])

  if (!isLoginOpen) return null

  const filteredAccounts = rememberedAccounts.filter((account) => {
    if (mode !== 'login') return false

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) return true

    return (
      account.email.toLowerCase().includes(normalizedEmail) ||
      account.name.toLowerCase().includes(normalizedEmail)
    )
  })

  const showAccountSuggestions =
    !user &&
    mode === 'login' &&
    emailFocused &&
    filteredAccounts.length > 0

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    const success = mode === 'login'
      ? login({ email, password })
      : register({ email, password, displayName, avatarDataUrl, codeVerified })

    if (success) {
      setEmail('')
      setPassword('')
      setDisplayName('')
      setAccountName('')
      setAvatarDataUrl('')
      setAvatarError('')
      setVerificationCode('')
      setCodeSent(false)
      setCodeVerified(false)
      setSendCooldown(0)
      if (cooldownRef.current) clearInterval(cooldownRef.current)
    }
  }

  const handleVerifyCode = async () => {
    const ok = await verifyCode(email, verificationCode)
    if (ok) setCodeVerified(true)
  }

  const handleSendCode = async () => {
    await sendVerificationCode(email)
    // Only start countdown if no error was set
    const { error: currentError } = useAuthStore.getState()
    if (!currentError) {
      setCodeSent(true)
      setSendCooldown(RESEND_COOLDOWN)
      if (cooldownRef.current) clearInterval(cooldownRef.current)
      cooldownRef.current = setInterval(() => {
        setSendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(cooldownRef.current!)
            cooldownRef.current = null
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
  }

  // ── Change-password helpers ──────────────────────────────────────────────

  const handleCpVerifyCurrentPw = () => {
    clearError()
    const accounts = (() => {
      try {
        const raw = window.localStorage.getItem('dotty-pet-auth-accounts')
        return raw ? JSON.parse(raw) : []
      } catch { return [] }
    })()
    const account = accounts.find((a: { email: string; password: string }) =>
      user && a.email.toLowerCase() === user.email.toLowerCase()
    )
    if (!account || account.password !== cpCurrentPw) {
      useAuthStore.setState({ error: 'Current password is incorrect.' })
      return
    }
    setCpCurrentPwOk(true)
  }

  const handleCpSendCode = async () => {
    if (!user) return
    await sendVerificationCode(user.email)
    const { error: currentError } = useAuthStore.getState()
    if (!currentError) {
      setCpCodeSent(true)
      setCpCooldown(RESEND_COOLDOWN)
      if (cpCooldownRef.current) clearInterval(cpCooldownRef.current)
      cpCooldownRef.current = setInterval(() => {
        setCpCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(cpCooldownRef.current!)
            cpCooldownRef.current = null
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
  }

  const handleCpVerifyCode = async () => {
    if (!user) return
    clearError()
    try {
      const res = await fetch(`${API_BASE}/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, code: cpCode.trim() }),
      })
      if (res.ok) {
        setCpCodeOk(true)
      } else {
        const data = await res.json().catch(() => ({}))
        useAuthStore.setState({ error: (data as { detail?: string }).detail ?? t.auth.codeInvalid })
      }
    } catch {
      useAuthStore.setState({ error: 'Could not reach the server. Please check your connection.' })
    }
  }

  const handleCpSubmit = async (event: FormEvent) => {
    event.preventDefault()
    clearError()
    if (cpNewPw !== cpConfirmPw) {
      useAuthStore.setState({ error: t.auth.passwordMismatch })
      return
    }
    if (!isStrongPassword(cpNewPw)) {
      useAuthStore.setState({ error: t.auth.passwordWeak })
      return
    }
    // Code was already verified and consumed in handleCpVerifyCode.
    // Pass codePreVerified:true so changePassword skips the network call.
    const ok = await changePassword({
      currentPassword: cpCurrentPw,
      verificationCode: '',
      newPassword: cpNewPw,
      codePreVerified: true,
    })
    if (ok) setCpSuccess(true)
  }

  const handleExitChangePw = () => {
    setChangingPassword(false)
    setCpCurrentPw('')
    setCpCurrentPwOk(false)
    setCpCode('')
    setCpCodeOk(false)
    setCpCodeSent(false)
    setCpCooldown(0)
    if (cpCooldownRef.current) clearInterval(cpCooldownRef.current)
    setCpNewPw('')
    setCpConfirmPw('')
    setCpSuccess(false)
    clearError()
  }

  const beginAvatarCrop = (file: File, target: CropTarget) => {
    clearError()
    setAvatarError('')

    if (!file.type.startsWith('image/')) {
      setAvatarError(t.auth.errNotImage)
      return
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setAvatarError(t.auth.errTooLarge)
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const image = new Image()
        image.onerror = () => {
          setAvatarError(t.auth.errLoadFail)
        }
        image.onload = () => {
          setCropImageSrc(reader.result as string)
          setCropImageSize({
            width: image.naturalWidth,
            height: image.naturalHeight,
          })
          setCropTarget(target)
          setCropZoom(1)
          setCropX(0)
          setCropY(0)
        }
        image.src = reader.result
      }
    }
    reader.readAsDataURL(file)
  }

  const handleAvatarFileChange = (file?: File) => {
    if (!file) return
    beginAvatarCrop(file, 'register')
  }

  const handleAccountAvatarFileChange = (file?: File) => {
    if (!file) return
    beginAvatarCrop(file, 'account')
  }

  const applyCrop = () => {
    if (!cropImageSrc) return

    const image = new Image()
    image.onerror = () => {
      setAvatarError(t.auth.errLoadFail)
      setCropImageSrc('')
    }
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = CROP_OUTPUT_SIZE
      canvas.height = CROP_OUTPUT_SIZE

      const context = canvas.getContext('2d')
      if (!context) return

      const previewImageSize = getContainedCropImageSize(
        image.naturalWidth,
        image.naturalHeight,
        cropZoom,
      )
      const outputScale = CROP_OUTPUT_SIZE / CROP_PREVIEW_SIZE
      const outputWidth = previewImageSize.width * outputScale
      const outputHeight = previewImageSize.height * outputScale
      const outputX = (CROP_OUTPUT_SIZE - outputWidth) / 2 + cropX * outputScale
      const outputY = (CROP_OUTPUT_SIZE - outputHeight) / 2 + cropY * outputScale

      context.drawImage(image, outputX, outputY, outputWidth, outputHeight)

      const croppedDataUrl = canvas.toDataURL('image/png')
      if (cropTarget === 'account') {
        updateAvatar(croppedDataUrl)
      } else {
        setAvatarDataUrl(croppedDataUrl)
      }

      setCropImageSrc('')
      setCropImageSize({ width: 0, height: 0 })
      setCropZoom(1)
      setCropX(0)
      setCropY(0)
    }
    image.src = cropImageSrc
  }

  const setCropZoomPercent = (value: number) => {
    if (Number.isNaN(value)) return

    const nextZoom = clamp(value / 100, MIN_CROP_ZOOM, MAX_CROP_ZOOM)
    const nextPreviewImageSize = getContainedCropImageSize(
      cropImageSize.width,
      cropImageSize.height,
      nextZoom,
    )
    setCropZoom(nextZoom)
    setCropX((current) => clampCropOffset(current, 'x', nextPreviewImageSize))
    setCropY((current) => clampCropOffset(current, 'y', nextPreviewImageSize))
  }

  const handleSaveUsername = () => {
    if (updateName(accountName)) {
      setAccountName(accountName.trim())
    }
  }

  const cropBaseImageSize = getContainedCropImageSize(
    cropImageSize.width,
    cropImageSize.height,
    1,
  )

  return (
    <>
      <div
        onClick={forceOpen ? undefined : closeLogin}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(17, 24, 39, 0.24)',
          zIndex: 40,
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'absolute',
          left: position.left,
          top: position.top,
          width: 380,
          height: 520,
          background: 'var(--c-bg-card)',
          borderRadius: 18,
          border: '0.5px solid var(--c-border)',
          boxShadow: '0 28px 80px rgba(15, 23, 42, 0.22)',
          zIndex: 41,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: '22px 22px 18px',
          cursor: 'grab',
          userSelect: 'none',
          flexShrink: 0,
        }}>
          <div
            onPointerDown={(event) => {
              dragStateRef.current = {
                startX: event.clientX,
                startY: event.clientY,
                startLeft: position.left,
                startTop: position.top,
              }
            }}
            style={{ minWidth: 0, flex: 1 }}
          >
            <div style={{ fontSize: 18, fontWeight: 850, color: 'var(--c-text-base)' }}>
              {user ? t.auth.account : mode === 'login' ? t.auth.signIn : t.auth.createAccount}
            </div>
            <div style={{ fontSize: 11, color: 'var(--c-text-secondary)', marginTop: 4, lineHeight: 1.6 }}>
              {user
                ? t.auth.manageAccount
                : mode === 'login'
                  ? t.auth.useAccount
                  : t.auth.registerAccount}
            </div>
          </div>

          {!forceOpen && (
            <button
              type="button"
              onClick={closeLogin}
              style={{
                border: 'none',
                background: 'var(--c-bg-hover)',
                width: 30,
                height: 30,
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 18,
                color: 'var(--c-text-secondary)',
                flexShrink: 0,
              }}
            >
              ×
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 22px 22px' }}>        {cropImageSrc && (
          <div style={{
            border: '0.5px solid var(--c-border)',
            borderRadius: 14,
            padding: 12,
            marginBottom: 14,
            background: 'var(--c-bg-subtle)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              marginBottom: 10,
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 850, color: 'var(--c-text-base)' }}>
                  {t.auth.cropAvatar}
                </div>
                <div style={{ fontSize: 10, color: 'var(--c-text-secondary)', marginTop: 3 }}>
                  {t.auth.dragToReposition}
                </div>
              </div>
              <div style={{ width: 132 }}>
                <label style={{
                  height: 28,
                  borderRadius: 8,
                  border: '0.5px solid var(--c-border)',
                  background: 'var(--c-bg-card)',
                  padding: '0 7px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 3,
                  fontSize: 11,
                  color: 'var(--c-text-base)',
                  fontWeight: 800,
                  boxSizing: 'border-box',
                }}>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    step="1"
                    value={Math.round(cropZoom * 100)}
                    onChange={(event) => setCropZoomPercent(Number(event.target.value))}
                    style={{
                      width: 48,
                      border: 'none',
                      outline: 'none',
                      fontSize: 11,
                      fontWeight: 800,
                      color: 'var(--c-text-base)',
                      textAlign: 'right',
                      background: 'transparent',
                    }}
                  />
                  %
                </label>
                <input
                  type="range"
                  min="1"
                  max="500"
                  step="1"
                  value={Math.round(cropZoom * 100)}
                  onChange={(event) => setCropZoomPercent(Number(event.target.value))}
                  style={{
                    width: '100%',
                    marginTop: 6,
                    accentColor: '#1F2937',
                    cursor: 'pointer',
                  }}
                />
              </div>
            </div>
            <div style={{
              width: CROP_PREVIEW_SIZE,
              height: CROP_PREVIEW_SIZE,
              borderRadius: 16,
              overflow: 'hidden',
              background: 'var(--c-bg-muted)',
              margin: '0 auto 10px',
              position: 'relative',
              cursor: cropZoom > 1 ? 'grab' : 'default',
              touchAction: 'none',
            }}
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
                cropDragStateRef.current = {
                  startX: event.clientX,
                  startY: event.clientY,
                  startCropX: cropX,
                  startCropY: cropY,
                }
              }}
            >
              <div style={{
                position: 'absolute',
                inset: 0,
                border: '1px solid rgba(255,255,255,0.7)',
                boxShadow: 'inset 0 0 0 999px rgba(0,0,0,0.04)',
                pointerEvents: 'none',
                zIndex: 1,
              }} />
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: `${cropBaseImageSize.width}px`,
                  height: `${cropBaseImageSize.height}px`,
                  pointerEvents: 'none',
                  transform: `translate(calc(-50% + ${cropX}px), calc(-50% + ${cropY}px))`,
                }}
              >
                <img
                  src={cropImageSrc}
                  alt="Crop preview"
                  draggable={false}
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    objectFit: 'contain',
                    userSelect: 'none',
                    transform: `scale(${cropZoom})`,
                    transformOrigin: 'center center',
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={applyCrop}
                style={{
                  flex: 1,
                  height: 34,
                  borderRadius: 9,
                  border: 'none',
                  background: 'var(--c-text-primary)',
                  color: 'var(--c-bg-page)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {t.auth.useCrop}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCropImageSrc('')
                  setCropImageSize({ width: 0, height: 0 })
                }}
                style={{
                  flex: 1,
                  height: 34,
                  borderRadius: 9,
                  border: '0.5px solid var(--c-border)',
                  background: 'var(--c-bg-card)',
                  color: 'var(--c-text-base)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {t.auth.cancel}
              </button>
            </div>
          </div>
        )}

        {user ? (
          <>
            {/* ── Change-password sub-view ─────────────────────────────── */}
            {changingPassword ? (
              <form onSubmit={handleCpSubmit}>
                <button
                  type="button"
                  onClick={handleExitChangePw}
                  style={{
                    border: 'none',
                    background: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 800,
                    color: 'var(--c-text-secondary)',
                    marginBottom: 14,
                  }}
                >
                  {t.auth.changePasswordBack}
                </button>

                {error && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '0.5px solid rgba(239, 68, 68, 0.26)',
                    color: '#A32020',
                    borderRadius: 10,
                    padding: '9px 11px',
                    fontSize: 11,
                    lineHeight: 1.6,
                    marginBottom: 12,
                  }}>
                    {error}
                  </div>
                )}

                {cpSuccess ? (
                  <div style={{
                    background: 'rgba(22, 163, 74, 0.08)',
                    border: '0.5px solid rgba(22, 163, 74, 0.3)',
                    color: '#166534',
                    borderRadius: 10,
                    padding: '12px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    textAlign: 'center',
                    marginTop: 8,
                  }}>
                    {t.auth.passwordChanged}
                  </div>
                ) : (
                  <>
                    {/* Step 1 — current password */}
                    <div style={{ fontSize: 10, color: 'var(--c-text-faint)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {t.auth.step1Label}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                      <input
                        type="password"
                        value={cpCurrentPw}
                        disabled={cpCurrentPwOk}
                        onChange={(event) => { clearError(); setCpCurrentPw(event.target.value) }}
                        placeholder={t.auth.currentPassword}
                        style={{
                          flex: 1,
                          height: 38,
                          borderRadius: 10,
                          border: cpCurrentPwOk
                            ? '0.5px solid rgba(22,163,74,0.5)'
                            : '0.5px solid var(--c-border)',
                          padding: '0 12px',
                          outline: 'none',
                          fontSize: 12,
                          background: cpCurrentPwOk ? 'rgba(22,163,74,0.05)' : 'var(--c-bg-input)',
                          color: 'var(--c-text-base)',
                        }}
                      />
                      {!cpCurrentPwOk && (
                        <button
                          type="button"
                          onClick={handleCpVerifyCurrentPw}
                          style={{
                            height: 38,
                            padding: '0 12px',
                            borderRadius: 10,
                            border: '0.5px solid var(--c-border)',
                            background: 'var(--c-bg-card)',
                            color: 'var(--c-text-base)',
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 800,
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          {t.common.ok}
                        </button>
                      )}
                      {cpCurrentPwOk && (
                        <div style={{ display: 'flex', alignItems: 'center', color: '#16a34a', fontSize: 16, flexShrink: 0 }}>✓</div>
                      )}
                    </div>

                    {/* Step 2 — email verification */}
                    <div style={{ fontSize: 10, color: cpCurrentPwOk ? 'var(--c-text-faint)' : 'var(--c-text-faint)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, opacity: cpCurrentPwOk ? 1 : 0.4 }}>
                      {t.auth.step2Label}
                    </div>
                    <div style={{ marginBottom: 14, opacity: cpCurrentPwOk ? 1 : 0.4, pointerEvents: cpCurrentPwOk ? 'auto' : 'none' }}>
                      {cpCodeSent && !cpCodeOk && (
                        <div style={{ fontSize: 10, color: '#1a7a3c', marginBottom: 6, lineHeight: 1.5 }}>
                          {t.auth.codeSent}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          value={cpCode}
                          disabled={cpCodeOk}
                          onChange={(event) => { clearError(); setCpCode(event.target.value) }}
                          placeholder="······"
                          maxLength={6}
                          style={{
                            flex: 1,
                            height: 38,
                            borderRadius: 10,
                            border: cpCodeOk
                              ? '0.5px solid rgba(22,163,74,0.5)'
                              : '0.5px solid var(--c-border)',
                            padding: '0 12px',
                            outline: 'none',
                            fontSize: 12,
                            background: cpCodeOk ? 'rgba(22,163,74,0.05)' : 'var(--c-bg-input)',
                            color: 'var(--c-text-base)',
                            letterSpacing: 2,
                          }}
                        />
                        {!cpCodeOk && (
                          <>
                            <button
                              type="button"
                              disabled={cpCooldown > 0}
                              onClick={handleCpSendCode}
                              style={{
                                height: 38,
                                padding: '0 10px',
                                borderRadius: 10,
                                border: '0.5px solid var(--c-border)',
                                background: cpCooldown > 0 ? 'var(--c-bg-muted)' : 'var(--c-bg-card)',
                                color: cpCooldown > 0 ? 'var(--c-text-faint)' : 'var(--c-text-base)',
                                cursor: cpCooldown > 0 ? 'not-allowed' : 'pointer',
                                fontSize: 10,
                                fontWeight: 800,
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}
                            >
                              {cpCooldown > 0 ? t.auth.resendCode(cpCooldown) : t.auth.sendCode}
                            </button>
                            <button
                              type="button"
                              onClick={handleCpVerifyCode}
                              style={{
                                height: 38,
                                padding: '0 10px',
                                borderRadius: 10,
                                border: '0.5px solid var(--c-border)',
                                background: 'var(--c-bg-card)',
                                color: 'var(--c-text-base)',
                                cursor: 'pointer',
                                fontSize: 10,
                                fontWeight: 800,
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}
                            >
                              {t.common.ok}
                            </button>
                          </>
                        )}
                        {cpCodeOk && (
                          <div style={{ display: 'flex', alignItems: 'center', color: '#16a34a', fontSize: 16, flexShrink: 0 }}>✓</div>
                        )}
                      </div>
                    </div>

                    {/* Step 3 — new password */}
                    <div style={{ fontSize: 10, color: 'var(--c-text-faint)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, opacity: cpCodeOk ? 1 : 0.4 }}>
                      {t.auth.step3Label}
                    </div>
                    <div style={{ opacity: cpCodeOk ? 1 : 0.4, pointerEvents: cpCodeOk ? 'auto' : 'none' }}>
                      <input
                        type="password"
                        value={cpNewPw}
                        onChange={(event) => { clearError(); setCpNewPw(event.target.value) }}
                        placeholder={t.auth.newPassword}
                        style={{
                          width: '100%',
                          height: 38,
                          borderRadius: 10,
                          border: '0.5px solid var(--c-border)',
                          padding: '0 12px',
                          outline: 'none',
                          fontSize: 12,
                          background: 'var(--c-bg-input)',
                          color: 'var(--c-text-base)',
                          marginBottom: 8,
                          boxSizing: 'border-box',
                        }}
                      />
                      <input
                        type="password"
                        value={cpConfirmPw}
                        onChange={(event) => { clearError(); setCpConfirmPw(event.target.value) }}
                        placeholder={t.auth.confirmNewPassword}
                        style={{
                          width: '100%',
                          height: 38,
                          borderRadius: 10,
                          border: '0.5px solid var(--c-border)',
                          padding: '0 12px',
                          outline: 'none',
                          fontSize: 12,
                          background: 'var(--c-bg-input)',
                          color: 'var(--c-text-base)',
                          marginBottom: 6,
                          boxSizing: 'border-box',
                        }}
                      />
                      <div style={{ fontSize: 10, color: 'var(--c-text-faint)', marginBottom: 12, lineHeight: 1.5 }}>
                        {t.auth.passwordStrengthHint}
                      </div>
                      <button
                        type="submit"
                        style={{
                          width: '100%',
                          height: 40,
                          borderRadius: 11,
                          border: 'none',
                          background: 'var(--c-text-primary)',
                          color: 'var(--c-bg-page)',
                          fontSize: 13,
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        {t.auth.changePassword}
                      </button>
                    </div>
                  </>
                )}
              </form>
            ) : (
              /* ── Normal account view ──────────────────────────────────── */
              <>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  borderRadius: 13,
                  background: 'var(--c-bg-subtle)',
                  border: '0.5px solid var(--c-border)',
                  marginBottom: 14,
                }}>
                  <div style={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    background: user.avatarDataUrl
                      ? `url(${user.avatarDataUrl}) center / cover`
                      : getAvatarColor(user.email),
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 15,
                    fontWeight: 850,
                  }}>
                    {user.avatarDataUrl ? '' : getAvatarInitial(user.name)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 850, color: 'var(--c-text-base)' }}>
                      {user.name}
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: 'var(--c-text-secondary)',
                      marginTop: 4,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 250,
                    }}>
                      {user.email}
                    </div>
                  </div>
                </div>

                {error && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '0.5px solid rgba(239, 68, 68, 0.26)',
                    color: '#A32020',
                    borderRadius: 10,
                    padding: '9px 11px',
                    fontSize: 11,
                    lineHeight: 1.6,
                    marginBottom: 12,
                  }}>
                    {error}
                  </div>
                )}

                <div style={{ fontSize: 11, color: 'var(--c-text-secondary)', fontWeight: 800, marginBottom: 8 }}>
                  {t.auth.username}
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <input
                    value={accountName}
                    onChange={(event) => {
                      clearError()
                      setAccountName(event.target.value)
                    }}
                    placeholder={t.auth.lettersNumbers}
                    style={{
                      flex: 1,
                      height: 38,
                      borderRadius: 10,
                      border: '0.5px solid var(--c-border)',
                      padding: '0 12px',
                      outline: 'none',
                      fontSize: 12,
                      background: 'var(--c-bg-input)',
                      color: 'var(--c-text-base)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveUsername}
                    style={{
                      height: 38,
                      padding: '0 12px',
                      borderRadius: 10,
                      border: '0.5px solid var(--c-border)',
                      background: 'var(--c-bg-card)',
                      color: 'var(--c-text-base)',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    {t.common.save}
                  </button>
                </div>

                <div style={{ fontSize: 11, color: 'var(--c-text-secondary)', fontWeight: 800, marginBottom: 8 }}>
                  {t.auth.uploadNewIcon}
                </div>
                <label style={{
                  height: 38,
                  borderRadius: 11,
                  border: '0.5px solid var(--c-border)',
                  background: 'var(--c-bg-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 800,
                  color: 'var(--c-text-base)',
                  marginBottom: 16,
                }}>
                  {t.auth.uploadNewIcon}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      handleAccountAvatarFileChange(event.target.files?.[0])
                      event.currentTarget.value = ''
                    }}
                    style={{ display: 'none' }}
                  />
                </label>
                {avatarError && (
                  <div style={{ fontSize: 10, color: '#A32020', marginTop: -8, marginBottom: 12, lineHeight: 1.5 }}>
                    {avatarError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => { clearError(); setChangingPassword(true) }}
                  style={{
                    width: '100%',
                    height: 38,
                    borderRadius: 11,
                    border: '0.5px solid var(--c-border)',
                    background: 'var(--c-bg-card)',
                    color: 'var(--c-text-base)',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    marginBottom: 10,
                  }}
                >
                  {t.auth.changePassword}
                </button>

                <div style={{ fontSize: 11, color: 'var(--c-text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
                  {t.auth.signOutDesc}
                </div>

                <button
                  type="button"
                  onClick={logout}
                  style={{
                    width: '100%',
                    height: 40,
                    borderRadius: 11,
                    border: '0.5px solid rgba(220,38,38,0.25)',
                    background: 'rgba(220,38,38,0.08)',
                    color: '#A11E1E',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {t.auth.signOut}
                </button>
              </>
            )}
          </>
        ) : (
          <form onSubmit={handleSubmit}>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '0.5px solid rgba(239, 68, 68, 0.26)',
            color: '#A32020',
            borderRadius: 10,
            padding: '9px 11px',
            fontSize: 11,
            lineHeight: 1.6,
            marginBottom: 12,
          }}>
            {error}
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: 8,
          background: 'var(--c-bg-muted)',
          borderRadius: 11,
          padding: 4,
          marginBottom: 14,
        }}>
          {([
            ['login', t.auth.signIn],
            ['register', t.auth.register],
          ] as const).map(([itemMode, label]) => {
            const active = mode === itemMode

            return (
              <button
                key={itemMode}
                type="button"
                onClick={() => {
                  clearError()
                  setEmail('')
                  setPassword('')
                  setDisplayName('')
                  setAvatarDataUrl('')
                  setAvatarError('')
                  setCropImageSrc('')
                  setCropImageSize({ width: 0, height: 0 })
                  setCropZoom(1)
                  setCropX(0)
                  setCropY(0)
                  setEmailFocused(false)
                  setVerificationCode('')
                  setCodeSent(false)
                  setCodeVerified(false)
                  setSendCooldown(0)
                  if (cooldownRef.current) clearInterval(cooldownRef.current)
                  setMode(itemMode)
                }}
                style={{
                  flex: 1,
                  height: 30,
                  borderRadius: 8,
                  border: 'none',
                  background: active ? 'var(--c-bg-card)' : 'transparent',
                  color: active ? 'var(--c-text-base)' : 'var(--c-text-secondary)',
                  boxShadow: active ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--c-text-secondary)', fontWeight: 700, marginBottom: 6 }}>
            {t.auth.email}
          </div>
          <div style={{ position: 'relative' }}>
            <input
              ref={emailInputRef}
              value={email}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => {
                window.setTimeout(() => setEmailFocused(false), 120)
              }}
              onChange={(event) => {
                clearError()
                setEmail(event.target.value)
                setEmailFocused(true)
              }}
              placeholder="you@example.com"
              style={{
                width: '100%',
                height: 38,
                borderRadius: 10,
                border: '0.5px solid var(--c-border)',
                padding: '0 12px',
                outline: 'none',
                fontSize: 12,
                background: 'var(--c-bg-input)',
                color: 'var(--c-text-base)',
              }}
            />

            {showAccountSuggestions && (
              <div style={{
                position: 'absolute',
                top: 43,
                left: 0,
                right: 0,
                background: 'var(--c-bg-card)',
                border: '0.5px solid var(--c-border)',
                borderRadius: 11,
                boxShadow: '0 12px 28px rgba(0,0,0,0.12)',
                overflow: 'hidden',
                zIndex: 2,
              }}>
                {filteredAccounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      clearError()
                      setEmail(account.email)
                      setEmailFocused(false)
                    }}
                    style={{
                      width: '100%',
                      border: 'none',
                      background: 'var(--c-bg-card)',
                      padding: '9px 11px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{
                      width: 25,
                      height: 25,
                      borderRadius: '50%',
                      background: account.avatarDataUrl
                        ? `url(${account.avatarDataUrl}) center / cover`
                        : getAvatarColor(account.email),
                      color: '#FFFFFF',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 850,
                      flexShrink: 0,
                    }}>
                      {account.avatarDataUrl ? '' : getAvatarInitial(account.name)}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{
                        display: 'block',
                        fontSize: 11,
                        fontWeight: 800,
                        color: 'var(--c-text-base)',
                        lineHeight: 1.4,
                      }}>
                        {account.name}
                      </span>
                      <span style={{
                        display: 'block',
                        fontSize: 10,
                        color: 'var(--c-text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 280,
                      }}>
                        {account.email}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--c-text-secondary)', fontWeight: 700, marginBottom: 6 }}>
            {t.auth.password}
          </div>
          <input
            value={password}
            type="password"
            onChange={(event) => {
              clearError()
              setPassword(event.target.value)
            }}
            placeholder={t.auth.atLeast6}
            style={{
              width: '100%',
              height: 38,
              borderRadius: 10,
              border: '0.5px solid var(--c-border)',
              padding: '0 12px',
              outline: 'none',
              fontSize: 12,
              background: 'var(--c-bg-input)',
              color: 'var(--c-text-base)',
            }}
          />
        </label>

        {mode === 'register' && (
          <>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--c-text-secondary)', fontWeight: 700, marginBottom: 6 }}>
                {t.auth.verificationCode}
              </div>
              {codeSent && !codeVerified && (
                <div style={{ fontSize: 10, color: '#1a7a3c', marginBottom: 6, lineHeight: 1.5 }}>
                  {t.auth.codeSent}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={verificationCode}
                  disabled={codeVerified}
                  onChange={(event) => {
                    clearError()
                    setVerificationCode(event.target.value)
                  }}
                  placeholder="······"
                  maxLength={6}
                  style={{
                    flex: 1,
                    height: 38,
                    borderRadius: 10,
                    border: codeVerified
                      ? '0.5px solid rgba(22,163,74,0.5)'
                      : '0.5px solid var(--c-border)',
                    padding: '0 12px',
                    outline: 'none',
                    fontSize: 12,
                    background: codeVerified ? 'rgba(22,163,74,0.05)' : 'var(--c-bg-input)',
                    color: 'var(--c-text-base)',
                    letterSpacing: 2,
                  }}
                />
                {!codeVerified && (
                  <>
                    <button
                      type="button"
                      disabled={sendCooldown > 0}
                      onClick={handleSendCode}
                      style={{
                        height: 38,
                        padding: '0 10px',
                        borderRadius: 10,
                        border: '0.5px solid var(--c-border)',
                        background: sendCooldown > 0 ? 'var(--c-bg-muted)' : 'var(--c-bg-card)',
                        color: sendCooldown > 0 ? 'var(--c-text-faint)' : 'var(--c-text-base)',
                        cursor: sendCooldown > 0 ? 'not-allowed' : 'pointer',
                        fontSize: 10,
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {sendCooldown > 0 ? t.auth.resendCode(sendCooldown) : t.auth.sendCode}
                    </button>
                    <button
                      type="button"
                      onClick={handleVerifyCode}
                      style={{
                        height: 38,
                        padding: '0 10px',
                        borderRadius: 10,
                        border: '0.5px solid var(--c-border)',
                        background: 'var(--c-bg-card)',
                        color: 'var(--c-text-base)',
                        cursor: 'pointer',
                        fontSize: 10,
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {t.common.ok}
                    </button>
                  </>
                )}
                {codeVerified && (
                  <div style={{ display: 'flex', alignItems: 'center', color: '#16a34a', fontSize: 16, flexShrink: 0 }}>✓</div>
                )}
              </div>
            </div>

            <label style={{ display: 'block', marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--c-text-secondary)', fontWeight: 700, marginBottom: 6 }}>
                {t.auth.usernameOptional} <span style={{ color: 'var(--c-text-faint)', fontWeight: 500 }}>{t.auth.usernameOptionalHint}</span>
              </div>
              <input
                value={displayName}
                onChange={(event) => {
                  clearError()
                  setDisplayName(event.target.value)
                }}
                placeholder={t.auth.lettersNumbers}
                style={{
                  width: '100%',
                  height: 38,
                  borderRadius: 10,
                  border: '0.5px solid var(--c-border)',
                  padding: '0 12px',
                  outline: 'none',
                  fontSize: 12,
                  background: 'var(--c-bg-input)',
                  color: 'var(--c-text-base)',
                }}
              />
            </label>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--c-text-secondary)', fontWeight: 700, marginBottom: 8 }}>
                {t.auth.uploadAvatarOptional} <span style={{ color: 'var(--c-text-faint)', fontWeight: 500 }}>{t.auth.uploadAvatarHint}</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: 10,
                border: '0.5px solid var(--c-border)',
                borderRadius: 12,
                background: 'var(--c-bg-subtle)',
              }}>
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: avatarDataUrl
                    ? `url(${avatarDataUrl}) center / cover`
                    : getAvatarColor(displayName || email),
                  color: '#FFFFFF',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 850,
                }}>
                  {avatarDataUrl ? '' : getAvatarInitial(displayName || email)}
                </div>
                <label style={{
                  height: 34,
                  padding: '0 12px',
                  borderRadius: 9,
                  border: '0.5px solid var(--c-border)',
                  background: 'var(--c-bg-card)',
                  color: 'var(--c-text-base)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 800,
                }}>
                  {t.auth.chooseLocalImage}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    handleAvatarFileChange(event.target.files?.[0])
                    event.currentTarget.value = ''
                  }}
                  style={{ display: 'none' }}
                />
              </label>
              </div>
              {avatarError && (
                <div style={{ fontSize: 10, color: '#A32020', marginTop: 7, lineHeight: 1.5 }}>
                  {avatarError}
                </div>
              )}
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={mode === 'register' && !codeVerified}
          style={{
            width: '100%',
            height: 40,
            borderRadius: 11,
            border: 'none',
            background: mode === 'register' && !codeVerified ? 'var(--c-bg-muted)' : 'var(--c-text-primary)',
            color: mode === 'register' && !codeVerified ? 'var(--c-text-faint)' : 'var(--c-bg-page)',
            fontSize: 13,
            fontWeight: 800,
            cursor: mode === 'register' && !codeVerified ? 'not-allowed' : 'pointer',
          }}
        >
          {mode === 'login' ? t.auth.signIn : t.auth.createAccount}
        </button>
          </form>
        )}
        </div>
      </div>
    </>
  )
}
