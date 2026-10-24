import { create } from 'zustand'
import { ApiRequestError } from '@lifespire/api-client'
import type { ApiClient, ApiUser } from '@lifespire/api-client'
import { SESSION_KEY } from './storageKeys'

export interface SessionUser {
  id: string
  email: string
  role: 'ADMIN' | 'USER'
}

export type AuthStatus = 'guest' | 'authenticated'

export interface AuthState {
  status: AuthStatus
  user: SessionUser | null
  accessToken: string | null
  totpSetupRequired: boolean
  totpSetup: { otpauthUrl: string; manualSecret: string; recoveryCodes: string[] } | null
  error: string | null
  deviceName: string

  getAccessToken: () => string | null
  setAccessToken: (token: string | null) => void
  configure: (api: AuthStoreDeps['api']) => void
  login: (email: string, password: string, totpCode?: string) => Promise<void>
  acceptInvite: (token: string, password: string) => Promise<void>
  resetPassword: (token: string, password: string) => Promise<void>
  restore: () => Promise<void>
  logout: () => Promise<void>
  fetchMe: () => Promise<void>
  startTotpSetup: (currentPassword: string) => Promise<void>
  confirmTotpSetup: (code: string) => Promise<void>
  clearError: () => void
}

export interface AuthStoreDeps {
  storage?: {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
    removeItem(key: string): void
  }
  api?: Pick<
    ApiClient,
    | 'login'
    | 'acceptInvite'
    | 'resetPassword'
    | 'refresh'
    | 'logout'
    | 'me'
    | 'totpSetup'
    | 'totpEnable'
  >
  deviceName?: string
}

function defaultDeviceName(): string {
  try {
    const agent =
      typeof navigator !== 'undefined' ? navigator.userAgent : 'lifespire-web'
    const short = agent.slice(0, 40).replace(/[^\w .()-]/g, '')
    return `web ${short || 'browser'}`.slice(0, 120)
  } catch {
    return 'web browser'
  }
}

function readSession(storage: AuthStoreDeps['storage']): SessionUser | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SessionUser>
    if (!parsed.id || !parsed.email || (parsed.role !== 'ADMIN' && parsed.role !== 'USER')) {
      return null
    }
    return { id: parsed.id, email: parsed.email, role: parsed.role }
  } catch {
    return null
  }
}

export function createAuthStore(deps: AuthStoreDeps = {}) {
  const storage = deps.storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined)
  const initialSession = readSession(storage)
  let api = deps.api ?? null

  return create<AuthState>()((set, get) => {
    const persistSession = (user: SessionUser | null): void => {
      if (!storage) return
      try {
        if (user) storage.setItem(SESSION_KEY, JSON.stringify(user))
        else storage.removeItem(SESSION_KEY)
      } catch {
        // Session restore is best-effort; auth still works in memory.
      }
    }

    const applyUser = (user: ApiUser, accessToken: string, totpSetupRequired: boolean): void => {
      const session: SessionUser = { id: user.id, email: user.email, role: user.role }
      persistSession(session)
      set({
        status: 'authenticated',
        user: session,
        accessToken,
        totpSetupRequired,
        error: null,
      })
    }

    return {
      status: initialSession ? 'authenticated' : 'guest',
      user: initialSession,
      accessToken: null,
      totpSetupRequired: false,
      totpSetup: null,
      error: null,
      deviceName: deps.deviceName ?? defaultDeviceName(),

      getAccessToken: () => get().accessToken,
      setAccessToken: (token) => {
        if (token) set({ accessToken: token })
        else {
          persistSession(null)
          set({ status: 'guest', user: null, accessToken: null, totpSetupRequired: false })
        }
      },

      configure: (next) => {
        api = next ?? null
      },

      login: async (email, password, totpCode) => {
        if (!api) {
          set({ error: 'Sync is not configured in this build.' })
          return
        }
        try {
          const out = await api.login(email.trim(), password, get().deviceName, totpCode)
          applyUser(out.user, out.accessToken, out.totpSetupRequired)
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Login failed.',
          })
          throw error
        }
      },

      acceptInvite: async (token, password) => {
        if (!api) {
          set({ error: 'Sync is not configured in this build.' })
          return
        }
        try {
          const out = await api.acceptInvite(token.trim(), password, get().deviceName)
          // Invite acceptance returns only the token; the profile comes from /me.
          const me = await api.me()
          applyUser(me, out.accessToken, false)
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Invite failed.' })
          throw error
        }
      },

      resetPassword: async (token, password) => {
        if (!api) {
          set({ error: 'Sync is not configured in this build.' })
          return
        }
        try {
          await api.resetPassword(token.trim(), password)
          set({ error: null })
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Password reset failed.',
          })
          throw error
        }
      },

      restore: async () => {
        const session = readSession(storage)
        if (!session) {
          set({ status: 'guest', user: null, accessToken: null })
          return
        }
        if (!api) {
          set({ status: 'authenticated', user: session })
          return
        }
        try {
          const refreshed = await api.refresh()
          const me = await api.me()
          persistSession({ id: me.id, email: me.email, role: me.role })
          set({
            status: 'authenticated',
            user: { id: me.id, email: me.email, role: me.role },
            accessToken: refreshed.accessToken,
            error: null,
          })
        } catch (error) {
          // Only drop the stored session when the server rejects it (expired
          // or revoked). Transient network failures keep the session so the
          // next restore can retry without forcing another login.
          const status =
            error instanceof ApiRequestError
              ? error.status
              : error instanceof Error && 'status' in error
                ? (error as { status?: unknown }).status
                : undefined
          const invalid = status === 401 || status === 403 || status === 404
          if (invalid) persistSession(null)
          set({
            status: 'guest',
            user: invalid ? null : session,
            accessToken: null,
            totpSetupRequired: false,
          })
        }
      },

      logout: async () => {
        try {
          await api?.logout()
        } catch {
          // Logout is local-first: a failed server call still signs out here.
        } finally {
          persistSession(null)
          set({
            status: 'guest',
            user: null,
            accessToken: null,
            totpSetupRequired: false,
            totpSetup: null,
            error: null,
          })
        }
      },

      fetchMe: async () => {
        if (!api || !get().accessToken) return
        const me = await api.me()
        const session: SessionUser = { id: me.id, email: me.email, role: me.role }
        persistSession(session)
        set({ user: session })
      },

      startTotpSetup: async (currentPassword) => {
        if (!api) return
        const out = await api.totpSetup(currentPassword)
        set({ totpSetup: out, error: null })
      },

      confirmTotpSetup: async (code) => {
        if (!api) return
        await api.totpEnable(code)
        set({ totpSetup: null, totpSetupRequired: false })
      },

      clearError: () => {
        set({ error: null })
      },
    }
  })
}

/** Singleton wired to same-origin `/v1` once the app boots. */
export const useAuthStore = createAuthStore()
