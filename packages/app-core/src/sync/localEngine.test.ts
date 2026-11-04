import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '@lifespire/core'
import type { GameDocument } from '@lifespire/core'
import type {
  IncomingDocument,
  LocalTransport,
  NearbyPeer,
  PeerRecord,
  PeerRequest,
} from './protocol'
import { createLocalSyncEngine } from './localEngine'
import { checksumDocument } from './checksum'

const PEER_ID = 'peer-1234-abcd'
const FINGERPRINT = 'fingerprint-abcdefghijklmnop'

function makeDocument(name: string | null, theme: 'system' | 'dark' = 'system'): GameDocument {
  const document = createEmptyDocument()
  document.settings.theme = theme
  if (name) {
    document.profile = {
      id: `profile_${name}`,
      name,
      xp: 100,
      level: 2,
      gold: 50,
      loot: [],
      createdAt: '2026-10-20T09:00:00.000Z',
    }
  }
  return document
}

function makeNearby(platform?: NearbyPeer['platform']): NearbyPeer {
  return {
    deviceId: PEER_ID,
    name: 'Phone',
    host: '127.0.0.1',
    port: 45555,
    fingerprint: FINGERPRINT,
    lastSeenAt: '2026-10-27T09:00:00.000Z',
    ...(platform ? { platform } : {}),
  }
}

function createHarness(
  initial: GameDocument,
  options: { requestStatus?: number; requestError?: Error; pairError?: Error } = {},
) {
  const local = { current: initial }
  const requests: Array<{ peerId: string; request: PeerRequest }> = []
  const acks: Array<{ id: string; ok: boolean }> = []
  const peerListeners = new Set<(peers: NearbyPeer[]) => void>()
  const incomingListeners = new Set<(item: IncomingDocument) => void>()
  let startCount = 0
  let stopCount = 0
  let setDocumentCount = 0
  let infoDocHash: string | null = null
  let peer: PeerRecord = {
    peerId: PEER_ID,
    name: 'Phone',
    fingerprint: FINGERPRINT,
    autoSync: false,
    pairedAt: '2026-10-27T09:00:00.000Z',
    lastSyncAt: null,
  }
  let nearby: NearbyPeer[] = [
    {
      deviceId: PEER_ID,
      name: 'Phone',
      host: '127.0.0.1',
      port: 45555,
      fingerprint: FINGERPRINT,
      lastSeenAt: '2026-10-27T09:00:00.000Z',
    },
  ]

  const transport: LocalTransport = {
    available: true,
    start: async () => {
      startCount += 1
      return { deviceId: 'local-1234-abcd', name: 'Desk', fingerprint: 'local-fingerprint-abcdef' }
    },
    stop: async () => {
      stopCount += 1
    },
    setDiscoverable: async () => undefined,
    setDocument: async () => {
      setDocumentCount += 1
    },
    pendingIncoming: async () => [],
    ackIncoming: async (id, result) => {
      acks.push({ id, ok: result.ok })
    },
    listPeers: async () => [peer],
    listNearby: async () => nearby,
    startPairing: async () => {
      throw new Error('not used')
    },
    cancelPairing: async () => undefined,
    pair: async () => {
      if (options.pairError) throw options.pairError
      return peer
    },
    pairWithCode: async () => {
      if (options.pairError) throw options.pairError
      return peer
    },
    forget: async () => undefined,
    setAutoSync: async (_peerId, autoSync) => {
      peer = { ...peer, autoSync }
    },
    request: async (peerId, request) => {
      requests.push({ peerId, request })
      if (options.requestError) throw options.requestError
      if (options.requestStatus !== undefined) {
        return {
          status: options.requestStatus,
          body: { message: 'Pairing token required.' },
        }
      }
      if (request.path === '/v1/info') {
        return { status: 200, body: { docHash: infoDocHash } }
      }
      if (request.path === '/v1/document' && request.method === 'GET') {
        return { status: 404, body: {} }
      }
      if (request.path === '/v1/document' && request.method === 'POST') {
        return { status: 202, body: { docHash: 'pushed-hash', updatedAt: '2026-10-27T10:00:00.000Z' } }
      }
      return { status: 404, body: {} }
    },
    onPeersChanged: (listener) => {
      peerListeners.add(listener)
      return () => peerListeners.delete(listener)
    },
    onPaired: () => () => undefined,
    onIncomingDocument: (listener) => {
      incomingListeners.add(listener)
      return () => incomingListeners.delete(listener)
    },
    onError: () => () => undefined,
  }

  const storage = new Map<string, string>()
  const engine = createLocalSyncEngine({
    transport,
    storage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => {
        storage.set(key, value)
      },
      removeItem: (key) => {
        storage.delete(key)
      },
    },
    getLocalDocument: () => local.current,
    applyRemoteDocument: (document) => {
      local.current = document
    },
    deviceName: 'Desk',
    initialDiscoverable: true,
    now: () => new Date('2026-10-27T10:00:00.000Z'),
    onRemoteApplied: () => undefined,
    onBackup: () => undefined,
  })

  return {
    engine,
    local,
    requests,
    acks,
    peer: () => peer,
    setPeer: (next: PeerRecord) => {
      peer = next
    },
    setNearby: (peers: NearbyPeer[]) => {
      nearby = peers
      peerListeners.forEach((listener) => listener(peers))
    },
    setInfoDocHash: (hash: string | null) => {
      infoDocHash = hash
    },
    emitIncoming: (item: IncomingDocument) => {
      incomingListeners.forEach((listener) => listener(item))
    },
    startCount: () => startCount,
    stopCount: () => stopCount,
    setDocumentCount: () => setDocumentCount,
  }
}

describe('local sync coordinator', () => {
  it('does not sync an auto-sync-off peer and ignores local edits for it', async () => {
    const harness = createHarness(makeDocument('Wren'))
    await harness.engine.start()
    expect(harness.requests).toHaveLength(0)

    harness.engine.handleDocumentChange()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(harness.requests).toHaveLength(0)

    await harness.engine.setAutoSync(PEER_ID, true)
    await harness.engine.syncNow(PEER_ID)
    expect(harness.requests.some((entry) => entry.request.method === 'POST')).toBe(true)

    const before = harness.requests.length
    await harness.engine.setAutoSync(PEER_ID, false)
    harness.engine.handleDocumentChange()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(harness.requests).toHaveLength(before)
  })

  it('applies an incoming document through the peer engine and acknowledges it', async () => {
    const harness = createHarness(makeDocument('Wren'))
    await harness.engine.start()
    await harness.engine.setAutoSync(PEER_ID, true)
    await harness.engine.syncNow(PEER_ID)
    expect(harness.requests.some((entry) => entry.request.method === 'POST')).toBe(true)

    const incoming = makeDocument('Wren', 'dark')
    harness.emitIncoming({
      id: 'incoming-1',
      fromPeerId: PEER_ID,
      documentJson: JSON.stringify(incoming),
      docHash: checksumDocument(incoming),
      updatedAt: '2026-10-27T10:05:00.000Z',
    })
    await vi.waitFor(() => expect(harness.acks).toHaveLength(1))
    expect(harness.acks[0]?.ok).toBe(true)
    expect(harness.local.current.settings.theme).toBe('dark')
  })

  it('does not advertise the unresolved local copy after an incoming conflict', async () => {
    const harness = createHarness(makeDocument('Wren'))
    await harness.engine.start()
    await harness.engine.setAutoSync(PEER_ID, true)
    await harness.engine.syncNow(PEER_ID)
    const before = harness.setDocumentCount()

    harness.local.current.profile = { ...harness.local.current.profile!, name: 'Mine' }
    harness.engine.handleDocumentChange()
    const incoming = makeDocument('Theirs')
    harness.emitIncoming({
      id: 'incoming-conflict',
      fromPeerId: PEER_ID,
      documentJson: JSON.stringify(incoming),
      docHash: checksumDocument(incoming),
      updatedAt: '2026-10-27T10:05:00.000Z',
    })
    await vi.waitFor(() => expect(harness.acks).toHaveLength(1))
    expect(harness.acks[0]?.ok).toBe(true)
    expect(harness.engine.getState().conflicts).toHaveLength(1)
    expect(harness.local.current.profile?.name).toBe('Mine')
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(harness.setDocumentCount()).toBe(before)
  })

  it('advertises the resolved copy after the other device decides', async () => {
    const harness = createHarness(makeDocument('Wren'))
    await harness.engine.start()
    await harness.engine.setAutoSync(PEER_ID, true)
    await harness.engine.syncNow(PEER_ID)

    harness.local.current.profile = { ...harness.local.current.profile!, name: 'Mine' }
    harness.engine.handleDocumentChange()
    const incoming = makeDocument('Theirs')
    harness.emitIncoming({
      id: 'incoming-conflict',
      fromPeerId: PEER_ID,
      documentJson: JSON.stringify(incoming),
      docHash: checksumDocument(incoming),
      updatedAt: '2026-10-27T10:05:00.000Z',
    })
    await vi.waitFor(() => expect(harness.acks).toHaveLength(1))
    expect(harness.engine.getState().conflicts).toHaveLength(1)
    const before = harness.setDocumentCount()

    harness.emitIncoming({
      id: 'incoming-decision',
      fromPeerId: PEER_ID,
      documentJson: JSON.stringify(incoming),
      docHash: checksumDocument(incoming),
      updatedAt: '2026-10-27T10:06:00.000Z',
    })
    await vi.waitFor(() => expect(harness.acks).toHaveLength(2))
    await vi.waitFor(() => expect(harness.setDocumentCount()).toBeGreaterThan(before))

    expect(harness.engine.getState().conflicts).toHaveLength(0)
    expect(harness.local.current.profile?.name).toBe('Theirs')
  })

  it('clears the conflict on refresh when the peer already serves this copy', async () => {
    const harness = createHarness(makeDocument('Wren'))
    await harness.engine.start()
    await harness.engine.setAutoSync(PEER_ID, true)
    await harness.engine.syncNow(PEER_ID)

    harness.local.current.profile = { ...harness.local.current.profile!, name: 'Mine' }
    harness.engine.handleDocumentChange()
    const incoming = makeDocument('Theirs')
    harness.emitIncoming({
      id: 'incoming-conflict',
      fromPeerId: PEER_ID,
      documentJson: JSON.stringify(incoming),
      docHash: checksumDocument(incoming),
      updatedAt: '2026-10-27T10:05:00.000Z',
    })
    await vi.waitFor(() => expect(harness.acks).toHaveLength(1))
    expect(harness.engine.getState().conflicts).toHaveLength(1)
    const before = harness.setDocumentCount()

    harness.setInfoDocHash(checksumDocument(harness.local.current))
    await harness.engine.refresh()

    await vi.waitFor(() => expect(harness.engine.getState().conflicts).toHaveLength(0))
    expect(harness.local.current.profile?.name).toBe('Mine')
    expect(harness.setDocumentCount()).toBeGreaterThan(before)
  })

  it('keeps a peer failure in its device row instead of duplicating it globally', async () => {
    const harness = createHarness(makeDocument('Wren'), { requestStatus: 401 })
    await harness.engine.start()
    await harness.engine.setAutoSync(PEER_ID, true)
    await harness.engine.syncNow(PEER_ID)

    await vi.waitFor(() => {
      expect(harness.engine.getState().peers[PEER_ID]?.status).toBe('error')
    })
    const state = harness.engine.getState()
    expect(state.peers[PEER_ID]?.lastError).toMatch(/pair both devices again/i)
    expect(state.peers[PEER_ID]?.lastError).not.toMatch(/401|pairing token/i)
    expect(state.lastError).toBeNull()
    expect(state.phase).toBe('error')
  })

  it('keeps offline guidance in the device row', async () => {
    const unreachable = Object.assign(
      new Error('connect EHOSTUNREACH 192.168.1.18:39741'),
      { code: 'EHOSTUNREACH' },
    )
    const harness = createHarness(makeDocument('Wren'), { requestError: unreachable })
    await harness.engine.start()
    await harness.engine.setAutoSync(PEER_ID, true)
    await harness.engine.syncNow(PEER_ID)

    await vi.waitFor(() => {
      expect(harness.engine.getState().peers[PEER_ID]?.status).toBe('offline')
    })
    const state = harness.engine.getState()
    expect(state.peers[PEER_ID]?.lastError).toMatch(/Couldn't reach the other device/i)
    expect(state.lastError).toBeNull()
  })

  it('keeps a pairing failure inside the pairing dialog', async () => {
    const harness = createHarness(makeDocument('Wren'), {
      pairError: new Error(
        'java.lang.IllegalStateException: The pairing code is invalid or expired.',
      ),
    })
    await harness.engine.start()

    const peer = await harness.engine.pairWithCode(PEER_ID, 'ABCD2345')

    expect(peer).toBeNull()
    const state = harness.engine.getState()
    expect(state.pairingError).toMatch(/that pairing code is invalid/i)
    expect(state.pairingError).not.toMatch(/java|Exception/i)
    expect(state.lastError).toBeNull()
  })

  it('shows the advertised platform for peers paired before the field existed', async () => {
    const harness = createHarness(makeDocument('Wren'))
    harness.setNearby([makeNearby('android')])
    await harness.engine.start()
    expect(harness.engine.getState().peers[PEER_ID]?.platform).toBe('android')
  })

  it('fills the platform when a legacy peer appears nearby later', async () => {
    const harness = createHarness(makeDocument('Wren'))
    await harness.engine.start()
    expect(harness.engine.getState().peers[PEER_ID]?.platform).toBeUndefined()

    harness.setNearby([makeNearby('android')])
    expect(harness.engine.getState().peers[PEER_ID]?.platform).toBe('android')
  })

  it('fills the platform after a pause and resume', async () => {
    const harness = createHarness(makeDocument('Wren'))
    await harness.engine.start()
    expect(harness.engine.getState().peers[PEER_ID]?.platform).toBeUndefined()

    await harness.engine.pause()
    harness.setNearby([makeNearby('android')])
    await harness.engine.resume()
    expect(harness.engine.getState().peers[PEER_ID]?.platform).toBe('android')
  })

  it('keeps the stored platform when discovery reports another one', async () => {
    const harness = createHarness(makeDocument('Wren'))
    harness.setPeer({ ...harness.peer(), platform: 'desktop' })
    harness.setNearby([makeNearby('android')])
    await harness.engine.start()
    expect(harness.engine.getState().peers[PEER_ID]?.platform).toBe('desktop')
  })

  it('pauses and resumes the transport', async () => {
    const harness = createHarness(makeDocument('Wren'))
    await harness.engine.start()
    await harness.engine.pause()
    expect(harness.stopCount()).toBe(1)
    expect(harness.engine.getState().available).toBe(false)
    await harness.engine.resume()
    expect(harness.startCount()).toBe(2)
    expect(harness.engine.getState().available).toBe(true)
  })
})
