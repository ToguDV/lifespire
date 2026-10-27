import crypto from 'node:crypto'
import { X509Certificate } from 'node:crypto'

/** Wire constants shared with `packages/app-core/src/sync/protocol.ts`. */
export const PROTOCOL_VERSION = 1 as const
export const DISCOVERY_PORT = 47823
export const PAIRING_TTL_MS = 5 * 60 * 1000
export const DOCUMENT_LIMIT_BYTES = 512 * 1024
export const MAX_REQUEST_BYTES = 2 * 1024 * 1024

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

export interface NearbyPeer {
  deviceId: string
  name: string
  host: string
  port: number
  fingerprint: string
  lastSeenAt: string
}

export interface PeerRecord {
  peerId: string
  name: string
  fingerprint: string
  autoSync: boolean
  pairedAt: string
  lastSyncAt: string | null
}

export interface StoredPeer extends PeerRecord {
  certPem: string
  token: string
  lastHost: string | null
  lastPort: number | null
}

export interface DeviceIdentity {
  deviceId: string
  name: string
  fingerprint: string
}

/** Main-process only: never crosses the preload/IPC boundary. */
export interface FullIdentity extends DeviceIdentity {
  certPem: string
  keyPem: string
  createdAt: string
}

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

export interface Mirror {
  documentJson: string
  docHash: string
  updatedAt: string
}

export interface IncomingDocument {
  id: string
  fromPeerId: string
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

export interface PairingRequest {
  secret?: string
  code?: string
  deviceId: string
  name: string
  fingerprint: string
  certPem: string
  token: string
  /** The client's own HTTPS port, so the host can connect back. */
  port: number
}

export function isValidDeviceId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(value)
}

export function sanitizeName(value: unknown, fallback = 'LifeSpire device'): string {
  if (typeof value !== 'string') return fallback
  const clean = value.replace(/[^\w .()-]/g, '').trim()
  return (clean || fallback).slice(0, 120)
}

export function newDeviceId(): string {
  return crypto.randomUUID()
}

export function newToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export function newSecret(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export function fingerprintFromDer(der: Buffer): string {
  return crypto.createHash('sha256').update(der).digest('base64url')
}

export function fingerprintFromPem(pem: string): string {
  return fingerprintFromDer(new X509Certificate(pem).raw)
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

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

export function shortFingerprint(fingerprint: string): string {
  const clean = fingerprint.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`
}

const IPV4_PRIVATE = [
  /^10\./,
  /^127\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
]

/** Rejects public peers even if the port is reachable through a router. */
export function isPrivateRemoteAddress(raw: string | undefined): boolean {
  if (!raw) return false
  const address = raw.startsWith('::ffff:') ? raw.slice('::ffff:'.length) : raw
  if (address === '::1') return true
  if (IPV4_PRIVATE.some((pattern) => pattern.test(address))) return true
  if (/^f[cd][0-9a-f]{2}:/i.test(address)) return true
  if (/^fe[89ab][0-9a-f]:/i.test(address)) return true
  return false
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
