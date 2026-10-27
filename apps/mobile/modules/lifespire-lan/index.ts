import { EventEmitter, requireNativeModule } from 'expo-modules-core'
import type {
  DeviceIdentity,
  IncomingDocument,
  NearbyPeer,
  PairingPayload,
  PeerRecord,
} from '@lifespire/app-core/sync/protocol'

export interface LifespireLanNative {
  start(options: { name: string; discoverable: boolean }): Promise<DeviceIdentity>
  stop(): Promise<void>
  setDiscoverable(value: boolean): Promise<boolean>
  setDocument(documentJson: string, docHash: string): Promise<void>
  pendingIncoming(): Promise<IncomingDocument[]>
  ackIncoming(id: string, result: unknown): Promise<void>
  listPeers(): Promise<PeerRecord[]>
  listNearby(): Promise<NearbyPeer[]>
  startPairing(): Promise<PairingPayload>
  cancelPairing(): Promise<void>
  pair(payload: PairingPayload): Promise<PeerRecord>
  pairWithCode(deviceId: string, code: string): Promise<PeerRecord>
  forget(peerId: string): Promise<void>
  setAutoSync(peerId: string, autoSync: boolean): Promise<PeerRecord>
  request(
    peerId: string,
    request: { method: 'GET' | 'POST'; path: string; body?: string },
  ): Promise<{ status: number; body: unknown }>
  persistence(): Promise<'encrypted' | 'plaintext'>
}

export interface LanEmitter {
  addListener(
    event: string,
    listener: (payload: Record<string, unknown>) => void,
  ): { remove(): void }
}

let native: LifespireLanNative | null = null
try {
  native = requireNativeModule('LifespireLan') as unknown as LifespireLanNative
} catch {
  // Expo Go and unit tests do not include the local module.
  native = null
}

export const lanEvents: LanEmitter | null = native
  ? (new EventEmitter(native as never) as unknown as LanEmitter)
  : null

export default native
