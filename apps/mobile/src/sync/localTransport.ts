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
import native, { lanEvents } from '../../modules/lifespire-lan'

type EventSubscription = { remove(): void }

function parseBody(raw: unknown): unknown {
  if (typeof raw !== 'string' || raw.trim() === '') return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function subscribe<T>(
  event: string,
  unwrap: (payload: Record<string, unknown>) => T | null,
  listener: (value: T) => void,
): () => void {
  if (!lanEvents) return () => undefined
  const subscription = lanEvents.addListener(event, (payload: Record<string, unknown>) => {
    const value = unwrap(payload)
    if (value !== null) listener(value)
  }) as EventSubscription
  return () => subscription.remove()
}

/**
 * Android transport backed by the local Expo module. Every token, certificate
 * and socket lives in Kotlin; this file only maps the typed protocol.
 */
export function createAndroidTransport(): LocalTransport {
  const lan = native
  if (!lan) {
    const fail = async (): Promise<never> => {
      throw new Error('Nearby sync needs the LifeSpire Android build, not Expo Go.')
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

  return {
    available: true,
    start: (options): Promise<DeviceIdentity> => lan.start(options),
    stop: () => lan.stop(),
    setDiscoverable: async (discoverable) => {
      await lan.setDiscoverable(discoverable)
    },
    setDocument: (documentJson, docHash) => lan.setDocument(documentJson, docHash),
    pendingIncoming: (): Promise<IncomingDocument[]> => lan.pendingIncoming(),
    ackIncoming: async (id, result) => {
      await lan.ackIncoming(id, result)
    },
    listPeers: (): Promise<PeerRecord[]> => lan.listPeers(),
    listNearby: (): Promise<NearbyPeer[]> => lan.listNearby(),
    startPairing: (): Promise<PairingPayload> => lan.startPairing(),
    cancelPairing: async () => {
      await lan.cancelPairing()
    },
    pair: (payload) => lan.pair(payload),
    pairWithCode: (deviceId, code) => lan.pairWithCode(deviceId, code),
    forget: async (peerId) => {
      await lan.forget(peerId)
    },
    setAutoSync: async (peerId, autoSync) => {
      await lan.setAutoSync(peerId, autoSync)
    },
    request: async (peerId: string, request: PeerRequest): Promise<PeerResponse> => {
      const response = (await lan.request(peerId, request)) as {
        status: number
        body: unknown
      }
      return { status: response.status, body: parseBody(response.body) }
    },
    onPeersChanged: (listener) =>
      subscribe('onPeersChanged', (payload) => (payload.peers as NearbyPeer[]) ?? null, listener),
    onPaired: (listener) =>
      subscribe('onPaired', (payload) => (payload.peer as PeerRecord) ?? null, listener),
    onIncomingDocument: (listener) =>
      subscribe(
        'onIncomingDocument',
        (payload) => (payload.item as IncomingDocument) ?? null,
        listener,
      ),
    onError: (listener) =>
      subscribe(
        'onError',
        (payload) => (typeof payload.message === 'string' ? payload.message : null),
        listener,
      ),
  }
}

export const androidTransport = createAndroidTransport()
