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

function createHarness(initial: GameDocument) {
  const local = { current: initial }
  const requests: Array<{ peerId: string; request: PeerRequest }> = []
  const acks: Array<{ id: string; ok: boolean }> = []
  const peerListeners = new Set<(peers: NearbyPeer[]) => void>()
  const incomingListeners = new Set<(item: IncomingDocument) => void>()
  let startCount = 0
  let stopCount = 0
  let setDocumentCount = 0
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
    pair: async () => peer,
    pairWithCode: async () => peer,
    forget: async () => undefined,
    setAutoSync: async (_peerId, autoSync) => {
      peer = { ...peer, autoSync }
    },
    request: async (peerId, request) => {
      requests.push({ peerId, request })
      if (request.path === '/v1/info') {
        return { status: 200, body: { docHash: null } }
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
    setNearby: (peers: NearbyPeer[]) => {
      nearby = peers
      peerListeners.forEach((listener) => listener(peers))
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
