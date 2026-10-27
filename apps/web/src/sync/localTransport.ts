import type {
  DeviceIdentity,
  IncomingDocument,
  LocalTransport,
  NearbyPeer,
  PairingPayload,
  PeerRecord,
  PeerRequest,
  PeerResponse,
} from '@lifespire/app-core/sync/protocol'
import { isDesktopShell } from '../ui/lib/platform'
import type { DesktopLocalNodeBridge } from '../ui/lib/platform'

function bridge(): DesktopLocalNodeBridge | null {
  if (!isDesktopShell()) return null
  if (typeof window === 'undefined') return null
  return window.lifespireDesktop?.localSync ?? null
}

function unavailable(): LocalTransport {
  const fail = async (): Promise<never> => {
    throw new Error('Nearby sync is available in the desktop and Android apps.')
  }
  return {
    available: false,
    start: fail,
    stop: async () => undefined,
    setDiscoverable: async () => undefined,
    setDocument: async () => undefined,
    pendingIncoming: async () => [],
    ackIncoming: async () => undefined,
    listPeers: async () => [],
    listNearby: async () => [],
    startPairing: fail,
    cancelPairing: async () => undefined,
    pair: fail,
    pairWithCode: fail,
    forget: async () => undefined,
    setAutoSync: async () => undefined,
    request: fail,
    onPeersChanged: () => () => undefined,
    onPaired: () => () => undefined,
    onIncomingDocument: () => () => undefined,
    onError: () => () => undefined,
  }
}

function fromBridge(node: DesktopLocalNodeBridge): LocalTransport {
  return {
    available: true,
    start: (options): Promise<DeviceIdentity> => node.start(options),
    stop: () => node.stop(),
    setDiscoverable: (discoverable) => node.setDiscoverable(discoverable),
    setDocument: (documentJson, docHash) => node.setDocument(documentJson, docHash),
    pendingIncoming: (): Promise<IncomingDocument[]> => node.pendingIncoming(),
    ackIncoming: (id, result) => node.ackIncoming(id, result),
    listPeers: (): Promise<PeerRecord[]> => node.listPeers(),
    listNearby: (): Promise<NearbyPeer[]> => node.listNearby(),
    startPairing: (): Promise<PairingPayload> => node.startPairing(),
    cancelPairing: () => node.cancelPairing(),
    pair: (payload) => node.pair(payload),
    pairWithCode: (deviceId, code) => node.pairWithCode(deviceId, code),
    forget: (peerId) => node.forget(peerId),
    setAutoSync: async (peerId, autoSync) => {
      await node.setAutoSync(peerId, autoSync)
    },
    request: (peerId: string, request: PeerRequest): Promise<PeerResponse> =>
      node.request(peerId, request),
    onPeersChanged: (listener) => node.onPeersChanged(listener),
    onPaired: (listener) => node.onPaired(listener),
    onIncomingDocument: (listener) => node.onIncomingDocument(listener),
    onError: (listener) => node.onError(listener),
  }
}

/**
 * Browser builds have no LAN transport. The desktop shell exposes the node
 * through the preload bridge; the same web build runs in both places.
 */
export function createLocalTransport(): LocalTransport {
  const node = bridge()
  return node ? fromBridge(node) : unavailable()
}

export const localTransport = createLocalTransport()
