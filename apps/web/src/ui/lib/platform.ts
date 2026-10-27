export interface DesktopLocalIdentity {
  deviceId: string
  name: string
  fingerprint: string
}

export interface DesktopLocalPeer {
  peerId: string
  name: string
  fingerprint: string
  autoSync: boolean
  pairedAt: string
  lastSyncAt: string | null
}

export interface DesktopLocalNearby {
  deviceId: string
  name: string
  host: string
  port: number
  fingerprint: string
  lastSeenAt: string
}

export interface DesktopLocalPairing {
  v: 1
  kind: 'lifespire-pair'
  deviceId: string
  name: string
  fingerprint: string
  host: string | null
  port: number
  secret: string
  expiresAt: string
}

export interface DesktopLocalIncoming {
  id: string
  fromPeerId: string
  documentJson: string
  docHash: string
  updatedAt: string
}

export interface DesktopLocalNodeBridge {
  start(options: { name: string; discoverable: boolean }): Promise<DesktopLocalIdentity>
  stop(): Promise<void>
  setDiscoverable(discoverable: boolean): Promise<void>
  setDocument(documentJson: string, docHash: string): Promise<void>
  pendingIncoming(): Promise<DesktopLocalIncoming[]>
  ackIncoming(
    id: string,
    result: { ok: true; docHash: string; updatedAt: string } | { ok: false; error: string },
  ): Promise<void>
  listPeers(): Promise<DesktopLocalPeer[]>
  listNearby(): Promise<DesktopLocalNearby[]>
  startPairing(): Promise<DesktopLocalPairing>
  cancelPairing(): Promise<void>
  pair(payload: DesktopLocalPairing): Promise<DesktopLocalPeer>
  pairWithCode(deviceId: string, code: string): Promise<DesktopLocalPeer>
  forget(peerId: string): Promise<void>
  setAutoSync(peerId: string, autoSync: boolean): Promise<DesktopLocalPeer>
  request(
    peerId: string,
    request: { method: 'GET' | 'POST'; path: string; body?: unknown },
  ): Promise<{ status: number; body: unknown }>
  persistence(): Promise<'encrypted' | 'plaintext'>
  onPeersChanged(listener: (peers: DesktopLocalNearby[]) => void): () => void
  onPaired(listener: (peer: DesktopLocalPeer) => void): () => void
  onIncomingDocument(listener: (item: DesktopLocalIncoming) => void): () => void
  onError(listener: (message: string) => void): () => void
}

export interface DesktopBridge {
  isDesktop?: boolean
  platform?: string
  localSync?: DesktopLocalNodeBridge
}

declare global {
  interface Window {
    lifespireDesktop?: DesktopBridge
  }
}

type DesktopScope = { lifespireDesktop?: DesktopBridge } | null | undefined

/**
 * True only inside the packaged Electron shell. The browser, the tests and
 * server-side code all see `false`; callers pass an explicit scope when there
 * is no real window.
 */
export function isDesktopShell(
  scope: DesktopScope = typeof window === 'undefined' ? undefined : window,
): boolean {
  return scope?.lifespireDesktop?.isDesktop === true
}
