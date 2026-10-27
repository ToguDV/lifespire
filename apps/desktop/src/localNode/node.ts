import fs from 'node:fs'
import path from 'node:path'
import type { InboxItem } from './inbox'
import { createInbox } from './inbox'
import { createIdentityStore } from './identity'
import { createPinnedClient } from './client'
import type { PinnedClient } from './client'
import { createLocalServer } from './server'
import type { LocalServer } from './server'
import { createDiscovery } from './discovery'
import type { Discovery } from './discovery'
import type { PeerStore } from './peerStore'
import { createPeerStore, newStoredPeer } from './peerStore'
import type {
  DeviceIdentity,
  FullIdentity,
  IncomingDocument,
  NearbyPeer,
  PairingPayload,
  PeerRecord,
  PeerRequest,
  PeerResponse,
  StoredPeer,
} from './protocol'
import {
  isPairingPayload,
  isValidDeviceId,
  newToken,
  normalizePairingCode,
  sanitizeName,
} from './protocol'
import { createVaultFile } from './vault'
import type { SecretBox } from './vault'

export interface LocalNodeOptions {
  dataDir: string
  secrets: SecretBox
  now?: () => Date
  /** Tests use a random port; production uses the fixed protocol port. */
  discoveryPort?: number
  /** Tests advertise 127.0.0.1; production picks the first LAN address. */
  advertisedHost?: string
}

export interface LocalNode {
  start(options: { name: string; discoverable: boolean }): Promise<DeviceIdentity>
  stop(): Promise<void>
  setDiscoverable(discoverable: boolean): Promise<void>
  identity(): DeviceIdentity | null
  setDocument(documentJson: string, docHash: string): Promise<void>
  pendingIncoming(): Promise<IncomingDocument[]>
  ackIncoming(
    id: string,
    result: { ok: true; docHash: string; updatedAt: string } | { ok: false; error: string },
  ): Promise<void>
  listPeers(): PeerRecord[]
  listNearby(): NearbyPeer[]
  startPairing(): PairingPayload
  cancelPairing(): void
  pair(payload: PairingPayload): Promise<PeerRecord>
  pairWithCode(deviceId: string, code: string): Promise<PeerRecord>
  forget(peerId: string): Promise<void>
  setAutoSync(peerId: string, autoSync: boolean): PeerRecord
  request(peerId: string, request: PeerRequest): Promise<PeerResponse>
  persistence(): 'encrypted' | 'plaintext'
  onPeersChanged(listener: (peers: NearbyPeer[]) => void): () => void
  onPaired(listener: (peer: PeerRecord) => void): () => void
  onIncomingDocument(listener: (item: IncomingDocument) => void): () => void
  onError(listener: (message: string) => void): () => void
}

function toIncoming(item: InboxItem): IncomingDocument {
  return {
    id: item.id,
    fromPeerId: item.fromPeerId,
    documentJson: item.documentJson,
    docHash: item.docHash,
    updatedAt: item.updatedAt,
  }
}

function findNearby(peers: NearbyPeer[], deviceId: string): NearbyPeer | null {
  return peers.find((peer) => peer.deviceId === deviceId) ?? null
}

function publicIdentity(identity: FullIdentity): DeviceIdentity {
  return {
    deviceId: identity.deviceId,
    name: identity.name,
    fingerprint: identity.fingerprint,
  }
}

/**
 * Composition root for the desktop LAN node. Kept Electron-free so the whole
 * protocol can be exercised in Vitest with a temporary directory and a fake
 * keychain; `main.ts` wires `safeStorage` and the renderer IPC.
 */
export function createLocalNode(options: LocalNodeOptions): LocalNode {
  const now = options.now ?? (() => new Date())
  const dataDir = options.dataDir
  const identityStore = createIdentityStore({
    file: createVaultFile(path.join(dataDir, 'identity.json'), fs),
    secrets: options.secrets,
    now,
  })
  const peerStore: PeerStore = createPeerStore({
    file: createVaultFile(path.join(dataDir, 'peers.json'), fs),
    secrets: options.secrets,
  })
  const inbox = createInbox({ dir: path.join(dataDir, 'inbox'), fs, now })
  const client: PinnedClient = createPinnedClient()

  const peerListeners = new Set<(peers: NearbyPeer[]) => void>()
  const pairedListeners = new Set<(peer: PeerRecord) => void>()
  const incomingListeners = new Set<(item: IncomingDocument) => void>()
  const errorListeners = new Set<(message: string) => void>()

  let identity: FullIdentity | null = null
  let server: LocalServer | null = null
  let discovery: Discovery | null = null
  let discoverable = false
  let started = false
  const unsubscribe: Array<() => void> = []

  const emitError = (message: string): void => {
    errorListeners.forEach((listener) => listener(message))
  }

  const syncNearbyToPeers = (nearby: NearbyPeer[]): void => {
    for (const peer of nearby) {
      const stored = peerStore.find(peer.deviceId)
      if (!stored) continue
      if (stored.lastHost === peer.host && stored.lastPort === peer.port) continue
      peerStore.touch(peer.deviceId, { lastHost: peer.host, lastPort: peer.port })
    }
    peerListeners.forEach((listener) => listener(nearby))
  }

  const attachServer = (localServer: LocalServer): void => {
    unsubscribe.push(
      localServer.onIncoming((item) => {
        incomingListeners.forEach((listener) => listener(item))
      }),
    )
    unsubscribe.push(
      localServer.onPaired((peer) => {
        pairedListeners.forEach((listener) => listener(peer))
      }),
    )
    unsubscribe.push(localServer.onError(emitError))
  }

  const pairRequest = async (params: {
    host: string
    port: number
    expectedFingerprint: string
    body: Record<string, unknown>
    expectedDeviceId: string
  }): Promise<PeerRecord> => {
    if (!identity) throw new Error('Local sync is not running.')
    const clientToken = newToken()
    const serverPort = server?.port() ?? 0
    const response = await client.request({
      host: params.host,
      port: params.port,
      method: 'POST',
      path: '/v1/pair',
      expectedFingerprint: params.expectedFingerprint,
      body: {
        ...params.body,
        deviceId: identity.deviceId,
        name: identity.name,
        fingerprint: identity.fingerprint,
        certPem: identity.certPem,
        token: clientToken,
        port: serverPort,
      },
    })
    if (response.status !== 200) {
      const body = response.body as { message?: unknown } | null
      throw new Error(
        typeof body?.message === 'string' ? body.message : 'The other device refused pairing.',
      )
    }
    const body = response.body as {
      deviceId?: unknown
      name?: unknown
      fingerprint?: unknown
      certPem?: unknown
      token?: unknown
    }
    if (
      body.deviceId !== params.expectedDeviceId ||
      body.fingerprint !== params.expectedFingerprint ||
      typeof body.name !== 'string' ||
      typeof body.certPem !== 'string' ||
      typeof body.token !== 'string' ||
      body.token.length < 16
    ) {
      throw new Error('The other device sent an invalid pairing response.')
    }
    const existing = peerStore.find(params.expectedDeviceId)
    const record = newStoredPeer({
      peerId: params.expectedDeviceId,
      name: sanitizeName(body.name, 'Nearby device'),
      fingerprint: params.expectedFingerprint,
      certPem: body.certPem,
      token: body.token,
      lastHost: params.host,
      lastPort: params.port,
      now,
    })
    peerStore.upsert(
      existing
        ? {
            ...record,
            pairedAt: existing.pairedAt,
            autoSync: existing.autoSync,
            lastSyncAt: existing.lastSyncAt,
          }
        : record,
    )
    const paired = peerStore.list().find((peer) => peer.peerId === params.expectedDeviceId)
    if (!paired) throw new Error('Could not store the paired device.')
    pairedListeners.forEach((listener) => listener(paired))
    return paired
  }

  return {
    async start(startOptions) {
      if (started && identity) return publicIdentity(identity)
      const name = sanitizeName(startOptions.name)
      let loaded = identityStore.loadOrCreate(name)
      if (loaded.name !== name) loaded = identityStore.rename(name)
      identity = loaded
      peerStore.list()
      if (peerStore.locked()) {
        throw new Error(
          'The paired-device registry could not be decrypted. Restore the OS keychain or pair the devices again.',
        )
      }
      discoverable = startOptions.discoverable
      const localServer = createLocalServer({
        identity: loaded,
        peers: peerStore,
        inbox,
        now,
        ...(options.advertisedHost ? { advertisedHost: options.advertisedHost } : {}),
      })
      attachServer(localServer)
      const pending = inbox.list()[0]
      if (pending) {
        localServer.setPendingMirror({
          documentJson: pending.documentJson,
          docHash: pending.docHash,
          updatedAt: pending.updatedAt,
        })
      }
      const { port } = await localServer.start()
      server = localServer
      const localDiscovery = createDiscovery({
        identity: {
          deviceId: loaded.deviceId,
          name: loaded.name,
          fingerprint: loaded.fingerprint,
        },
        discoverable,
        onError: emitError,
        now,
        ...(options.discoveryPort ? { port: options.discoveryPort } : {}),
      })
      localDiscovery.setIdentity(
        {
          deviceId: loaded.deviceId,
          name: loaded.name,
          fingerprint: loaded.fingerprint,
        },
        port,
      )
      localDiscovery.onPeers(syncNearbyToPeers)
      localDiscovery.start()
      if (!discoverable) localDiscovery.setDiscoverable(false)
      discovery = localDiscovery
      started = true
      return publicIdentity(loaded)
    },

    async stop() {
      started = false
      unsubscribe.forEach((listener) => listener())
      unsubscribe.length = 0
      discovery?.stop()
      discovery = null
      await server?.stop()
      server = null
      // Keep the top-level event listeners: the IPC bridge registers once and
      // must keep receiving events after a StrictMode restart.
    },

    async setDiscoverable(next) {
      discoverable = next
      discovery?.setDiscoverable(next)
      if (next && identity && discovery) {
        discovery.setIdentity(
          {
            deviceId: identity.deviceId,
            name: identity.name,
            fingerprint: identity.fingerprint,
          },
          server?.port() ?? 0,
        )
      }
    },

    identity: () => (identity ? publicIdentity(identity) : null),

    async setDocument(documentJson, docHash) {
      server?.setMirror({ documentJson, docHash, updatedAt: now().toISOString() })
    },

    pendingIncoming: async () => inbox.list().map(toIncoming),

    async ackIncoming(id, result) {
      const item = inbox.list().find((candidate) => candidate.id === id)
      inbox.ack(id, result.ok)
      if (result.ok && item) {
        server?.ackApplied(item.documentJson, result.docHash, result.updatedAt)
      }
      const next = inbox.list()[0]
      server?.setPendingMirror(
        next
          ? {
              documentJson: next.documentJson,
              docHash: next.docHash,
              updatedAt: next.updatedAt,
            }
          : null,
      )
    },

    listPeers: () => peerStore.list(),
    listNearby: () => discovery?.getNearby() ?? [],

    startPairing() {
      if (!server) throw new Error('Local sync is not running.')
      return server.startPairing()
    },

    cancelPairing: () => server?.cancelPairing(),

    async pair(payload) {
      if (!isPairingPayload(payload)) throw new Error('Invalid pairing code.')
      if (!identity) throw new Error('Local sync is not running.')
      if (payload.deviceId === identity.deviceId) throw new Error('That is this device.')
      const nearby = discovery ? findNearby(discovery.getNearby(), payload.deviceId) : null
      const host = nearby?.host ?? payload.host
      const port = nearby?.port ?? payload.port
      if (!host || !port) throw new Error('The other device is not reachable. Try discovery again.')
      return pairRequest({
        host,
        port,
        expectedFingerprint: payload.fingerprint,
        expectedDeviceId: payload.deviceId,
        body: { secret: payload.secret },
      })
    },

    async pairWithCode(deviceId, code) {
      if (!isValidDeviceId(deviceId)) throw new Error('Invalid device.')
      if (!identity) throw new Error('Local sync is not running.')
      if (!discovery) throw new Error('Discovery is not running.')
      const nearby = findNearby(discovery.getNearby(), deviceId)
      if (!nearby) throw new Error('The other device is not nearby.')
      const normalized = normalizePairingCode(code)
      if (!/^[A-Z0-9]{8}$/.test(normalized)) throw new Error('Enter the 8-character code.')
      return pairRequest({
        host: nearby.host,
        port: nearby.port,
        expectedFingerprint: nearby.fingerprint,
        expectedDeviceId: deviceId,
        body: { code: normalized },
      })
    },

    async forget(peerId) {
      const peer = peerStore.find(peerId)
      if (peer) {
        const nearby = discovery ? findNearby(discovery.getNearby(), peerId) : null
        const host = nearby?.host ?? peer.lastHost
        const port = nearby?.port ?? peer.lastPort
        if (host && port && peer.token) {
          try {
            await client.request({
              host,
              port,
              method: 'POST',
              path: '/v1/unpair',
              token: peer.token,
              expectedFingerprint: peer.fingerprint,
              body: {},
            })
          } catch {
            // The peer may be offline; forgetting locally is what matters.
          }
        }
      }
      peerStore.remove(peerId)
    },

    setAutoSync: (peerId, autoSync) => {
      const peer = peerStore.setAutoSync(peerId, autoSync)
      if (!peer) throw new Error('Unknown device.')
      return peer
    },

    async request(peerId, request) {
      const peer: StoredPeer | null = peerStore.find(peerId)
      if (!peer) throw new Error('Unknown device.')
      const nearby = discovery ? findNearby(discovery.getNearby(), peerId) : null
      const host = nearby?.host ?? peer.lastHost
      const port = nearby?.port ?? peer.lastPort
      if (!host || !port) throw new Error('The other device is not nearby.')
      const response = await client.request({
        host,
        port,
        method: request.method,
        path: request.path,
        token: peer.token,
        expectedFingerprint: peer.fingerprint,
        body: request.body,
      })
      peerStore.touch(peerId, {
        lastHost: host,
        lastPort: port,
        ...(request.path === '/v1/document' && request.method === 'POST'
          ? { lastSyncAt: now().toISOString() }
          : {}),
      })
      return { status: response.status, body: response.body }
    },

    persistence: () => peerStore.persistence(),

    onPeersChanged(listener) {
      peerListeners.add(listener)
      return () => peerListeners.delete(listener)
    },
    onPaired(listener) {
      pairedListeners.add(listener)
      return () => pairedListeners.delete(listener)
    },
    onIncomingDocument(listener) {
      incomingListeners.add(listener)
      return () => incomingListeners.delete(listener)
    },
    onError(listener) {
      errorListeners.add(listener)
      return () => errorListeners.delete(listener)
    },
  }
}
