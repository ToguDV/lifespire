import { describe, expect, it, vi } from 'vitest'
import { createAuthStore } from './authStore'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  }
}

describe('authStore', () => {
  it('starts as guest with no session', () => {
    const store = createAuthStore({ storage: memoryStorage(), api: {} as never })
    expect(store.getState().status).toBe('guest')
    expect(store.getState().user).toBeNull()
  })

  it('logs in and persists the session without the token', async () => {
    const storage = memoryStorage()
    const api = {
      login: vi.fn(async () => ({
        accessToken: 'tok-1',
        user: { id: 'u1', email: 'a@b.c', role: 'USER', status: 'ACTIVE' },
        totpSetupRequired: false,
      })),
    }
    const store = createAuthStore({ storage, api: api as never })
    await store.getState().login('a@b.c', 'password123456')

    expect(store.getState().status).toBe('authenticated')
    expect(store.getState().user?.id).toBe('u1')
    expect(store.getState().accessToken).toBe('tok-1')
    const raw = storage.getItem('lifespire:mvp0:session')
    expect(raw).toContain('u1')
    expect(raw).not.toContain('tok-1')
  })

  it('restores the session from storage and refreshes the token', async () => {
    const storage = memoryStorage()
    storage.setItem(
      'lifespire:mvp0:session',
      JSON.stringify({ id: 'u1', email: 'a@b.c', role: 'USER' }),
    )
    const api = {
      refresh: vi.fn(async () => ({ accessToken: 'tok-2' })),
      me: vi.fn(async () => ({
        id: 'u1',
        email: 'a@b.c',
        role: 'USER',
        status: 'ACTIVE',
        totpEnabled: false,
        createdAt: '2026-10-24T00:00:00.000Z',
      })),
    }
    const store = createAuthStore({ storage, api: api as never })
    await store.getState().restore()

    expect(api.refresh).toHaveBeenCalled()
    expect(store.getState().status).toBe('authenticated')
    expect(store.getState().accessToken).toBe('tok-2')
  })

  it('falls back to guest but keeps the session on transient failures', async () => {
    const storage = memoryStorage()
    storage.setItem(
      'lifespire:mvp0:session',
      JSON.stringify({ id: 'u1', email: 'a@b.c', role: 'USER' }),
    )
    const api = {
      refresh: vi.fn(async () => {
        throw new Error('network down')
      }),
    }
    const store = createAuthStore({ storage, api: api as never })
    await store.getState().restore()

    expect(store.getState().status).toBe('guest')
    expect(storage.getItem('lifespire:mvp0:session')).not.toBeNull()
  })

  it('drops the stored session when the server rejects it', async () => {
    const { ApiRequestError } = await import('@lifespire/api-client')
    const storage = memoryStorage()
    storage.setItem(
      'lifespire:mvp0:session',
      JSON.stringify({ id: 'u1', email: 'a@b.c', role: 'USER' }),
    )
    const api = {
      refresh: vi.fn(async () => {
        throw new ApiRequestError(401, 'Unauthorized', 'AUTH_TOKEN_EXPIRED')
      }),
    }
    const store = createAuthStore({ storage, api: api as never })
    await store.getState().restore()

    expect(store.getState().status).toBe('guest')
    expect(storage.getItem('lifespire:mvp0:session')).toBeNull()
  })

  it('drops the stored session when sync is not configured', async () => {
    const { ApiRequestError } = await import('@lifespire/api-client')
    const storage = memoryStorage()
    storage.setItem(
      'lifespire:mvp0:session',
      JSON.stringify({ id: 'u1', email: 'a@b.c', role: 'USER' }),
    )
    const api = {
      refresh: vi.fn(async () => {
        throw new ApiRequestError(400, 'Choose a sync server.', 'SYNC_NOT_CONFIGURED')
      }),
    }
    const store = createAuthStore({ storage, api: api as never })
    await store.getState().restore()

    expect(store.getState().status).toBe('guest')
    expect(store.getState().user).toBeNull()
    expect(storage.getItem('lifespire:mvp0:session')).toBeNull()
  })

  it('logs out and clears token and session', async () => {
    const storage = memoryStorage()
    const api = {
      login: vi.fn(async () => ({
        accessToken: 't',
        user: { id: 'u1', email: 'a@b.c', role: 'USER', status: 'ACTIVE' },
        totpSetupRequired: false,
      })),
      logout: vi.fn(async () => undefined),
    }
    const store = createAuthStore({ storage, api: api as never })
    await store.getState().login('a@b.c', 'password123456')
    await store.getState().logout()

    expect(api.logout).toHaveBeenCalled()
    expect(store.getState().status).toBe('guest')
    expect(store.getState().accessToken).toBeNull()
  })

  it('resets the password through the api and surfaces errors', async () => {
    const storage = memoryStorage()
    const api = {
      resetPassword: vi.fn(async () => undefined),
    }
    const store = createAuthStore({ storage, api: api as never })
    await store.getState().resetPassword('tok', 'new-password-123')
    expect(api.resetPassword).toHaveBeenCalledWith('tok', 'new-password-123')
    expect(store.getState().error).toBeNull()
  })
})
