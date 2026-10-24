import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '../domain/schema'
import { createAuthStore } from './authStore'
import { createSyncManager } from './manager'

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

describe('syncManager account switching', () => {
  it('copies the guest save into a fresh account key', async () => {
    const storage = memoryStorage()
    const guestDoc = {
      ...createEmptyDocument(),
      profile: {
        id: 'profile_1',
        name: 'Wayfarer',
        xp: 0,
        level: 1,
        gold: 10,
        loot: [],
        createdAt: '2026-10-24T00:00:00.000Z',
      },
    }
    storage.setItem('lifespire:mvp0', JSON.stringify(guestDoc))

    const auth = createAuthStore({ storage, api: {} as never })
    const appStore = {
      getState: () => ({ document: guestDoc }),
      setState: vi.fn(),
      persist: { setOptions: vi.fn(), rehydrate: vi.fn() },
      subscribe: vi.fn(() => () => undefined),
    }
    const docStorage = {
      getActiveKey: () => 'lifespire:mvp0',
      setActiveKey: vi.fn(),
      read: (key?: string) => storage.getItem(key ?? 'lifespire:mvp0'),
      backup: vi.fn(),
    }
    const engine = {
      setUserId: vi.fn(),
      markDirty: vi.fn(),
      adoptLocal: vi.fn(),
    }

    const manager = createSyncManager({
      storage,
      auth: auth as never,
      appStore: appStore as never,
      documentStorage: docStorage as never,
      engine: engine as never,
    })
    await manager.switchToAccount('u1')

    expect(storage.getItem('lifespire:mvp0:u:u1')).toBe(JSON.stringify(guestDoc))
    expect(docStorage.setActiveKey).toHaveBeenCalledWith('lifespire:mvp0:u:u1')
    expect(engine.setUserId).toHaveBeenCalledWith('u1')
  })

  it('keeps an existing account save instead of overwriting with guest', async () => {
    const storage = memoryStorage()
    storage.setItem('lifespire:mvp0', JSON.stringify({ ...createEmptyDocument(), profile: null }))
    const existing = { ...createEmptyDocument(), profile: { id: 'p', name: 'X', xp: 0, level: 1, gold: 1, loot: [], createdAt: 'x' } }
    storage.setItem('lifespire:mvp0:u:u1', JSON.stringify(existing))

    const auth = createAuthStore({ storage, api: {} as never })
    const manager = createSyncManager({
      storage,
      auth: auth as never,
      appStore: {
        getState: () => ({ document: existing }),
        persist: { setOptions: vi.fn(), rehydrate: vi.fn() },
        subscribe: vi.fn(() => () => undefined),
      } as never,
      documentStorage: {
        getActiveKey: () => 'lifespire:mvp0',
        setActiveKey: vi.fn(),
        read: (key?: string) => storage.getItem(key ?? 'lifespire:mvp0'),
        backup: vi.fn(),
      } as never,
      engine: { setUserId: vi.fn(), adoptLocal: vi.fn() } as never,
    })
    await manager.switchToAccount('u1')
    expect(storage.getItem('lifespire:mvp0:u:u1')).toBe(JSON.stringify(existing))
  })
})
