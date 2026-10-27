/**
 * Wire types and helpers for local, same-LAN sync.
 *
 * The protocol is deliberately small: UDP discovery only advertises a device,
 * pairing exchanges a one-time secret out of band (QR/code), and the document
 * itself travels over HTTPS with a pinned self-signed certificate plus a
 * per-direction bearer token.
 */

export const PROTOCOL_VERSION = 1
/** Fixed discovery port shared by every LifeSpire client. */
export const DISCOVERY_PORT = 47823
export const PAIRING_SCHEME = 'lifespire'
export const DOCUMENT_LIMIT_BYTES = 512 * 1024
export const PAIRING_TTL_MS = 5 * 60 * 1000

export type DiscoveryKind = 'probe' | 'announce'

export interface DiscoveryPacket {
  v: typeof PROTOCOL_VERSION
  kind: DiscoveryKind
  deviceId: string
  name: string
  port: number
  fingerprint: string
  protocol: typeof PROTOCOL_VERSION
}

/** A device that answered discovery and is not necessarily paired yet. */
export interface NearbyPeer {
  deviceId: string
  name: string
  host: string
  port: number
  fingerprint: string
  lastSeenAt: string
}

/** A device whose certificate and token have been accepted. */
export interface PeerRecord {
  peerId: string
  name: string
  fingerprint: string
  autoSync: boolean
  pairedAt: string
  lastSyncAt: string | null
}

export interface DeviceIdentity {
  deviceId: string
  name: string
  fingerprint: string
}

/**
 * Payload encoded in the pairing QR. `secret` is single-use and authorizes the
 * first request; `host`/`port` are best-effort hints because the address is
 * also available from discovery.
 */
export interface PairingPayload {
  v: typeof PROTOCOL_VERSION
  kind: 'lifespire-pair'
  deviceId: string
  name: string
  fingerprint: string
  host: string | null
  port: number
  secret: string
  expiresAt: string
}

export interface PeerSnapshot {
  version: string
  schemaVersion: number
  document: unknown
  updatedAt: string
}

export interface PeerPushResult {
  version: string
  updatedAt: string
}

/** The slice of the old API client the per-peer engine actually needs. */
export interface LocalPeerApi {
  getSync(ifMatch?: string): Promise<PeerSnapshot | null>
  putSync(
    document: unknown,
    options: { ifMatch?: string; create?: boolean },
  ): Promise<PeerPushResult>
}

export interface IncomingDocument {
  id: string
  fromPeerId: string
  /** Raw JSON string: native nodes never re-serialize the document. */
  documentJson: string
  docHash: string
  updatedAt: string
}

export interface PeerRequest {
  method: 'GET' | 'POST'
  path: string
  body?: unknown
}

export interface PeerResponse {
  status: number
  body: unknown
}

export interface StartTransportOptions {
  name: string
  discoverable: boolean
}

/**
 * Platform transport implemented by the Electron main-process node and by the
 * Android native module. Tokens and private keys never cross this boundary.
 */
export interface LocalTransport {
  readonly available: boolean
  start(options: StartTransportOptions): Promise<DeviceIdentity>
  stop(): Promise<void>
  setDiscoverable(discoverable: boolean): Promise<void>

  /** Mirror of the current document used to answer peer pull requests. */
  setDocument(documentJson: string, docHash: string): Promise<void>
  ackIncoming(
    id: string,
    result: { ok: true; docHash: string; updatedAt: string } | { ok: false; error: string },
  ): Promise<void>

  listPeers(): Promise<PeerRecord[]>
  listNearby(): Promise<NearbyPeer[]>
  pendingIncoming(): Promise<IncomingDocument[]>
  startPairing(): Promise<PairingPayload>
  cancelPairing(): Promise<void>
  pair(payload: PairingPayload): Promise<PeerRecord>
  pairWithCode(deviceId: string, code: string): Promise<PeerRecord>
  forget(peerId: string): Promise<void>
  setAutoSync(peerId: string, autoSync: boolean): Promise<void>

  request(peerId: string, request: PeerRequest): Promise<PeerResponse>

  onPeersChanged(listener: (peers: NearbyPeer[]) => void): () => void
  onPaired(listener: (peer: PeerRecord) => void): () => void
  onIncomingDocument(listener: (document: IncomingDocument) => void): () => void
  onError(listener: (message: string) => void): () => void
}

export function isValidDeviceId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(value)
}

export function isPairingPayload(value: unknown): value is PairingPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Partial<PairingPayload>
  return (
    payload.v === PROTOCOL_VERSION &&
    payload.kind === 'lifespire-pair' &&
    isValidDeviceId(payload.deviceId) &&
    typeof payload.name === 'string' &&
    payload.name.length > 0 &&
    payload.name.length <= 120 &&
    typeof payload.fingerprint === 'string' &&
    payload.fingerprint.length >= 16 &&
    typeof payload.secret === 'string' &&
    payload.secret.length >= 16 &&
    typeof payload.port === 'number' &&
    payload.port > 0 &&
    payload.port < 65536 &&
    typeof payload.expiresAt === 'string' &&
    (payload.host === null || typeof payload.host === 'string')
  )
}

/** `lifespire://pair?p=<percent-encoded JSON>`; the query survives any QR reader. */
export function encodePairingPayload(payload: PairingPayload): string {
  const json = JSON.stringify(payload)
  return `${PAIRING_SCHEME}://pair?p=${encodeURIComponent(json)}`
}

export function decodePairingPayload(raw: string): PairingPayload | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const fromQuery = (): string | null => {
    try {
      const url = new URL(trimmed)
      return url.searchParams.get('p')
    } catch {
      return null
    }
  }

  const candidate = fromQuery() ?? trimmed
  try {
    const parsed: unknown = JSON.parse(candidate)
    return isPairingPayload(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Compact fingerprint for spoken/typed comparisons. */
export function shortFingerprint(fingerprint: string): string {
  const clean = fingerprint.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return clean.slice(0, 4) + '-' + clean.slice(4, 8) + '-' + clean.slice(8, 12)
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * Human-typable fallback derived from the one-time secret. 8 characters of a
 * 32-symbol alphabet (~40 bits) with rate limiting; the QR path remains the
 * only MITM-resistant one because it carries the certificate fingerprint.
 */
export function pairingCodeFromSecret(secret: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < secret.length; index += 1) {
    hash ^= secret.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  let code = ''
  let value = hash
  for (let index = 0; index < 8; index += 1) {
    code += CODE_ALPHABET[value % CODE_ALPHABET.length]
    value = Math.floor(value / CODE_ALPHABET.length) + ((value % 97) + 17)
  }
  return code
}

export function normalizePairingCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function sanitizeName(value: unknown, fallback = 'LifeSpire device'): string {
  if (typeof value !== 'string') return fallback
  const clean = value.replace(/[^\w .()-]/g, '').trim()
  return (clean || fallback).slice(0, 120)
}

export function isPairingCode(value: string): boolean {
  return /^[A-Z0-9]{8}$/.test(normalizePairingCode(value))
}

export function defaultDeviceName(platform: string, fallback: string): string {
  const clean = platform.replace(/[^\w .()-]/g, '').trim()
  return (clean || fallback).slice(0, 120)
}
