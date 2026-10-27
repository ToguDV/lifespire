import type { LocalNode } from './node'
import type {
  IncomingDocument,
  NearbyPeer,
  PeerRecord,
  PeerRequest,
} from './protocol'
import { isPairingPayload } from './protocol'

export const LOCAL_SYNC_CHANNELS = {
  start: 'lifespire:local-sync-start',
  stop: 'lifespire:local-sync-stop',
  setDiscoverable: 'lifespire:local-sync-set-discoverable',
  setDocument: 'lifespire:local-sync-set-document',
  pendingIncoming: 'lifespire:local-sync-pending-incoming',
  ackIncoming: 'lifespire:local-sync-ack-incoming',
  listPeers: 'lifespire:local-sync-list-peers',
  listNearby: 'lifespire:local-sync-list-nearby',
  startPairing: 'lifespire:local-sync-start-pairing',
  cancelPairing: 'lifespire:local-sync-cancel-pairing',
  pair: 'lifespire:local-sync-pair',
  pairWithCode: 'lifespire:local-sync-pair-with-code',
  forget: 'lifespire:local-sync-forget',
  setAutoSync: 'lifespire:local-sync-set-auto-sync',
  request: 'lifespire:local-sync-request',
  persistence: 'lifespire:local-sync-persistence',
  peersEvent: 'lifespire:local-sync-peers',
  pairedEvent: 'lifespire:local-sync-paired',
  incomingEvent: 'lifespire:local-sync-incoming',
  errorEvent: 'lifespire:local-sync-error',
} as const

export interface LocalSyncIpcDeps {
  ipcMain: {
    handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void
  }
  node: LocalNode
  guard: (event: unknown) => void
  send: (channel: string, payload: unknown) => void
}

/**
 * Narrow IPC surface for the unmodified web build. Every handler validates the
 * sender and the payload shape; the renderer never receives keys, tokens or
 * certificate private material.
 */
export function registerLocalSyncIpc(deps: LocalSyncIpcDeps): () => void {
  const { ipcMain, node, guard, send } = deps
  const handle = (
    channel: string,
    listener: (event: unknown, ...args: unknown[]) => unknown,
  ): void => {
    ipcMain.handle(channel, (event, ...args) => {
      guard(event)
      return listener(event, ...args)
    })
  }

  handle(LOCAL_SYNC_CHANNELS.start, (_event, raw) => {
    const options = raw as { name?: unknown; discoverable?: unknown }
    return node.start({
      name: typeof options?.name === 'string' ? options.name : 'LifeSpire desktop',
      discoverable: options?.discoverable === true,
    })
  })
  handle(LOCAL_SYNC_CHANNELS.stop, () => node.stop())
  handle(LOCAL_SYNC_CHANNELS.setDiscoverable, (_event, value) =>
    node.setDiscoverable(value === true),
  )
  handle(LOCAL_SYNC_CHANNELS.setDocument, (_event, documentJson, docHash) => {
    if (typeof documentJson !== 'string' || typeof docHash !== 'string') {
      throw new Error('Invalid document mirror.')
    }
    return node.setDocument(documentJson, docHash)
  })
  handle(LOCAL_SYNC_CHANNELS.pendingIncoming, () => node.pendingIncoming())
  handle(LOCAL_SYNC_CHANNELS.ackIncoming, (_event, id, result) => {
    if (typeof id !== 'string' || !result || typeof result !== 'object') {
      throw new Error('Invalid inbox acknowledgement.')
    }
    const acknowledgement = result as Record<string, unknown>
    if (typeof acknowledgement.ok !== 'boolean') {
      throw new Error('Invalid inbox acknowledgement.')
    }
    if (acknowledgement.ok) {
      if (
        typeof acknowledgement.docHash !== 'string' ||
        typeof acknowledgement.updatedAt !== 'string'
      ) {
        throw new Error('Invalid inbox acknowledgement.')
      }
    } else if (typeof acknowledgement.error !== 'string') {
      throw new Error('Invalid inbox acknowledgement.')
    }
    return node.ackIncoming(id, acknowledgement as never)
  })
  handle(LOCAL_SYNC_CHANNELS.listPeers, () => node.listPeers())
  handle(LOCAL_SYNC_CHANNELS.listNearby, () => node.listNearby())
  handle(LOCAL_SYNC_CHANNELS.startPairing, () => node.startPairing())
  handle(LOCAL_SYNC_CHANNELS.cancelPairing, () => node.cancelPairing())
  handle(LOCAL_SYNC_CHANNELS.pair, (_event, payload) => {
    if (!isPairingPayload(payload)) throw new Error('Invalid pairing payload.')
    return node.pair(payload)
  })
  handle(LOCAL_SYNC_CHANNELS.pairWithCode, (_event, deviceId, code) => {
    if (typeof deviceId !== 'string' || typeof code !== 'string') {
      throw new Error('Invalid pairing code.')
    }
    return node.pairWithCode(deviceId, code)
  })
  handle(LOCAL_SYNC_CHANNELS.forget, (_event, peerId) => {
    if (typeof peerId !== 'string') throw new Error('Invalid device.')
    return node.forget(peerId)
  })
  handle(LOCAL_SYNC_CHANNELS.setAutoSync, (_event, peerId, autoSync) => {
    if (typeof peerId !== 'string' || typeof autoSync !== 'boolean') {
      throw new Error('Invalid auto-sync setting.')
    }
    return node.setAutoSync(peerId, autoSync)
  })
  handle(LOCAL_SYNC_CHANNELS.request, (_event, peerId, request) => {
    if (typeof peerId !== 'string' || !request || typeof request !== 'object') {
      throw new Error('Invalid sync request.')
    }
    const candidate = request as PeerRequest
    if (candidate.method !== 'GET' && candidate.method !== 'POST') {
      throw new Error('Invalid sync request.')
    }
    if (!['/v1/info', '/v1/document', '/v1/unpair'].includes(candidate.path)) {
      throw new Error('Invalid sync request.')
    }
    if (candidate.method === 'GET' && candidate.body !== undefined) {
      throw new Error('Invalid sync request.')
    }
    return node.request(peerId, candidate)
  })
  handle(LOCAL_SYNC_CHANNELS.persistence, () => node.persistence())

  const unsubscribers = [
    node.onPeersChanged((peers: NearbyPeer[]) => send(LOCAL_SYNC_CHANNELS.peersEvent, peers)),
    node.onPaired((peer: PeerRecord) => send(LOCAL_SYNC_CHANNELS.pairedEvent, peer)),
    node.onIncomingDocument((item: IncomingDocument) =>
      send(LOCAL_SYNC_CHANNELS.incomingEvent, item),
    ),
    node.onError((message: string) => send(LOCAL_SYNC_CHANNELS.errorEvent, message)),
  ]

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe())
  }
}
