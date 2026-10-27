import crypto from 'node:crypto'
import https from 'node:https'
import os from 'node:os'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Inbox } from './inbox'
import type { PeerStore } from './peerStore'
import { newStoredPeer } from './peerStore'
import type {
  FullIdentity,
  IncomingDocument,
  Mirror,
  PairingPayload,
  PairingRequest,
  PeerRecord,
} from './protocol'
import {
  DOCUMENT_LIMIT_BYTES,
  MAX_REQUEST_BYTES,
  PAIRING_TTL_MS,
  PROTOCOL_VERSION,
  isValidDeviceId,
  isPrivateRemoteAddress,
  newSecret,
  newToken,
  normalizePairingCode,
  pairingCodeFromSecret,
  sanitizeName,
} from './protocol'

export interface PairingState {
  secret: string
  code: string
  expiresAt: string
}

export interface LocalServer {
  start(): Promise<{ port: number }>
  stop(): Promise<void>
  port(): number | null
  setMirror(mirror: Mirror | null): void
  setPendingMirror(mirror: Mirror | null): void
  ackApplied(documentJson: string, docHash: string, updatedAt: string): void
  getMirror(): Mirror | null
  startPairing(): PairingPayload
  cancelPairing(): void
  pairing(): PairingPayload | null
  onPaired(listener: (peer: PeerRecord) => void): () => void
  onIncoming(listener: (item: IncomingDocument) => void): () => void
  onError(listener: (message: string) => void): () => void
}

interface PairingAttempt {
  count: number
  resetAt: number
}

const PAIRING_ATTEMPTS_PER_MINUTE = 5
const PAIRING_MAX_FAILURES = 10

function firstLanAddress(): string | null {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const info of list ?? []) {
      if (info.family !== 'IPv4' || info.internal) continue
      if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(info.address)) {
        return info.address
      }
    }
  }
  return null
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  })
  res.end(payload)
}

function empty(res: ServerResponse, status: number): void {
  res.writeHead(status, { 'cache-control': 'no-store' })
  res.end()
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const declared = Number.parseInt(req.headers['content-length'] ?? '', 10)
    if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) {
      reject(new Error('PAYLOAD_TOO_LARGE'))
      req.resume()
      return
    }
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_REQUEST_BYTES) {
        reject(new Error('PAYLOAD_TOO_LARGE'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function bearer(req: IncomingMessage): string | null {
  const header = req.headers.authorization
  if (typeof header !== 'string') return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1]?.trim() || null
}

function isPairingRequest(value: unknown): value is PairingRequest {
  if (!value || typeof value !== 'object') return false
  const request = value as Partial<PairingRequest>
  return (
    isValidDeviceId(request.deviceId) &&
    typeof request.name === 'string' &&
    request.name.length > 0 &&
    typeof request.fingerprint === 'string' &&
    request.fingerprint.length >= 16 &&
    typeof request.certPem === 'string' &&
    request.certPem.includes('BEGIN CERTIFICATE') &&
    typeof request.token === 'string' &&
    request.token.length >= 16 &&
    typeof request.port === 'number' &&
    request.port > 0 &&
    request.port < 65536 &&
    (request.secret === undefined || typeof request.secret === 'string') &&
    (request.code === undefined || typeof request.code === 'string')
  )
}

export function createLocalServer(deps: {
  identity: FullIdentity
  peers: PeerStore
  inbox: Inbox
  now?: () => Date
  advertisedHost?: string
}): LocalServer {
  const now = deps.now ?? (() => new Date())
  const pairedListeners = new Set<(peer: PeerRecord) => void>()
  const incomingListeners = new Set<(item: IncomingDocument) => void>()
  const errorListeners = new Set<(message: string) => void>()
  const attempts = new Map<string, PairingAttempt>()
  let failureCount = 0
  let server: https.Server | null = null
  let listeningPort: number | null = null
  let mirror: Mirror | null = null
  // The accepted-but-not-yet-applied document. While it exists it is the
  // current state for pulls and the CAS gate, so two peers cannot both write
  // against the same stale mirror.
  let pendingMirror: Mirror | null = null
  let ready = false
  let pairingState: PairingState | null = null

  const currentMirror = (): Mirror | null => pendingMirror ?? mirror

  const report = (message: string): void => {
    errorListeners.forEach((listener) => listener(message))
  }

  const pairingPayload = (): PairingPayload | null => {
    if (!pairingState) return null
    if (Date.parse(pairingState.expiresAt) <= now().getTime()) {
      pairingState = null
      return null
    }
    return {
      v: PROTOCOL_VERSION,
      kind: 'lifespire-pair',
      deviceId: deps.identity.deviceId,
      name: deps.identity.name,
      fingerprint: deps.identity.fingerprint,
      host: deps.advertisedHost ?? firstLanAddress(),
      port: listeningPort ?? 0,
      secret: pairingState.secret,
      expiresAt: pairingState.expiresAt,
    }
  }

  const consumeAttempt = (address: string): boolean => {
    const timestamp = now().getTime()
    const current = attempts.get(address)
    if (!current || current.resetAt <= timestamp) {
      attempts.set(address, { count: 1, resetAt: timestamp + 60_000 })
      return true
    }
    if (current.count >= PAIRING_ATTEMPTS_PER_MINUTE) return false
    current.count += 1
    return true
  }

  const pair = (request: PairingRequest, remote: string | null): PairingPayload | null => {
    const payload = pairingPayload()
    if (!payload) return null
    const secretOk = request.secret ? request.secret === payload.secret : false
    const codeOk = request.code
      ? normalizePairingCode(request.code) === pairingCodeFromSecret(payload.secret)
      : false
    if (!secretOk && !codeOk) return null
    const clientPort = request.port
    const existing = deps.peers.find(request.deviceId)
    const hostToken = newToken()
    deps.peers.upsert(
      newStoredPeer({
        peerId: request.deviceId,
        name: sanitizeName(request.name, 'Nearby device'),
        fingerprint: request.fingerprint,
        certPem: request.certPem,
        token: hostToken,
        lastHost: remote,
        lastPort: clientPort,
      }),
    )
    if (existing) {
      // Keep the original pairing date and auto-sync preference on re-pair.
      deps.peers.update(request.deviceId, {
        pairedAt: existing.pairedAt,
        autoSync: existing.autoSync,
        lastPort: clientPort,
        lastHost: remote,
      })
    }
    pairingState = null
    failureCount = 0
    const record = deps.peers.list().find((peer) => peer.peerId === request.deviceId)
    if (record) pairedListeners.forEach((listener) => listener(record))
    return payload
  }

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      const remote = req.socket.remoteAddress
      if (!isPrivateRemoteAddress(remote)) {
        json(res, 403, { message: 'Local network peers only.' })
        return
      }
      const method = (req.method ?? 'GET').toUpperCase()
      const path = new URL(req.url ?? '/', 'https://local').pathname

      if (method === 'GET' && path === '/health') {
        json(res, 200, {
          ok: true,
          deviceId: deps.identity.deviceId,
          protocol: PROTOCOL_VERSION,
        })
        return
      }

      if (method === 'POST' && path === '/v1/pair') {
        const address = remote ?? 'unknown'
        if (!consumeAttempt(address)) {
          json(res, 429, { message: 'Too many pairing attempts. Try again later.' })
          return
        }
        let body: unknown
        try {
          body = JSON.parse(await readBody(req)) as unknown
        } catch (error) {
          if (error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE') {
            json(res, 413, { message: 'Pairing payload too large.' })
            return
          }
          json(res, 400, { message: 'Invalid pairing request.' })
          return
        }
        if (!isPairingRequest(body)) {
          json(res, 400, { message: 'Invalid pairing request.' })
          return
        }
        const parked = pair(body, remote ?? null)
        if (!parked) {
          failureCount += 1
          if (failureCount >= PAIRING_MAX_FAILURES) pairingState = null
          json(res, 401, { message: 'The pairing code is invalid or expired.' })
          return
        }
        const peer = deps.peers.find(body.deviceId)
        json(res, 200, {
          ok: true,
          deviceId: deps.identity.deviceId,
          name: deps.identity.name,
          fingerprint: deps.identity.fingerprint,
          certPem: deps.identity.certPem,
          token: peer?.token ?? '',
        })
        return
      }

      const token = bearer(req)
      const peer = token ? deps.peers.findByToken(token) : null
      if (!peer) {
        json(res, 401, { message: 'Pairing token required.' })
        return
      }

      if (method === 'GET' && path === '/v1/info') {
        const current = currentMirror()
        json(res, 200, {
          deviceId: deps.identity.deviceId,
          name: deps.identity.name,
          protocol: PROTOCOL_VERSION,
          schemaVersion: 3,
          docHash: current?.docHash ?? null,
          updatedAt: current?.updatedAt ?? null,
        })
        return
      }

      if (method === 'GET' && path === '/v1/document') {
        const current = currentMirror()
        if (!current) {
          json(res, 404, { message: 'No save yet.' })
          return
        }
        json(res, 200, {
          documentJson: current.documentJson,
          docHash: current.docHash,
          updatedAt: current.updatedAt,
          schemaVersion: 3,
        })
        return
      }

      if (method === 'POST' && path === '/v1/document') {
        if (!ready) {
          json(res, 503, { message: 'The other device is still preparing its save.' })
          return
        }
        let body: unknown
        try {
          body = JSON.parse(await readBody(req)) as unknown
        } catch (error) {
          if (error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE') {
            json(res, 413, { message: 'Document too large.' })
            return
          }
          json(res, 400, { message: 'Invalid document payload.' })
          return
        }
        const payload = body as {
          documentJson?: unknown
          expectedHash?: unknown
          docHash?: unknown
        } | null
        if (!payload || typeof payload !== 'object') {
          json(res, 400, { message: 'Invalid document payload.' })
          return
        }
        // `expectedHash` is null on create; older clients may omit the key.
        // Treat a missing key the same as an explicit null.
        const expectedHash = payload.expectedHash ?? null
        if (
          typeof payload.documentJson !== 'string' ||
          Buffer.byteLength(payload.documentJson) > DOCUMENT_LIMIT_BYTES ||
          typeof payload.docHash !== 'string' ||
          (expectedHash !== null && typeof expectedHash !== 'string')
        ) {
          json(res, 413, { message: 'Document too large or malformed.' })
          return
        }
        try {
          JSON.parse(payload.documentJson)
        } catch {
          json(res, 422, { message: 'The document is not valid JSON.' })
          return
        }
        const current = currentMirror()
        if (current && expectedHash !== current.docHash) {
          json(res, 409, { docHash: current.docHash, updatedAt: current.updatedAt })
          return
        }
        if (!current && expectedHash !== null) {
          json(res, 409, { docHash: null, updatedAt: null })
          return
        }
        if (current && payload.docHash === current.docHash) {
          json(res, 200, { docHash: current.docHash, updatedAt: current.updatedAt })
          return
        }
        pendingMirror = {
          documentJson: payload.documentJson,
          docHash: payload.docHash,
          updatedAt: now().toISOString(),
        }
        const item: IncomingDocument = {
          id: crypto.randomUUID(),
          fromPeerId: peer.peerId,
          documentJson: payload.documentJson,
          docHash: payload.docHash,
          updatedAt: now().toISOString(),
        }
        try {
          deps.inbox.add(item)
        } catch (error) {
          pendingMirror = null
          report(error instanceof Error ? error.message : 'Could not store the incoming document.')
          json(res, 500, { message: 'Could not store the document.' })
          return
        }
        deps.peers.touch(peer.peerId, {
          lastSyncAt: item.updatedAt,
          ...(remote ? { lastHost: remote } : {}),
        })
        incomingListeners.forEach((listener) => listener(item))
        json(res, 202, { docHash: item.docHash, updatedAt: item.updatedAt })
        return
      }

      if (method === 'POST' && path === '/v1/unpair') {
        deps.peers.remove(peer.peerId)
        empty(res, 204)
        return
      }

      json(res, 404, { message: 'Not found.' })
    } catch (error) {
      report(error instanceof Error ? error.message : 'Local server error.')
      if (!res.headersSent) json(res, 500, { message: 'Local server error.' })
      else res.end()
    }
  }

  return {
    start: () =>
      new Promise((resolve, reject) => {
        if (server && listeningPort) {
          resolve({ port: listeningPort })
          return
        }
        const next = https.createServer(
          { key: deps.identity.keyPem, cert: deps.identity.certPem },
          (req, res) => {
            void handle(req, res)
          },
        )
        server = next
        next.on('tlsClientError', () => {
          // A bad TLS handshake is not an application error.
        })
        next.once('error', (error) => {
          report(`Local sync server failed: ${error.message}`)
          reject(error)
        })
        next.listen(0, '0.0.0.0', () => {
          const address = next.address()
          if (!address || typeof address === 'string') {
            reject(new Error('Could not determine the local sync port.'))
            return
          }
          listeningPort = address.port
          resolve({ port: address.port })
        })
      }),

    stop: async () => {
      pairingState = null
      const current = server
      server = null
      listeningPort = null
      if (!current) return
      if (typeof current.closeAllConnections === 'function') current.closeAllConnections()
      await new Promise<void>((resolve) => {
        current.close(() => resolve())
      })
    },

    port: () => listeningPort,
    setMirror: (next) => {
      mirror = next
      ready = next !== null
    },
    setPendingMirror: (next) => {
      pendingMirror = next
      if (next) ready = true
    },
    ackApplied: (documentJson, docHash, updatedAt) => {
      mirror = { documentJson, docHash, updatedAt }
      pendingMirror = null
      ready = true
    },
    getMirror: () => currentMirror(),

    startPairing: () => {
      const secret = newSecret()
      const expiresAt = new Date(now().getTime() + PAIRING_TTL_MS).toISOString()
      pairingState = { secret, code: pairingCodeFromSecret(secret), expiresAt }
      failureCount = 0
      const payload = pairingPayload()
      if (!payload) throw new Error('Could not create a pairing code.')
      return payload
    },

    cancelPairing: () => {
      pairingState = null
    },

    pairing: () => pairingPayload(),

    onPaired(listener) {
      pairedListeners.add(listener)
      return () => pairedListeners.delete(listener)
    },
    onIncoming(listener) {
      incomingListeners.add(listener)
      return () => incomingListeners.delete(listener)
    },
    onError(listener) {
      errorListeners.add(listener)
      return () => errorListeners.delete(listener)
    },
  }
}
