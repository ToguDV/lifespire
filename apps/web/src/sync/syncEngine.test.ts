import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiRequestError } from '@lifespire/api-client'
import { createEmptyDocument } from '../domain/schema'
import type { GameDocument } from '../domain/types'
import { accountBaseKey, accountMetaKey } from './storageKeys'
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

describe('syncEngine watch feed', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('applies a remote version announced by the watch and calls the notice hook', async () => {
    const storage = memoryStorage()
    let local = docWithGold(10)
    const remote = docWithGold(20)
    const onRemoteApplied = vi.fn()
    const watchSync = vi.fn(async () => ({ version: '2', updatedAt: '2026-10-24T00:02:00.000Z' }))
    const getSync = vi.fn(async () => ({
      version: '2',
      schemaVersion: 3,
      document: remote,
      updatedAt: '2026-10-24T00:02:00.000Z',
    }))
    const engine = createSyncEngine({
      storage,
      api: { getSync, putSync: vi.fn(), watchSync } as never,
      userId: 'u1',
      getLocalDocument: () => local,
      applyRemoteDocument: (doc) => {
        local = doc
      },
      onRemoteApplied,
      getDevOffset: () => 0,
      isOnline: () => true,
    })
    engine.setServerVersion('1')
    engine.startWatching()

    await vi.waitFor(() => expect(onRemoteApplied).toHaveBeenCalledTimes(1))
    expect(watchSync).toHaveBeenCalledWith('1', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(getSync).toHaveBeenCalledWith('1')
    expect(local.profile?.gold).toBe(20)
    expect(engine.getState().serverVersion).toBe('2')
    expect(engine.getState().status).toBe('synced')
    engine.stopWatching()
    engine.dispose()
  })

  it('ignores its own version and does not pull', async () => {
    const storage = memoryStorage()
    const getSync = vi.fn()
    const engine = createSyncEngine({
      storage,
      api: {
        getSync,
        putSync: vi.fn(),
        watchSync: vi.fn(async () => ({ version: '1', updatedAt: '2026-10-24T00:00:00.000Z' })),
      } as never,
      userId: 'u1',
      getLocalDocument: () => docWithGold(1),
      applyRemoteDocument: vi.fn(),
      getDevOffset: () => 0,
      isOnline: () => true,
    })
    engine.setServerVersion('1')
    engine.startWatching()

    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(getSync).not.toHaveBeenCalled()
    engine.stopWatching()
    engine.dispose()
  })

  it('defers a watch pull while a push is in flight and advances the cursor', async () => {
    const storage = memoryStorage()
    let local = docWithGold(10)
    let releasePush: (value: { version: string; updatedAt: string }) => void = () => undefined
    const putSync = vi.fn(
      () =>
        new Promise<{ version: string; updatedAt: string }>((resolve) => {
          releasePush = resolve
        }),
    )
    const watchSync = vi
      .fn()
      .mockResolvedValueOnce({ version: '3', updatedAt: '2026-10-24T00:02:00.000Z' })
      .mockImplementation(() => new Promise(() => undefined))
    const remote = docWithGold(30)
    const getSync = vi.fn(async () => ({
      version: '3',
      schemaVersion: 3,
      document: remote,
      updatedAt: '2026-10-24T00:02:00.000Z',
    }))
    const onRemoteApplied = vi.fn()
    const engine = createSyncEngine({
      storage,
      api: { getSync, putSync, watchSync } as never,
      userId: 'u1',
      getLocalDocument: () => local,
      applyRemoteDocument: (doc) => {
        local = doc
      },
      onRemoteApplied,
      getDevOffset: () => 0,
      isOnline: () => true,
      pushDelayMs: 1,
    })
    engine.setServerVersion('1')
    engine.markDirty()

    await vi.waitFor(() => expect(putSync).toHaveBeenCalledTimes(1))
    engine.startWatching()

    await vi.waitFor(() => expect(watchSync.mock.calls.length).toBeGreaterThanOrEqual(2))
    expect(watchSync.mock.calls[1]?.[0]).toBe('3')
    expect(getSync).not.toHaveBeenCalled()

    releasePush({ version: '2', updatedAt: '2026-10-24T00:02:00.000Z' })
    await vi.waitFor(() => expect(onRemoteApplied).toHaveBeenCalledTimes(1))
    expect(local.profile?.gold).toBe(30)
    expect(engine.getState().serverVersion).toBe('3')
    engine.stopWatching()
    engine.dispose()
  })

  it('flushes a watch notification that arrived during an in-flight pull', async () => {
    const storage = memoryStorage()
    let local = docWithGold(10)
    let releaseFirstPull: (value: {
      version: string
      schemaVersion: number
      document: GameDocument
      updatedAt: string
    }) => void = () => undefined
    const firstPull = new Promise<{
      version: string
      schemaVersion: number
      document: GameDocument
      updatedAt: string
    }>((resolve) => {
      releaseFirstPull = resolve
    })
    const getSync = vi
      .fn()
      .mockImplementationOnce(() => firstPull)
      .mockResolvedValueOnce({
        version: '3',
        schemaVersion: 3,
        document: docWithGold(30),
        updatedAt: '2026-10-24T00:03:00.000Z',
      })
    const watchSync = vi
      .fn()
      .mockResolvedValueOnce({ version: '3', updatedAt: '2026-10-24T00:03:00.000Z' })
      .mockImplementation(() => new Promise(() => undefined))
    const onRemoteApplied = vi.fn()
    const engine = createSyncEngine({
      storage,
      api: { getSync, putSync: vi.fn(), watchSync } as never,
      userId: 'u1',
      getLocalDocument: () => local,
      applyRemoteDocument: (doc) => {
        local = doc
      },
      onRemoteApplied,
      getDevOffset: () => 0,
      isOnline: () => true,
    })
    engine.setServerVersion('1')
    void engine.pullNow()
    engine.startWatching()

    await vi.waitFor(() => expect(watchSync).toHaveBeenCalled())
    expect(getSync).toHaveBeenCalledTimes(1)
    releaseFirstPull({
      version: '2',
      schemaVersion: 3,
      document: docWithGold(20),
      updatedAt: '2026-10-24T00:02:00.000Z',
    })

    await vi.waitFor(() => expect(onRemoteApplied).toHaveBeenCalledTimes(1))
    expect(getSync).toHaveBeenCalledTimes(2)
    expect(local.profile?.gold).toBe(30)
    expect(engine.getState().serverVersion).toBe('3')
    engine.stopWatching()
    engine.dispose()
  })

  it('accepts the server version when it is lower than the old cursor', async () => {
    const storage = memoryStorage()
    let local = docWithGold(10)
    const watchSync = vi
      .fn()
      .mockResolvedValueOnce({ version: '1', updatedAt: '2026-10-24T00:01:00.000Z' })
      .mockImplementation(() => new Promise(() => undefined))
    const getSync = vi.fn(async () => ({
      version: '1',
      schemaVersion: 3,
      document: docWithGold(5),
      updatedAt: '2026-10-24T00:01:00.000Z',
    }))
    const engine = createSyncEngine({
      storage,
      api: { getSync, putSync: vi.fn(), watchSync } as never,
      userId: 'u1',
      getLocalDocument: () => local,
      applyRemoteDocument: (doc) => {
        local = doc
      },
      getDevOffset: () => 0,
      isOnline: () => true,
    })
    engine.setServerVersion('3')
    engine.startWatching()

    await vi.waitFor(() => expect(watchSync.mock.calls.length).toBeGreaterThanOrEqual(2))
    expect(watchSync.mock.calls[1]?.[0]).toBe('1')
    expect(local.profile?.gold).toBe(5)
    expect(engine.getState().serverVersion).toBe('1')
    engine.stopWatching()
    engine.dispose()
  })

  it('aborts a zombie long-poll with the watchdog and keeps retrying', async () => {
    const storage = memoryStorage()
    const observed: { signal: AbortSignal | null } = { signal: null }
    const watchSync = vi.fn(
      (_since?: string, opts?: { signal?: AbortSignal }) =>
        new Promise<{ version: string; updatedAt: string }>((_resolve, reject) => {
          observed.signal = opts?.signal ?? null
          opts?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        }),
    )
    const engine = createSyncEngine({
      storage,
      api: { getSync: vi.fn(), putSync: vi.fn(), watchSync } as never,
      userId: 'u1',
      getLocalDocument: () => docWithGold(1),
      applyRemoteDocument: vi.fn(),
      getDevOffset: () => 0,
      isOnline: () => true,
      watchRequestTimeoutMs: 20,
    })
    engine.setServerVersion('1')
    engine.startWatching()

    await vi.waitFor(() => expect(observed.signal).not.toBeNull())
    await vi.waitFor(() => expect(observed.signal?.aborted).toBe(true))
    await vi.waitFor(() => expect(engine.getState().status).toBe('error'))
    engine.stopWatching()
    engine.dispose()
  })

  it('stops the loop and aborts the pending request', async () => {
    const storage = memoryStorage()
    const observed: { signal: AbortSignal | null } = { signal: null }
    const watchSync = vi.fn(async (_since?: string, opts?: { signal?: AbortSignal }) => {
      observed.signal = opts?.signal ?? null
      return new Promise<{ version: string; updatedAt: string }>(() => undefined)
    })
    const engine = createSyncEngine({
      storage,
      api: { getSync: vi.fn(), putSync: vi.fn(), watchSync } as never,
      userId: 'u1',
      getLocalDocument: () => docWithGold(1),
      applyRemoteDocument: vi.fn(),
      getDevOffset: () => 0,
      isOnline: () => true,
    })
    engine.setServerVersion('1')
    engine.startWatching()
    await vi.waitFor(() => expect(watchSync).toHaveBeenCalledTimes(1))

    engine.stopWatching()
    expect(observed.signal?.aborted).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(watchSync).toHaveBeenCalledTimes(1)
    engine.dispose()
  })

  it('falls back to polling when the server lacks the watch endpoint', async () => {
    const storage = memoryStorage()
    const getSync = vi.fn(async () => null)
    const engine = createSyncEngine({
      storage,
      api: {
        getSync,
        putSync: vi.fn(),
        watchSync: vi.fn(async () => {
          throw new ApiRequestError(404, 'Not found')
        }),
      } as never,
      userId: 'u1',
      getLocalDocument: () => docWithGold(1),
      applyRemoteDocument: vi.fn(),
      getDevOffset: () => 0,
      isOnline: () => true,
      pollIntervalMs: 10,
    })
    engine.setServerVersion('1')
    engine.startWatching()

    await vi.waitFor(() => expect(getSync).toHaveBeenCalled())
    engine.stopPolling()
    engine.stopWatching()
    engine.dispose()
  })

  it('keeps local data and clears the stale cursor when the cloud save is deleted', async () => {
    const storage = memoryStorage()
    const onCloudDeleted = vi.fn()
    storage.setItem(
      accountMetaKey('u1'),
      JSON.stringify({ version: '3', updatedAt: '2026-10-24T00:00:00.000Z', checksum: 'c' }),
    )
    let local = docWithGold(12)
    const engine = createSyncEngine({
      storage,
      api: {
        getSync: vi.fn(),
        putSync: vi.fn(),
        watchSync: vi.fn(async () => ({ version: null, updatedAt: null })),
      } as never,
      userId: 'u1',
      getLocalDocument: () => local,
      applyRemoteDocument: (doc) => {
        local = doc
      },
      onCloudDeleted,
      getDevOffset: () => 0,
      isOnline: () => true,
    })
    engine.setServerVersion('3')
    engine.startWatching()

    await vi.waitFor(() => expect(onCloudDeleted).toHaveBeenCalledTimes(1))
    expect(engine.getState().serverVersion).toBeNull()
    expect(engine.getState().status).toBe('dirty')
    expect(local.profile?.gold).toBe(12)
    expect(storage.getItem(accountMetaKey('u1'))).toBeNull()
    engine.stopWatching()
    engine.dispose()
  })
})
