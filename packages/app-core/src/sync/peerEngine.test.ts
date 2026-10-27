import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '@lifespire/core'
import type { GameDocument } from '@lifespire/core'
import type { LocalPeerApi, PeerSnapshot } from './protocol'
import { createPeerSyncEngine } from './peerEngine'
import { SyncConflictError } from './errors'
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

function createHarness(options: { local?: GameDocument | null; peer?: GameDocument | null; seedBase?: GameDocument }) {
  const storage = makeStorage()
  const peer = new FakePeer()
  const local = { current: options.local ?? null }
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
  })
  return { storage, peer, local, engine }
}

describe('createPeerSyncEngine', () => {
  it('pulls when this device has no save', async () => {
    const remote = makeDocument('Remote')
    const { local, engine } = createHarness({ peer: remote })
    engine.adoptLocal()
    await vi.waitFor(() => expect(local.current?.profile?.name).toBe('Remote'))
    expect(engine.getState().status).toBe('synced')
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

describe('manual sync', () => {
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
