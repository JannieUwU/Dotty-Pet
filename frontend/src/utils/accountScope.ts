import type { AuthUser } from '../store/authStore'

export const AUTH_USER_STORAGE_KEY = 'dotty-pet-auth-user'
export const ACCOUNT_SCOPE_CHANGED_EVENT = 'dotty-pet-account-scope-changed'

const GUEST_SCOPE = 'guest'

const sanitizeScope = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]/g, '_')

export const getActiveAccountScope = () => {
  if (typeof window === 'undefined') return GUEST_SCOPE

  try {
    const rawValue = window.localStorage.getItem(AUTH_USER_STORAGE_KEY)
    if (!rawValue) return GUEST_SCOPE

    const user = JSON.parse(rawValue) as Partial<AuthUser>
    return typeof user.id === 'string' && user.id
      ? sanitizeScope(user.id)
      : GUEST_SCOPE
  } catch {
    return GUEST_SCOPE
  }
}

export const scopedStorageKey = (baseKey: string) =>
  `${baseKey}:${getActiveAccountScope()}`

export const emitAccountScopeChanged = () => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(ACCOUNT_SCOPE_CHANGED_EVENT))
}

export const subscribeAccountScopeChanged = (handler: () => void) => {
  if (typeof window === 'undefined') return () => undefined

  window.addEventListener(ACCOUNT_SCOPE_CHANGED_EVENT, handler)
  return () => window.removeEventListener(ACCOUNT_SCOPE_CHANGED_EVENT, handler)
}
