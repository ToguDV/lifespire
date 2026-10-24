import * as SecureStore from 'expo-secure-store'

const REFRESH_TOKEN_KEY = 'lifespire.refresh-token'

let cached: string | null = null
let loaded = false

/** Loads the rotated refresh token once at boot, before auth restore. */
export async function loadRefreshToken(): Promise<string | null> {
  if (loaded) return cached
  try {
    cached = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
  } catch {
    cached = null
  }
  loaded = true
  return cached
}

export function getRefreshToken(): string | null {
  return cached
}

/**
 * Persists in the OS keychain. Callers are synchronous (the API client rotates
 * at most once per request), so the write is fired and errors are swallowed:
 * a failed keychain write only affects the next cold start, never the session.
 */
export function setRefreshToken(token: string | null): void {
  cached = token
  loaded = true
  if (token) {
    void SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token).catch(() => undefined)
  } else {
    void SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => undefined)
  }
}
