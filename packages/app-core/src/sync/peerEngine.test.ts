import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '@lifespire/core'
import type { GameDocument } from '@lifespire/core'
import type { LocalPeerApi, PeerSnapshot } from './protocol'
import { createPeerSyncEngine } from './peerEngine'
import { LocalSyncError, SyncConflictError } from './errors'
import { checksumDocument } from './checksum'
import { peerBaseKey, peerMetaKey } from './storageKeys'

function makeDocument(name = 'Wren'): GameDocument {
  const document = createEmptyDocument()
  document.profile = {
    id: 'profile_1',
    name,
    xp: 100,
    level: 2,
    gold: 50,
    loot: [],
    createdAt: '2026-10-20T09:00:00.000Z',
  }
  return document
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function makeStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
    values,
  }
}

class FakePeer implements LocalPeerApi {
  document: GameDocument | null = null
  updatedAt = '2026-10-27T10:00:00.000Z'

  async getInfo(): Promise<{ version: string; updatedAt: string } | null> {
    if (!this.document) return null
    return { version: checksumDocument(this.document), updatedAt: this.updatedAt }
  }

  async getSync(ifMatch?: string): Promise<PeerSnapshot | null> {
    if (!this.document) return null
    const version = checksumDocument(this.document)
    if (ifMatch === version) return null
    return {
      version,
      schemaVersion: 3,
      document: clone(this.document),
      updatedAt: this.updatedAt,
    }
  }

  async putSync(
    document: unknown,
    options: { ifMatch?: string; create?: boolean },
  ): Promise<{ version: string; updatedAt: string }> {
    const current = this.document ? checksumDocument(this.document) : null
    if (options.create) {
      if (current) throw new SyncConflictError(current, this.updatedAt)
    } else if ((options.ifMatch ?? null) !== current) {
      throw new SyncConflictError(current ?? '', this.updatedAt)
    }
    this.document = clone(document as GameDocument)
    this.updatedAt = `2026-10-27T10:0${Math.floor(Math.random() * 9)}:00.000Z`
    return { version: checksumDocument(this.document), updatedAt: this.updatedAt }
  }
}

function createHarness(options: {
  local?: GameDocument | null
  peer?: GameDocument | null
  seedBase?: GameDocument
  conflictCheckMs?: number
}) {
  const storage = makeStorage()
  const peer = new FakePeer()
  const local = { current: options.local ?? null }
  const resolved: Array<'local' | 'peer'> = []
  let localAdopted = 0
  peer.document = options.peer ?? null
  if (options.seedBase) {
    const hash = checksumDocument(options.seedBase)
    storage.setItem(peerBaseKey('peer_1'), JSON.stringify(options.seedBase))
    storage.setItem(
      peerMetaKey('peer_1'),
      JSON.stringify({ version: hash, updatedAt: peer.updatedAt, checksum: hash }),
    )
  }
  const engine = createPeerSyncEngine({
    storage,
    api: peer,
    peerId: 'peer_1',
    getLocalDocument: () => local.current ?? createEmptyDocument(),
    applyRemoteDocument: (document) => {
      local.current = clone(document)
    },
    isAvailable: () => true,
    pushDelayMs: 0,
    useLocks: false,
    now: () => new Date('2026-10-27T10:00:00.000Z'),
    ...(options.conflictCheckMs !== undefined
      ? { conflictCheckMs: options.conflictCheckMs }
      : {}),
    onConflictResolved: (outcome) => resolved.push(outcome),
    onLocalAdopted: () => {
      localAdopted += 1
    },
  })
  return {
    storage,
    peer,
    local,
    engine,
    resolved,
    localAdopted: () => localAdopted,
  }
}

describe('createPeerSyncEngine', () => {
  it('pulls when this device has no save', async () => {
    const remote = makeDocument('Remote')
    const { local, engine, resolved } = createHarness({ peer: remote })
    engine.adoptLocal()
    await vi.waitFor(() => expect(local.current?.profile?.name).toBe('Remote'))
    expect(engine.getState().status).toBe('synced')
    expect(resolved).toEqual([])
  })

  it('pushes when the peer has no save', async () => {
    const own = makeDocument('Mine')
    const { local, peer, engine } = createHarness({ local: own })
    local.current = own
    peer.document = null
    engine.markDirty()
    await vi.waitFor(() => expect(peer.document?.profile?.name).toBe('Mine'))
    expect(engine.getState().status).toBe('synced')
  })

  it('auto-merges disjoint edits over the stored base', async () => {
    const base = makeDocument('Wren')
    const localDoc = clone(base)
    localDoc.profile!.gold = 75
    const peerDoc = clone(base)
    peerDoc.settings.theme = 'dark'

    const { local, peer, engine } = createHarness({
      local: localDoc,
      peer: peerDoc,
      seedBase: base,
    })
    engine.markDirty()
    await vi.waitFor(() => {
      expect(peer.document?.profile?.gold).toBe(75)
      expect(peer.document?.settings.theme).toBe('dark')
    })
    expect(local.current?.profile?.gold).toBe(75)
    expect(local.current?.settings.theme).toBe('dark')
    expect(engine.getState().lastAutoMergeAt).not.toBeNull()
  })

  it('opens a conflict when both sides edit the same field', async () => {
    const base = makeDocument('Wren')
    const localDoc = clone(base)
    localDoc.profile!.name = 'Mine'
    const peerDoc = clone(base)
    peerDoc.profile!.name = 'Theirs'

    const { engine } = createHarness({ local: localDoc, peer: peerDoc, seedBase: base })
    engine.markDirty()
    await vi.waitFor(() => expect(engine.getState().status).toBe('conflict'))
    expect(engine.getState().conflict?.conflicts.length).toBeGreaterThan(0)
  })

  it('resolves keep-mine and keep-peer', async () => {
    const base = makeDocument('Wren')
    const localDoc = clone(base)
    localDoc.profile!.name = 'Mine'
    const peerDoc = clone(base)
    peerDoc.profile!.name = 'Theirs'

    const { engine, peer, local } = createHarness({
      local: localDoc,
      peer: peerDoc,
      seedBase: base,
    })
    engine.markDirty()
    await vi.waitFor(() => expect(engine.getState().status).toBe('conflict'))

    await engine.resolveKeepMine()
    expect(peer.document?.profile?.name).toBe('Mine')
    expect(engine.getState().status).toBe('synced')

    const second = createHarness({ local: localDoc, peer: peerDoc, seedBase: base })
    second.engine.markDirty()
    await vi.waitFor(() => expect(second.engine.getState().status).toBe('conflict'))
    second.engine.resolveKeepPeer()
    expect(second.local.current?.profile?.name).toBe('Theirs')
    expect(second.engine.getState().status).toBe('synced')
    expect(local.current?.profile?.name).toBe('Mine')
  })

  it('adopts an incoming document without a conflict', () => {
    const incoming = makeDocument('Incoming')
    const { engine } = createHarness({ local: makeDocument('Mine') })
    engine.adoptIncoming(incoming, checksumDocument(incoming), '2026-10-27T11:00:00.000Z')
    expect(engine.getState().status).toBe('synced')
    expect(engine.getState().peerVersion).toBe(checksumDocument(incoming))
    expect(engine.getState().conflict).toBeNull()
  })
})

describe('receiveRemote', () => {
  it('merges a pushed document with unsynced local edits instead of overwriting them', async () => {
    const base = makeDocument('Wren')
    const localDoc = clone(base)
    localDoc.profile!.gold = 75
    const incoming = clone(base)
    incoming.settings.theme = 'dark'
    const { local, peer, engine } = createHarness({
      local: localDoc,
      peer: base,
      seedBase: base,
    })
    const result = await engine.receiveRemote(incoming, '2026-10-27T12:00:00.000Z')
    expect(result).toBe('applied')
    expect(local.current?.profile?.gold).toBe(75)
    expect(local.current?.settings.theme).toBe('dark')
    expect(engine.getState().status).toBe('dirty')
    await vi.waitFor(() => {
      expect(peer.document?.profile?.gold).toBe(75)
      expect(peer.document?.settings.theme).toBe('dark')
    })
  })

  it('opens a conflict when the incoming document touches the same field', async () => {
    const base = makeDocument('Wren')
    const localDoc = clone(base)
    localDoc.profile!.name = 'Mine'
    const incoming = clone(base)
    incoming.profile!.name = 'Theirs'
    const { local, engine } = createHarness({
      local: localDoc,
      peer: base,
      seedBase: base,
    })
    const result = await engine.receiveRemote(incoming, '2026-10-27T12:00:00.000Z')
    expect(result).toBe('conflict')
    expect(engine.getState().status).toBe('conflict')
    expect(local.current?.profile?.name).toBe('Mine')
  })

  it('asks instead of merging two different saves on the first sync', async () => {
    const localDoc = makeDocument('Mine')
    const incoming = makeDocument('Theirs')
    const { engine } = createHarness({ local: localDoc, peer: null })
    const result = await engine.receiveRemote(incoming, '2026-10-27T12:00:00.000Z')
    expect(result).toBe('conflict')
    expect(engine.getState().conflict?.conflicts[0]).toMatch(/first sync/i)
  })
})

describe('shared conflict decisions', () => {
  function conflictHarness(options: { conflictCheckMs?: number } = {}) {
    const base = makeDocument('Wren')
    const localDoc = clone(base)
    localDoc.profile!.name = 'Mine'
    const peerDoc = clone(base)
    peerDoc.profile!.name = 'Theirs'
    return {
      base,
      localDoc,
      peerDoc,
      ...createHarness({
        local: localDoc,
        peer: peerDoc,
        seedBase: base,
        ...(options.conflictCheckMs !== undefined
          ? { conflictCheckMs: options.conflictCheckMs }
          : {}),
      }),
    }
  }

  it('adopts the peer copy when its decision arrives as a push', async () => {
    const harness = conflictHarness()
    harness.engine.markDirty()
    await vi.waitFor(() => expect(harness.engine.getState().status).toBe('conflict'))
    const conflict = harness.engine.getState().conflict
    expect(conflict).not.toBeNull()

    const result = await harness.engine.receiveRemote(
      clone(conflict!.remote),
      '2026-10-27T12:05:00.000Z',
    )

    expect(result).toBe('applied')
    expect(harness.local.current?.profile?.name).toBe('Theirs')
    expect(harness.engine.getState().conflict).toBeNull()
    expect(harness.engine.getState().needsReview).toBe(false)
    expect(harness.engine.getState().status).toBe('synced')
    expect(harness.resolved).toEqual(['peer'])
    harness.engine.dispose()
  })

  it('clears the conflict once the peer accepts this device copy', async () => {
    const harness = conflictHarness({ conflictCheckMs: 5 })
    harness.engine.markDirty()
    await vi.waitFor(() => expect(harness.engine.getState().status).toBe('conflict'))

    harness.peer.document = clone(harness.localDoc)
    await vi.waitFor(() => expect(harness.engine.getState().status).toBe('synced'))

    expect(harness.engine.getState().conflict).toBeNull()
    expect(harness.engine.getState().needsReview).toBe(false)
    expect(harness.local.current?.profile?.name).toBe('Mine')
    expect(harness.resolved).toEqual(['local'])
    expect(harness.localAdopted()).toBe(1)
    harness.engine.dispose()
  })

  it('stops polling after a revoked pairing', async () => {
    const harness = conflictHarness({ conflictCheckMs: 50 })
    harness.engine.markDirty()
    await vi.waitFor(() => expect(harness.engine.getState().status).toBe('conflict'))

    const getInfo = vi
      .spyOn(harness.peer, 'getInfo')
      .mockRejectedValue(new LocalSyncError('Pairing token required.', { status: 401 }))

    harness.engine.checkConflictResolution()
    await vi.waitFor(() => expect(harness.engine.getState().status).toBe('error'))
    const calls = getInfo.mock.calls.length
    await new Promise((resolve) => setTimeout(resolve, 140))

    expect(getInfo.mock.calls.length).toBe(calls)
    expect(harness.engine.getState().needsReview).toBe(true)
    expect(harness.engine.getState().lastError).toMatch(/pair both devices again/i)
    harness.engine.dispose()
  })

  it('ignores an in-flight decision check after dispose', async () => {
    const harness = conflictHarness()
    harness.engine.markDirty()
    await vi.waitFor(() => expect(harness.engine.getState().status).toBe('conflict'))
    const metaBefore = harness.storage.values.get(peerMetaKey('peer_1'))
    expect(metaBefore).toBeTruthy()

    let resolveInfo: ((value: { version: string; updatedAt: string } | null) => void) | null =
      null
    vi.spyOn(harness.peer, 'getInfo').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInfo = resolve
        }),
    )

    harness.engine.checkConflictResolution()
    await vi.waitFor(() => expect(resolveInfo).not.toBeNull())
    harness.engine.dispose()
    resolveInfo!({
      version: checksumDocument(harness.local.current!),
      updatedAt: '2026-10-27T12:30:00.000Z',
    })
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(harness.engine.getState().status).toBe('conflict')
    expect(harness.storage.values.get(peerMetaKey('peer_1'))).toBe(metaBefore)
  })

  it('does not adopt a different newer peer copy without a decision', async () => {
    const harness = conflictHarness()
    harness.engine.markDirty()
    await vi.waitFor(() => expect(harness.engine.getState().status).toBe('conflict'))

    const newer = clone(harness.peerDoc)
    newer.settings.theme = 'dark'
    const result = await harness.engine.receiveRemote(newer, '2026-10-27T12:06:00.000Z')

    expect(result).toBe('conflict')
    expect(harness.local.current?.profile?.name).toBe('Mine')
    expect(harness.engine.getState().status).toBe('conflict')
    expect(harness.engine.getState().conflict?.remoteUpdatedAt).toBe(
      '2026-10-27T12:06:00.000Z',
    )
    harness.engine.dispose()
  })

  it('does not replay a peer decision over edits made after the conflict', async () => {
    const first = conflictHarness()
    first.engine.markDirty()
    await vi.waitFor(() => expect(first.engine.getState().status).toBe('conflict'))
    first.engine.dispose()

    const restarted = createPeerSyncEngine({
      storage: first.storage,
      api: first.peer,
      peerId: 'peer_1',
      getLocalDocument: () => first.local.current ?? createEmptyDocument(),
      applyRemoteDocument: (document) => {
        first.local.current = clone(document)
      },
      isAvailable: () => true,
      pushDelayMs: 0,
      useLocks: false,
      now: () => new Date('2026-10-27T12:10:00.000Z'),
    })
    first.local.current = clone(first.localDoc)
    first.local.current.profile!.name = 'Edited later'

    const result = await restarted.receiveRemote(
      clone(first.peerDoc),
      '2026-10-27T12:11:00.000Z',
    )

    expect(result).toBe('conflict')
    expect(first.local.current?.profile?.name).toBe('Edited later')
    expect(restarted.getState().conflict).not.toBeNull()
    restarted.dispose()
  })

  it('recognises a peer decision replayed after a restart', async () => {
    const first = conflictHarness()
    first.engine.markDirty()
    await vi.waitFor(() => expect(first.engine.getState().status).toBe('conflict'))
    first.engine.dispose()

    const restarted = createPeerSyncEngine({
      storage: first.storage,
      api: first.peer,
      peerId: 'peer_1',
      getLocalDocument: () => first.local.current ?? createEmptyDocument(),
      applyRemoteDocument: (document) => {
        first.local.current = clone(document)
      },
      isAvailable: () => true,
      pushDelayMs: 0,
      useLocks: false,
      now: () => new Date('2026-10-27T12:10:00.000Z'),
    })
    expect(restarted.getState().needsReview).toBe(true)
    expect(restarted.getState().conflict).toBeNull()

    const result = await restarted.receiveRemote(
      clone(first.peerDoc),
      '2026-10-27T12:11:00.000Z',
    )

    expect(result).toBe('applied')
    expect(first.local.current?.profile?.name).toBe('Theirs')
    expect(restarted.getState().conflict).toBeNull()
    expect(restarted.getState().needsReview).toBe(false)
    restarted.dispose()
  })
})

describe('multi-peer safety', () => {
  it('pauses automatic sync while another peer has an unresolved conflict', async () => {
    const own = makeDocument('Mine')
    const remote = makeDocument('Remote')
    const storage = makeStorage()
    const peer = new FakePeer()
    peer.document = remote
    const local = { current: own }
    const engine = createPeerSyncEngine({
      storage,
      api: peer,
      peerId: 'peer_1',
      getLocalDocument: () => local.current,
      applyRemoteDocument: (document) => {
        local.current = clone(document)
      },
      isAvailable: () => true,
      isBlocked: () => true,
      pushDelayMs: 0,
      useLocks: false,
      now: () => new Date('2026-10-27T10:00:00.000Z'),
    })
    const getInfo = vi.spyOn(peer, 'getInfo')
    const getSync = vi.spyOn(peer, 'getSync')
    const putSync = vi.spyOn(peer, 'putSync')

    engine.adoptLocal()
    engine.markDirty()
    await engine.pullNow()
    await engine.syncNow()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(getInfo).not.toHaveBeenCalled()
    expect(getSync).not.toHaveBeenCalled()
    expect(putSync).not.toHaveBeenCalled()
    expect(local.current.profile?.name).toBe('Mine')
    expect(peer.document?.profile?.name).toBe('Remote')
    engine.dispose()
  })
})

describe('manual sync', () => {
  it('reports offline with guidance when the peer is unreachable', async () => {
    const own = makeDocument('Mine')
    const storage = makeStorage()
    const unreachable = Object.assign(new Error('connect EHOSTUNREACH 192.168.1.18:39741'), {
      code: 'EHOSTUNREACH',
    })
    const failingApi: LocalPeerApi = {
      getInfo: async () => {
        throw unreachable
      },
      getSync: async () => {
        throw unreachable
      },
      putSync: async () => {
        throw unreachable
      },
    }
    const local = { current: own }
    const engine = createPeerSyncEngine({
      storage,
      api: failingApi,
      peerId: 'peer_1',
      getLocalDocument: () => local.current ?? createEmptyDocument(),
      applyRemoteDocument: (document) => {
        local.current = clone(document)
      },
      isAvailable: () => false,
      pushDelayMs: 0,
      useLocks: false,
      now: () => new Date('2026-10-27T10:00:00.000Z'),
    })
    await engine.syncNow()
    expect(engine.getState().status).toBe('offline')
    expect(engine.getState().lastError).toBe(
      "Couldn't reach the other device. Make sure both apps are open on the same Wi-Fi.",
    )
  })

  it('tries the last known peer even when discovery has not reported it', async () => {
    const own = makeDocument('Mine')
    const { local, peer } = createHarness({ local: own, peer: null })
    local.current = own
    // The harness reports the peer as available; simulate a discovery miss by
    // forcing the engine's public availability to false through a new harness.
    const storage = makeStorage()
    const remote = new FakePeer()
    const offlineLocal = { current: own }
    const offline = createPeerSyncEngine({
      storage,
      api: remote,
      peerId: 'peer_1',
      getLocalDocument: () => offlineLocal.current ?? createEmptyDocument(),
      applyRemoteDocument: (document) => {
        offlineLocal.current = clone(document)
      },
      isAvailable: () => false,
      pushDelayMs: 0,
      useLocks: false,
      now: () => new Date('2026-10-27T10:00:00.000Z'),
    })
    await offline.syncNow()
    await vi.waitFor(() => expect(remote.document?.profile?.name).toBe('Mine'))
    expect(offline.getState().status).toBe('synced')
    expect(peer.document).toBeNull()
  })
})

describe('conflict persistence', () => {
  it('survives a restart and reviews instead of pushing the local copy blindly', async () => {
    const base = makeDocument('Wren')
    const localDoc = clone(base)
    localDoc.profile!.name = 'Mine'
    const peerDoc = clone(base)
    peerDoc.profile!.name = 'Theirs'
    const first = createHarness({ local: localDoc, peer: peerDoc, seedBase: base })
    const result = await first.engine.receiveRemote(
      peerDoc,
      '2026-10-27T12:00:00.000Z',
    )
    expect(result).toBe('conflict')

    const restarted = createPeerSyncEngine({
      storage: first.storage,
      api: first.peer,
      peerId: 'peer_1',
      getLocalDocument: () => first.local.current ?? createEmptyDocument(),
      applyRemoteDocument: (document) => {
        first.local.current = clone(document)
      },
      isAvailable: () => true,
      pushDelayMs: 0,
      useLocks: false,
      now: () => new Date('2026-10-27T12:05:00.000Z'),
    })
    expect(restarted.getState().status).toBe('conflict')
    expect(restarted.getState().needsReview).toBe(true)
    restarted.adoptLocal()
    await vi.waitFor(() => expect(restarted.getState().conflict).not.toBeNull())
    expect(restarted.getState().conflict?.conflicts[0]).toBeTruthy()
    expect(first.local.current?.profile?.name).toBe('Mine')
  })
})
