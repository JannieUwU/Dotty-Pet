import { create } from 'zustand'
import { AUTH_USER_STORAGE_KEY, emitAccountScopeChanged } from '../utils/accountScope'
import { useDataStore } from './dataStore'
import { API_BASE } from '../utils/api'

const AUTH_ACCOUNTS_KEY = 'dotty-pet-auth-accounts'

export interface AuthUser {
  id: string
  name: string
  email: string
  avatarDataUrl?: string
}

interface AuthAccount extends AuthUser {
  password: string
  lastLoginAt?: number
}

export type AuthMode = 'login' | 'register'

const isAuthUser = (value: unknown): value is AuthUser => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<AuthUser>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.email === 'string'
  )
}

const isAuthAccount = (value: unknown): value is AuthAccount => {
  if (!isAuthUser(value)) return false
  const candidate = value as Partial<AuthAccount>
  return typeof candidate.password === 'string'
}

const readSavedAccounts = (): AuthAccount[] => {
  if (typeof window === 'undefined') return []
  try {
    const rawValue = window.localStorage.getItem(AUTH_ACCOUNTS_KEY)
    if (!rawValue) return []
    const parsed = JSON.parse(rawValue)
    return Array.isArray(parsed) ? parsed.filter(isAuthAccount) : []
  } catch {
    return []
  }
}

const saveAccounts = (accounts: AuthAccount[]) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(AUTH_ACCOUNTS_KEY, JSON.stringify(accounts))
}

const getRememberedAccounts = (accounts: AuthAccount[]): AuthUser[] =>
  [...accounts]
    .sort((a, b) => (b.lastLoginAt ?? 0) - (a.lastLoginAt ?? 0))
    .map(({ id, name, email, avatarDataUrl }) => ({ id, name, email, avatarDataUrl }))

const readSavedUser = (): AuthUser | null => {
  if (typeof window === 'undefined') return null
  try {
    const rawValue = window.localStorage.getItem(AUTH_USER_STORAGE_KEY)
    if (!rawValue) return null
    const parsed = JSON.parse(rawValue)
    if (isAuthUser(parsed)) {
      const hasRegisteredAccount = readSavedAccounts().some(
        (account) => account.email.toLowerCase() === parsed.email.toLowerCase(),
      )
      if (hasRegisteredAccount) return parsed
    }
    saveUser(null)
    return null
  } catch {
    return null
  }
}

const saveUser = (user: AuthUser | null) => {
  if (typeof window === 'undefined') return
  if (!user) {
    window.localStorage.removeItem(AUTH_USER_STORAGE_KEY)
    window.electron?.clearAuthSession?.()
    return
  }
  window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user))
  // Write sidecar so main process can check login state on next startup.
  // We only store the id (no sensitive data).
  window.electron?.writeAuthSession?.(JSON.stringify({ id: user.id }))
}

interface LoginInput { email: string; password: string }
interface RegisterInput { email: string; password: string; displayName?: string; avatarDataUrl?: string; codeVerified: boolean }
interface ChangePasswordInput { currentPassword: string; verificationCode: string; newPassword: string; codePreVerified?: boolean }

export const isStrongPassword = (pw: string): boolean =>
  pw.length >= 6 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw)

interface AuthState {
  user: AuthUser | null
  rememberedAccounts: AuthUser[]
  isLoginOpen: boolean
  mode: AuthMode
  error: string | null
  openLogin: (mode?: AuthMode) => void
  closeLogin: () => void
  setMode: (mode: AuthMode) => void
  login: (input: LoginInput) => boolean
  register: (input: RegisterInput) => boolean
  sendVerificationCode: (email: string) => Promise<void>
  verifyCode: (email: string, code: string) => Promise<boolean>
  changePassword: (input: ChangePasswordInput) => Promise<boolean>
  updateAvatar: (avatarDataUrl: string) => void
  updateName: (name: string) => boolean
  logout: () => Promise<void>
  clearError: () => void
}

const isEmailLike = (value: string) => /\S+@\S+\.\S+/.test(value)
const isValidUsername = (value: string) => /^[A-Za-z0-9_]+$/.test(value)

const normalizeUsername = (value: string) => {
  const normalized = value.replace(/[^A-Za-z0-9_]/g, '_')
  return normalized || 'User'
}

const getNameFromEmail = (email: string) => {
  const [name] = email.split('@')
  return normalizeUsername(name || 'User')
}

// Notify the Electron main process of auth state changes.
// These are no-ops when running in a browser (no window.electron).
const notifyLoginSuccess = () => window.electron?.notifyLoginSuccess?.()
const notifyLogout = () => window.electron?.notifyLogout?.()

const toAuthUser = (account: AuthAccount): AuthUser => ({
  id: account.id,
  name: account.name,
  email: account.email,
  avatarDataUrl: account.avatarDataUrl,
})

export const useAuthStore = create<AuthState>((set) => ({
  user: readSavedUser(),
  rememberedAccounts: getRememberedAccounts(readSavedAccounts()),
  isLoginOpen: false,
  mode: 'login',
  error: null,

  openLogin: (mode = 'login') => set({ isLoginOpen: true, mode, error: null }),
  closeLogin: () => set({ isLoginOpen: false, error: null }),
  setMode: (mode) => set({ mode, error: null }),

  login: ({ email, password }) => {
    const trimmedEmail = email.trim()
    const normalizedEmail = trimmedEmail.toLowerCase()

    if (!isEmailLike(trimmedEmail)) {
      set({ error: 'Please enter a valid email address.' })
      return false
    }
    if (password.length < 6) {
      set({ error: 'Password must be at least 6 characters.' })
      return false
    }

    const accounts = readSavedAccounts()
    const account = accounts.find((e) => e.email.toLowerCase() === normalizedEmail)

    if (!account) {
      set({ error: 'No account found for this email. Please register first.' })
      return false
    }
    if (account.password !== password) {
      set({ error: 'Incorrect password.' })
      return false
    }

    const nextAccounts = accounts.map((e) =>
      e.email.toLowerCase() === normalizedEmail ? { ...e, lastLoginAt: Date.now() } : e,
    )
    saveAccounts(nextAccounts)
    const user = toAuthUser(account)
    saveUser(user)
    emitAccountScopeChanged()
    notifyLoginSuccess()
    set({ user, rememberedAccounts: getRememberedAccounts(nextAccounts), isLoginOpen: false, error: null })
    return true
  },

  register: ({ email, password, displayName, avatarDataUrl, codeVerified }) => {
    const trimmedEmail = email.trim()
    const normalizedEmail = trimmedEmail.toLowerCase()
    const trimmedName = displayName?.trim() ?? ''

    if (!codeVerified) {
      set({ error: 'Please verify your email address before registering.' })
      return false
    }
    if (!isEmailLike(trimmedEmail)) {
      set({ error: 'Please enter a valid email address.' })
      return false
    }
    if (!isStrongPassword(password)) {
      set({ error: 'Password must be at least 6 characters and include both letters and numbers.' })
      return false
    }
    if (trimmedName && !isValidUsername(trimmedName)) {
      set({ error: 'Username can only contain English letters, numbers, and underscores.' })
      return false
    }

    const accounts = readSavedAccounts()
    if (accounts.some((e) => e.email.toLowerCase() === normalizedEmail)) {
      set({ error: 'This email is already registered. Please sign in instead.' })
      return false
    }

    const account: AuthAccount = {
      id: `local-${normalizedEmail}`,
      name: trimmedName || getNameFromEmail(trimmedEmail),
      email: trimmedEmail,
      avatarDataUrl: avatarDataUrl || undefined,
      password,
      lastLoginAt: Date.now(),
    }

    const nextAccounts = [...accounts, account]
    saveAccounts(nextAccounts)
    const user = toAuthUser(account)
    saveUser(user)
    emitAccountScopeChanged()
    notifyLoginSuccess()
    set({ user, rememberedAccounts: getRememberedAccounts(nextAccounts), isLoginOpen: false, mode: 'login', error: null })
    return true
  },

  verifyCode: async (email: string, code: string) => {
    try {
      const res = await fetch(`${API_BASE}/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        set({ error: (data as { detail?: string }).detail ?? 'Incorrect or expired verification code.' })
        return false
      }
      return true
    } catch {
      set({ error: 'Could not reach the server. Please check your connection.' })
      return false
    }
  },

  sendVerificationCode: async (email: string) => {
    const trimmedEmail = email.trim()
    if (!isEmailLike(trimmedEmail)) {
      set({ error: 'Please enter a valid email address before sending the code.' })
      return
    }
    try {
      const res = await fetch(`${API_BASE}/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        set({ error: (data as { detail?: string }).detail ?? 'Failed to send verification email.' })
      }
    } catch {
      set({ error: 'Could not reach the server. Please check your connection.' })
    }
  },

  changePassword: async ({ currentPassword, verificationCode, newPassword, codePreVerified }) => {
    const currentUser = readSavedUser()
    if (!currentUser) {
      set({ error: 'Not logged in.' })
      return false
    }

    const accounts = readSavedAccounts()
    const account = accounts.find((a) => a.email.toLowerCase() === currentUser.email.toLowerCase())
    if (!account) {
      set({ error: 'Account not found.' })
      return false
    }

    if (account.password !== currentPassword) {
      set({ error: 'Current password is incorrect.' })
      return false
    }

    if (!isStrongPassword(newPassword)) {
      set({ error: 'Password must be at least 6 characters and include both letters and numbers.' })
      return false
    }

    // Skip network verify if the UI already consumed the code in a prior step
    if (!codePreVerified) {
      try {
        const res = await fetch(`${API_BASE}/auth/verify-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: currentUser.email, code: verificationCode.trim() }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          set({ error: (data as { detail?: string }).detail ?? 'Incorrect or expired verification code.' })
          return false
        }
      } catch {
        set({ error: 'Could not reach the server. Please check your connection.' })
        return false
      }
    }

    const nextAccounts = accounts.map((a) =>
      a.email.toLowerCase() === currentUser.email.toLowerCase() ? { ...a, password: newPassword } : a,
    )
    saveAccounts(nextAccounts)
    set({ error: null })
    return true
  },

  updateAvatar: (avatarDataUrl) => {
    const currentUser = readSavedUser()
    if (!currentUser) return
    const accounts = readSavedAccounts()
    const nextAccounts = accounts.map((a) =>
      a.email.toLowerCase() === currentUser.email.toLowerCase() ? { ...a, avatarDataUrl } : a,
    )
    const user = { ...currentUser, avatarDataUrl }
    saveAccounts(nextAccounts)
    saveUser(user)
    set({ user, rememberedAccounts: getRememberedAccounts(nextAccounts), error: null })
  },

  updateName: (name) => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      set({ error: 'Username cannot be empty.' })
      return false
    }
    if (!isValidUsername(trimmedName)) {
      set({ error: 'Username can only contain English letters, numbers, and underscores.' })
      return false
    }
    const currentUser = readSavedUser()
    if (!currentUser) return false
    const accounts = readSavedAccounts()
    const nextAccounts = accounts.map((a) =>
      a.email.toLowerCase() === currentUser.email.toLowerCase() ? { ...a, name: trimmedName } : a,
    )
    const user = { ...currentUser, name: trimmedName }
    saveAccounts(nextAccounts)
    saveUser(user)
    set({ user, rememberedAccounts: getRememberedAccounts(nextAccounts), error: null })
    return true
  },

  logout: async () => {
    const { clearResourcesOnLogout, clearResourceLibrary } = useDataStore.getState()
    if (clearResourcesOnLogout) {
      try { await clearResourceLibrary() } catch { /* non-fatal */ }
    }
    saveUser(null)
    emitAccountScopeChanged()
    notifyLogout()
    set({ user: null, rememberedAccounts: getRememberedAccounts(readSavedAccounts()), isLoginOpen: true, mode: 'login', error: null })
  },

  clearError: () => set({ error: null }),
}))
