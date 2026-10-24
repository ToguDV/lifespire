import { createApiClient } from '@lifespire/api-client'
import type { ApiClient } from '@lifespire/api-client'
import { useAuthStore } from './authStore'
import { SYNC_BASE_URL_KEY } from './storageKeys'

function readEnvBaseUrl(): string | undefined {
  try {
    const fromEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_SYNC_BASE_URL
    if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv
  } catch {
    // Tests and non-Vite runtimes fall back to same-origin.
  }
  return undefined
}

function readStoredBaseUrl(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(SYNC_BASE_URL_KEY)
  } catch {
    return null
  }
}

/** Normalizes a user-supplied server URL to its origin, or null if invalid. */
export function normalizeBaseUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, '')
  if (!trimmed) return null
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  return url.origin
}

/** Stored override wins over the build default; empty string means same-origin. */
export function resolveSyncBaseUrl(
  envValue: string | undefined,
  storedValue: string | null,
): string {
  const stored = storedValue ? normalizeBaseUrl(storedValue) : null
  if (stored) return stored
  if (typeof envValue === 'string' && envValue.length > 0) return envValue.replace(/\/$/, '')
  return ''
}

/** Effective base URL: device override, then build default, then same-origin. */
export function getSyncBaseUrl(): string {
  return resolveSyncBaseUrl(readEnvBaseUrl(), readStoredBaseUrl())
}

export function getStoredBaseUrl(): string | null {
  const raw = readStoredBaseUrl()
  return raw ? (normalizeBaseUrl(raw) ?? raw) : null
}

export function setStoredBaseUrl(url: string): void {
  const normalized = normalizeBaseUrl(url)
  if (!normalized) throw new Error('Enter a valid http(s) server URL.')
  try {
    localStorage.setItem(SYNC_BASE_URL_KEY, normalized)
  } catch {
    throw new Error('Could not save the server URL in this browser.')
  }
}

export function clearStoredBaseUrl(): void {
  try {
    localStorage.removeItem(SYNC_BASE_URL_KEY)
  } catch {
    // Private mode: nothing persisted, nothing to clear.
  }
}

export const syncApi: ApiClient = createApiClient({
  baseUrl: getSyncBaseUrl(),
  getAccessToken: () => {
    try {
      return useAuthStore.getState().getAccessToken()
    } catch {
      return null
    }
  },
  setAccessToken: (token) => {
    try {
      useAuthStore.getState().setAccessToken(token)
    } catch {
      // Store may not be ready in unit tests; the token stays in the caller.
    }
  },
})

useAuthStore.getState().configure(syncApi)
