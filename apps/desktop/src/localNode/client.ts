import tls from 'node:tls'
import { MAX_REQUEST_BYTES, fingerprintFromDer } from './protocol'

export const PINNED_REQUEST_TIMEOUT_MS = 12_000
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024

export interface PinnedRequest {
  host: string
  port: number
  method: 'GET' | 'POST'
  path: string
  body?: unknown
  token?: string | null
  /** Pinned certificate fingerprint (SHA-256 of the DER, base64url). */
  expectedFingerprint: string
  timeoutMs?: number
}

export interface PinnedResponse {
  status: number
  body: unknown
  fingerprint: string
  certPem: string
}

export interface PinnedClient {
  request(options: PinnedRequest): Promise<PinnedResponse>
}

function pemFromDer(der: Buffer): string {
  const base64 = der.toString('base64').match(/.{1,64}/g)?.join('\n') ?? ''
  return `-----BEGIN CERTIFICATE-----\n${base64}\n-----END CERTIFICATE-----\n`
}

function parseHeaders(raw: string): { status: number; headers: Map<string, string> } | null {
  const lines = raw.split('\r\n')
  const statusLine = lines.shift() ?? ''
  const match = /^HTTP\/1\.[01] (\d{3})/.exec(statusLine)
  if (!match) return null
  const headers = new Map<string, string>()
  for (const line of lines) {
    const index = line.indexOf(':')
    if (index === -1) continue
    headers.set(line.slice(0, index).trim().toLowerCase(), line.slice(index + 1).trim())
  }
  return { status: Number.parseInt(match[1] ?? '0', 10), headers }
}

function decodeChunked(raw: Buffer): Buffer {
  const chunks: Buffer[] = []
  let offset = 0
  while (offset < raw.length) {
    const lineEnd = raw.indexOf('\r\n', offset)
    if (lineEnd === -1) break
    const size = Number.parseInt(raw.slice(offset, lineEnd).toString('ascii'), 16)
    if (!Number.isFinite(size) || size <= 0) break
    const start = lineEnd + 2
    chunks.push(raw.slice(start, start + size))
    offset = start + size + 2
  }
  return Buffer.concat(chunks)
}

function parseResponse(raw: Buffer): { status: number; body: unknown } {
  const separator = raw.indexOf('\r\n\r\n')
  if (separator === -1) throw new Error('The other device sent an incomplete response.')
  const head = parseHeaders(raw.slice(0, separator).toString('utf8'))
  if (!head) throw new Error('The other device sent an invalid HTTP response.')
  let bodyBuffer: Buffer<ArrayBufferLike> = raw.slice(separator + 4)
  if (head.headers.get('transfer-encoding')?.toLowerCase().includes('chunked')) {
    bodyBuffer = decodeChunked(bodyBuffer)
  }
  const text = bodyBuffer.toString('utf8').trim()
  if (!text) return { status: head.status, body: null }
  try {
    return { status: head.status, body: JSON.parse(text) as unknown }
  } catch {
    throw new Error('The other device sent an invalid JSON response.')
  }
}

/**
 * Minimal HTTP/1.1 client over an explicit TLS socket. The fingerprint is
 * checked on `secureConnect`, before any header, token or document is written,
 * so a spoofed discovery packet or a wrong certificate never sees the payload.
 */
export function createPinnedClient(
  options: { timeoutMs?: number } = {},
): PinnedClient {
  return {
    request: (request) =>
      new Promise<PinnedResponse>((resolve, reject) => {
        const timeoutMs = request.timeoutMs ?? options.timeoutMs ?? PINNED_REQUEST_TIMEOUT_MS
        let settled = false
        let buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0)
        let fingerprint = ''
        let certPem = ''
        const socket = tls.connect({
          host: request.host,
          port: request.port,
          servername: /^[\d.]+$/.test(request.host) ? undefined : request.host,
          rejectUnauthorized: false,
        })

        const finish = (error: Error | null, response?: PinnedResponse): void => {
          if (settled) return
          settled = true
          socket.destroy()
          if (error) reject(error)
          else if (response) resolve(response)
        }

        socket.setTimeout(timeoutMs, () => {
          finish(new Error('The other device did not answer in time.'))
        })
        socket.on('error', (error) => finish(error))

        socket.once('secureConnect', () => {
          const certificate = socket.getPeerCertificate()
          if (!certificate || !certificate.raw) {
            finish(new Error('The other device did not present a certificate.'))
            return
          }
          fingerprint = fingerprintFromDer(certificate.raw)
          if (fingerprint !== request.expectedFingerprint) {
            finish(new Error('The other device presented a different certificate.'))
            return
          }
          certPem = pemFromDer(certificate.raw)

          const body = request.body === undefined ? '' : JSON.stringify(request.body)
          const bodyBytes = Buffer.byteLength(body)
          if (bodyBytes > MAX_REQUEST_BYTES) {
            finish(new Error('The document is too large to send.'))
            return
          }
          const hostHeader = request.host.includes(':')
            ? `[${request.host}]:${request.port}`
            : `${request.host}:${request.port}`
          const headers = [
            `${request.method} ${request.path} HTTP/1.1`,
            `Host: ${hostHeader}`,
            'Accept: application/json',
            'Connection: close',
            `Content-Length: ${bodyBytes}`,
          ]
          if (bodyBytes > 0) headers.push('Content-Type: application/json')
          if (request.token) headers.push(`Authorization: Bearer ${request.token}`)
          socket.write(`${headers.join('\r\n')}\r\n\r\n${body}`)
        })

        socket.on('data', (chunk) => {
          buffer = Buffer.concat([buffer, chunk])
          if (buffer.length > MAX_RESPONSE_BYTES) {
            finish(new Error('The other device sent a response that is too large.'))
          }
        })

        socket.on('end', () => {
          try {
            const parsed = parseResponse(buffer)
            finish(null, { ...parsed, fingerprint, certPem })
          } catch (error) {
            finish(error instanceof Error ? error : new Error('Invalid response.'))
          }
        })
      }),
  }
}
