import { createApiClient } from '@lifespire/api-client'
import type { ApiClient } from '@lifespire/api-client'
import { useAuthStore } from './authStore'

function resolveBaseUrl(): string {
  try {
    const fromEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_SYNC_BASE_URL
    if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv.replace(/\/$/, '')
  } catch {
    // Tests and non-Vite runtimes fall back to same-origin.
  }
  return ''
}

export const syncApi: ApiClient = createApiClient({
  baseUrl: resolveBaseUrl(),
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
