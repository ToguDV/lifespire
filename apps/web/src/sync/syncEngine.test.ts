import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '../domain/schema'
import type { GameDocument } from '../domain/types'
import { accountBaseKey } from './storageKeys'
import { createSyncEngine } from './syncEngine'

function docWithGold(gold: number): GameDocument {
  const base = createEmptyDocument()
  return {
    ...base,
    profile: {
      id: 'profile_1',
      name: 'Wayfarer',
      xp: 0,
      level: 1,
      gold,
      loot: [],
      createdAt: '2026-10-24T00:00:00.000Z',
    },
  }
}

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

beforeEach(() => {
  vi.useFakeTimers()
  return () => {
    vi.useRealTimers()
  }
})

describe('syncEngine push', () => {
  it('debounces local edits and pushes with If-Match', async () => {
    const storage = memoryStorage()
    let local = docWithGold(10)
    const api = {
      getSync: vi.fn(async () => null),
      putSync: vi.fn(async () => ({ version: '2', updatedAt: '2026-10-24T00:01:00.000Z' })),
    }
    const engine = createSyncEngine({
      storage,
      api: api as never,
      userId: 'u1',
      getLocalDocument: () => local,
      applyRemoteDocument: (doc) => {
        local = doc
      },
      getDevOffset: () => 0,
      isOnline: () => true,
    })
    engine.setServerVersion('1')
    engine.markDirty()
    expect(api.putSync).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1500)
    expect(api.putSync).toHaveBeenCalledTimes(1)
    const call = api.putSync.mock.calls[0] as unknown as [
      unknown,
      { ifMatch?: string; idempotencyKey: string },
    ]
    const opts = call[1]
    expect(opts.ifMatch).toBe('1')
    expect(typeof opts.idempotencyKey).toBe('string')
    expect(engine.getState().status).toBe('synced')
    expect(engine.getState().serverVersion).toBe('2')
  })

  it('creates the cloud save when none exists', async () => {
    const storage = memoryStorage()
    const api = {
      getSync: vi.fn(async () => null),
      putSync: vi.fn(async () => ({ version: '1', updatedAt: '2026-10-24T00:01:00.000Z' })),
    }
    const engine = createSyncEngine({
      storage,
      api: api as never,
      userId: 'u1',
      getLocalDocument: () => docWithGold(5),
      applyRemoteDocument: () => undefined,
      getDevOffset: () => 0,
      isOnline: () => true,
    })
    engine.markDirty()
    await vi.advanceTimersByTimeAsync(1500)
    const call = api.putSync.mock.calls[0] as unknown as [unknown, { create?: boolean }]
    expect(call[1].create).toBe(true)
  })

  it('pauses while the dev clock is offset', async () => {
    const api = {
      getSync: vi.fn(async () => null),
      putSync: vi.fn(async () => ({ version: '2', updatedAt: 'x' })),
    }
    const engine = createSyncEngine({
      storage: memoryStorage(),
      api: api as never,
      userId: 'u1',
      getLocalDocument: () => docWithGold(1),
      applyRemoteDocument: () => undefined,
      getDevOffset: () => 2,
      isOnline: () => true,
    })
    engine.markDirty()
    await vi.advanceTimersByTimeAsync(5000)
    expect(api.putSync).not.toHaveBeenCalled()
    expect(engine.getState().status).toBe('paused')
  })
})

describe('syncEngine pull and conflict', () => {
  it('pulls the cloud save when clean and applies it', async () => {
    const remote = docWithGold(99)
    let local = docWithGold(10)
    const api = {
      getSync: vi.fn(async () => ({
        version: '5',
        schemaVersion: 3,
        document: remote,
        updatedAt: '2026-10-24T00:02:00.000Z',
      })),
      putSync: vi.fn(async () => ({ version: '5', updatedAt: 'x' })),
    }
    const engine = createSyncEngine({
      storage: memoryStorage(),
      api: api as never,
      userId: 'u1',
      getLocalDocument: () => local,
      applyRemoteDocument: (doc) => {
        local = doc
      },
      getDevOffset: () => 0,
      isOnline: () => true,
    })
    engine.setServerVersion('4')
    await engine.pullNow()
    expect(local.profile?.gold).toBe(99)
    expect(engine.getState().serverVersion).toBe('5')
  })

  it('opens a conflict on 412 with both snapshots intact', async () => {
    const { SyncConflictError } = await import('@lifespire/api-client')
    let local = docWithGold(10)
    const remote = docWithGold(77)
    const api = {
      getSync: vi.fn(async () => ({
        version: '9',
        schemaVersion: 3,
        document: remote,
        updatedAt: '2026-10-24T00:03:00.000Z',
      })),
      putSync: vi.fn(async () => {
        throw new SyncConflictError('9', '2026-10-24T00:03:00.000Z')
      }),
    }
    const engine = createSyncEngine({
      storage: memoryStorage(),
      api: api as never,
      userId: 'u1',
      getLocalDocument: () => local,
      applyRemoteDocument: (doc) => {
        local = doc
      },
      getDevOffset: () => 0,
      isOnline: () => true,
    })
    engine.setServerVersion('8')
    engine.markDirty()
    await vi.advanceTimersByTimeAsync(1500)
    expect(engine.getState().status).toBe('conflict')
    expect(engine.getState().conflict?.local.profile?.gold).toBe(10)
    expect(engine.getState().conflict?.remote.profile?.gold).toBe(77)
    // Without a stored base the merge cannot run: the dialog explains why.
    expect(engine.getState().conflict?.conflicts.length).toBeGreaterThan(0)
  })

  it('keep-mine pushes over the remote version and keep-cloud adopts it', async () => {
    const { SyncConflictError } = await import('@lifespire/api-client')
    let local = docWithGold(10)
    const remote = docWithGold(77)
    const putSync = vi.fn()
    putSync.mockRejectedValueOnce(new SyncConflictError('9'))
    putSync.mockImplementationOnce(async (_doc: unknown, opts: { ifMatch?: string }) => {
      expect(opts.ifMatch).toBe('9')
      return { version: '10', updatedAt: '2026-10-24T00:04:00.000Z' }
    })
    const api = {
      getSync: vi.fn(async () => ({
        version: '9',
        schemaVersion: 3,
        document: remote,
        updatedAt: '2026-10-24T00:03:00.000Z',
      })),
      putSync,
    }
    const engine = createSyncEngine({
      storage: memoryStorage(),
      api: api as never,
      userId: 'u1',
      getLocalDocument: () => local,
      applyRemoteDocument: (doc) => {
        local = doc
      },
      getDevOffset: () => 0,
      isOnline: () => true,
    })
    engine.setServerVersion('8')
    engine.markDirty()
    await vi.advanceTimersByTimeAsync(1500)
    expect(engine.getState().status).toBe('conflict')

    await engine.resolveKeepMine()
    expect(engine.getState().status).toBe('synced')
    expect(engine.getState().serverVersion).toBe('10')
  })

  it('adoptLocal pulls cleanly when the local copy matches the last sync', async () => {
    const storage = memoryStorage()
    const doc = docWithGold(10)
    let local = doc
    const api = {
      getSync: vi.fn(async () => null),
      putSync: vi.fn(async () => ({ version: '3', updatedAt: '2026-10-24T00:05:00.000Z' })),
    }
    const first = createSyncEngine({
      storage,
      api: api as never,
      userId: 'u1',
      getLocalDocument: () => local,
      applyRemoteDocument: () => undefined,
      getDevOffset: () => 0,
      isOnline: () => true,
    })
    first.setServerVersion('2')
    first.markDirty()
    await vi.advanceTimersByTimeAsync(1500)
    expect(first.getState().serverVersion).toBe('3')
    first.dispose()

    // Simulate a reload: a fresh engine reads the stored checksum.
    const reloaded = createSyncEngine({
      storage,
      api: api as never,
      userId: 'u1',
      getLocalDocument: () => local,
      applyRemoteDocument: () => undefined,
      getDevOffset: () => 0,
      isOnline: () => true,
    })
    expect(reloaded.getState().serverVersion).toBe('3')
    reloaded.adoptLocal()
    await vi.advanceTimersByTimeAsync(0)
    // Clean: pull only, no push scheduled.
    expect(api.putSync).toHaveBeenCalledTimes(1)
    expect(api.getSync).toHaveBeenCalled()
    reloaded.dispose()
  })

  it('adoptLocal pushes when the local copy has unsynced edits', async () => {
    const storage = memoryStorage()
    const api = {
      getSync: vi.fn(async () => null),
      putSync: vi.fn(async () => ({ version: '4', updatedAt: '2026-10-24T00:06:00.000Z' })),
    }
    const engine = createSyncEngine({
      storage,
      api: api as never,
      userId: 'u1',
      getLocalDocument: () => docWithGold(10),
      applyRemoteDocument: () => undefined,
      getDevOffset: () => 0,
      isOnline: () => true,
    })
    engine.setServerVersion('3')
    // Local differs from the (absent) checksum: treated as unsynced.
    engine.adoptLocal()
    await vi.advanceTimersByTimeAsync(1500)
    expect(api.putSync).toHaveBeenCalled()
    engine.dispose()
  })
})

describe('syncEngine auto-merge', () => {
  it('merges disjoint edits on 412 and pushes without a dialog', async () => {
    const { SyncConflictError } = await import('@lifespire/api-client')
    const storage = memoryStorage()
    storage.setItem(accountBaseKey('u1'), JSON.stringify(docWithGold(10)))
    let local = docWithGold(20)
    const remote = docWithGold(30)
    const onBackup = vi.fn()
    const putSync = vi.fn()
    putSync.mockRejectedValueOnce(new SyncConflictError('9', '2026-10-24T00:03:00.000Z'))
    putSync.mockImplementationOnce(async (_doc: unknown, opts: { ifMatch?: string }) => {
      expect(opts.ifMatch).toBe('9')
      return { version: '10', updatedAt: '2026-10-24T00:04:00.000Z' }
    })
    const api = {
      getSync: vi.fn(async () => ({
        version: '9',
        schemaVersion: 3,
        document: remote,
        updatedAt: '2026-10-24T00:03:00.000Z',
      })),
      putSync,
    }
    const engine = createSyncEngine({
      storage,
      api: api as never,
      userId: 'u1',
      getLocalDocument: () => local,
      applyRemoteDocument: (doc) => {
        local = doc
      },
      getDevOffset: () => 0,
      isOnline: () => true,
      onBeforeAutoMergePush: onBackup,
    })
    engine.setServerVersion('8')
    engine.markDirty()
    await vi.advanceTimersByTimeAsync(1500)
    expect(api.putSync).toHaveBeenCalledTimes(2)
    expect(engine.getState().status).toBe('synced')
    expect(engine.getState().conflict).toBeNull()
    expect(engine.getState().lastAutoMergeAt).not.toBeNull()
    // 10 + (20 - 10) + (30 - 10): both deltas preserved, none lost.
    expect(local.profile?.gold).toBe(40)
    expect(onBackup).toHaveBeenCalledTimes(1)
    const stored = JSON.parse(storage.getItem(accountBaseKey('u1')) as string) as GameDocument
    expect(stored.profile?.gold).toBe(40)
    engine.dispose()
  })

  it('falls back to the dialog with reasons when the same field diverges', async () => {
    const { SyncConflictError } = await import('@lifespire/api-client')
    const storage = memoryStorage()
    storage.setItem(accountBaseKey('u1'), JSON.stringify(docWithGold(10)))
    const local = { ...docWithGold(10), profile: { ...docWithGold(10).profile!, name: 'Local name' } }
    const remote = { ...docWithGold(10), profile: { ...docWithGold(10).profile!, name: 'Remote name' } }
    const api = {
      getSync: vi.fn(async () => ({
        version: '9',
        schemaVersion: 3,
        document: remote,
        updatedAt: '2026-10-24T00:03:00.000Z',
      })),
      putSync: vi.fn(async () => {
        throw new SyncConflictError('9', '2026-10-24T00:03:00.000Z')
      }),
    }
    const engine = createSyncEngine({
      storage,
      api: api as never,
      userId: 'u1',
      getLocalDocument: () => local,
      applyRemoteDocument: () => undefined,
      getDevOffset: () => 0,
      isOnline: () => true,
    })
    engine.setServerVersion('8')
    engine.markDirty()
    await vi.advanceTimersByTimeAsync(1500)
    expect(engine.getState().status).toBe('conflict')
    expect(engine.getState().conflict?.conflicts.length).toBeGreaterThan(0)
    expect(engine.getState().lastAutoMergeAt).toBeNull()
    engine.dispose()
  })

  it('auto-merges on pull when dirty and the cloud moved', async () => {
    const storage = memoryStorage()
    storage.setItem(accountBaseKey('u1'), JSON.stringify(docWithGold(10)))
    let local = docWithGold(20)
    const remote = docWithGold(30)
    const api = {
      getSync: vi.fn(async () => ({
        version: '9',
        schemaVersion: 3,
        document: remote,
        updatedAt: '2026-10-24T00:03:00.000Z',
      })),
      putSync: vi.fn(async () => ({ version: '10', updatedAt: '2026-10-24T00:04:00.000Z' })),
    }
    const engine = createSyncEngine({
      storage,
      api: api as never,
      userId: 'u1',
      getLocalDocument: () => local,
      applyRemoteDocument: (doc) => {
        local = doc
      },
      getDevOffset: () => 0,
      isOnline: () => true,
    })
    engine.setServerVersion('8')
    engine.markDirty()
    await engine.pullNow()
    await vi.advanceTimersByTimeAsync(1500)
    expect(engine.getState().status).toBe('synced')
    expect(engine.getState().conflict).toBeNull()
    expect(local.profile?.gold).toBe(40)
    engine.dispose()
  })
})
