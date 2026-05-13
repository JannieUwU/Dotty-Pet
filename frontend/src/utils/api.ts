// ── Shared API utilities ──────────────────────────────────────────────────────

export const API_BASE = 'http://127.0.0.1:8766'

import { getActiveAccountScope } from './accountScope'

/**
 * Drop-in replacement for fetchWithRetry that automatically injects the
 * X-User-ID header so the backend can route to the correct user row.
 * The value is the active account scope (e.g. "local-user@example.com").
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {},
  retries = 3,
  timeoutMs = 5000,
): Promise<Response> {
  const scope = getActiveAccountScope()
  const headers = new Headers(options.headers)
  if (scope && scope !== 'guest') {
    headers.set('x-user-id', scope)
  }
  return fetchWithRetry(
    path.startsWith('http') ? path : `${API_BASE}${path}`,
    { ...options, headers },
    retries,
    timeoutMs,
  )
}

/**
 * fetch with exponential back-off retry.
 *
 * - Retries up to `retries` times on network errors or 5xx responses.
 * - Does NOT retry 4xx (client errors) — those are deterministic failures.
 * - Each attempt has its own AbortSignal timeout so a hung server can't
 *   block indefinitely.
 * - Throws on final failure so callers can handle it explicitly.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 3,
  timeoutMs = 5000,
): Promise<Response> {
  let lastErr: unknown
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      // Merge caller's signal with our timeout signal if provided
      const res = await fetch(url, { ...options, signal: controller.signal })
      clearTimeout(timer)
      // Don't retry 4xx — those are deterministic
      if (res.ok || (res.status >= 400 && res.status < 500)) return res
      throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      clearTimeout(timer)
      lastErr = err
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, 200 * 2 ** i)) // 200 / 400 / 800 ms
      }
    }
  }
  throw lastErr
}
