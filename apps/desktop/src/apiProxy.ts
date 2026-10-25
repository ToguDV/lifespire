/**
 * Desktop API proxy.
 *
 * The renderer lives on `lifespire-app://app`, which the API's browser
 * contract (CORS + HttpOnly `SameSite=Lax` cookies) does not cover. Instead of
 * relaxing the server, every sync request goes through the Electron main
 * process: it calls the configured origin from a dedicated API session, uses
 * the native-client grant and keeps the refresh token out of renderer
 * JavaScript.
 *
 * This module is deliberately Electron-free so its policy and session logic
 * can be unit-tested in plain Node. `main.ts` wires the dedicated session
 * fetch, `safeStorage` and the userData file, and `preload.ts` exposes the
 * narrow IPC bridge.
 */

import path from 'node:path'
import { APP_HOST, APP_SCHEME } from './protocol'

export const API_PROXY_CHANNELS = {
  request: 'lifespire:api-request',
  setServer: 'lifespire:sync-set-server',
  sessionState: 'lifespire:auth-session-state',
  signOut: 'lifespire:auth-sign-out',
} as const

export const API_PROXY_TIMEOUT_MS = 10_000
export const API_PROXY_HEALTH_TIMEOUT_MS = 6_000
export const API_PROXY_MAX_BODY_BYTES = 1024 * 1024
export const API_PROXY_MAX_RESPONSE_BYTES = 5 * 1024 * 1024
export const HEALTH_PATH = '/health/live'

const NATIVE_CLIENT_PLATFORM = 'desktop'
const AUTH_TOKEN_PATHS: ReadonlySet<string> = new Set([
  '/v1/auth/login',
  '/v1/auth/accept-invite',
  '/v1/auth/refresh',
])
const REFRESH_PATH = '/v1/auth/refresh'
const LOGOUT_PATHS: ReadonlySet<string> = new Set(['/v1/auth/logout', '/v1/auth/logout-all'])
const ALLOWED_METHODS: ReadonlySet<string> = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
// `If-None-Match` is required by GET /v1/sync (304) and the first PUT
// (`If-None-Match: *`); the rest cover auth, JSON, optimistic concurrency and
// idempotent pushes. Everything else (cookies, host, origin…) is dropped.
const ALLOWED_REQUEST_HEADERS: ReadonlySet<string> = new Set([
  'authorization',
  'content-type',
  'if-match',
  'if-none-match',
  'idempotency-key',
])
const ALLOWED_RESPONSE_HEADERS: ReadonlySet<string> = new Set([
  'content-type',
  'etag',
  'cache-control',
  'retry-after',
  'x-request-id',
])
// Conservative path charset: no spaces, separators or control characters.
const PATH_PATTERN = /^[A-Za-z0-9/_.~%?=&-]+$/

export type SessionPersistence = 'encrypted' | 'memory-only'

export interface SessionState {
  persistence: SessionPersistence
  signedIn: boolean
  serverOrigin: string | null
}

export interface ProxyRequest {
  path: string
  method: string
  headers: Record<string, string>
  body?: string
  /** Only honoured for the unauthenticated `/health/live` probe. */
  origin?: string
}

export interface ProxyResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  /** The HTTP response is preserved even if local credential cleanup failed. */
  cleanupError?: { code: string; message: string }
}

export type ProxyResult =
  | { ok: true; response: ProxyResponse }
  | { ok: false; error: { code: string; message: string } }

export class ApiProxyError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ApiProxyError'
    this.code = code
  }
}

/**
 * Link-local addresses reach cloud metadata services, so they are never valid
 * sync servers even when the URL is user-supplied. Private LAN ranges stay
 * allowed: self-hosting is a supported use case. Only IP literals are checked;
 * DNS aliases (metadata.google.internal, *.nip.io) are documented as out of
 * scope because blocking them would require DNS resolution.
 */
function isBlockedMetadataHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '')
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(host)) return true

  // URL canonicalizes dotted IPv4-mapped addresses to `::ffff:hhhh:hhhh`.
  if (host.startsWith('::ffff:')) {
    const groups = host.slice('::ffff:'.length).split(':')
    if (groups.length === 2) {
      const high = Number.parseInt(groups[0] ?? '', 16)
      const low = Number.parseInt(groups[1] ?? '', 16)
      if (Number.isFinite(high) && Number.isFinite(low)) {
        const first = (high >> 8) & 0xff
        const second = high & 0xff
        if (first === 169 && second === 254) return true
      }
    }
    if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(host.slice('::ffff:'.length))) return true
  }

  const firstGroup = host.split(':')[0] ?? ''
  if (/^[0-9a-f]{1,4}$/.test(firstGroup)) {
    const prefix = Number.parseInt(firstGroup, 16)
    // fe80::/10 IPv6 link-local.
    if ((prefix & 0xffc0) === 0xfe80) return true
  }
  return host === 'fd00:ec2::254'
}

/** World-readable origin check: http(s), no credentials, no path. */
export function normalizeProxyOrigin(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed.length === 0 || trimmed.length > 2000) return null
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (url.username || url.password) return null
  if (url.search || url.hash) return null
  if (url.pathname !== '/' && url.pathname !== '') return null
  if (isBlockedMetadataHost(url.hostname)) return null
  return url.origin
}

/**
 * Accepts only `/health/live` and `/v1/...`; rejects absolute URLs,
 * protocol-relative paths and any dot-segment or encoded-separator attempt.
 */
export function sanitizeProxyPath(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) {
    throw new ApiProxyError('INVALID_REQUEST', 'Invalid API path.')
  }
  if (!raw.startsWith('/') || raw.startsWith('//')) {
    throw new ApiProxyError('INVALID_REQUEST', 'API paths must be relative to the server.')
  }
  if (!PATH_PATTERN.test(raw)) {
    throw new ApiProxyError('INVALID_REQUEST', 'The API path contains unsupported characters.')
  }
  const queryAt = raw.indexOf('?')
  const pathname = queryAt === -1 ? raw : raw.slice(0, queryAt)
  const search = queryAt === -1 ? '' : raw.slice(queryAt)

  if (
    pathname.includes('//') ||
    pathname.includes('..') ||
    /%(2e|2f|5c)/i.test(pathname)
  ) {
    throw new ApiProxyError('INVALID_REQUEST', 'The API path is not allowed.')
  }
  if (pathname === HEALTH_PATH) {
    if (search) throw new ApiProxyError('INVALID_REQUEST', 'The health probe takes no query.')
    return pathname
  }
  if (!pathname.startsWith('/v1/')) {
    throw new ApiProxyError('INVALID_REQUEST', 'Only the /v1 API and /health/live are proxied.')
  }
  return `${pathname}${search}`
}

function sanitizeHeaders(raw: unknown): Record<string, string> {
  if (raw === undefined) return {}
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ApiProxyError('INVALID_REQUEST', 'Invalid request headers.')
  }
  const headers: Record<string, string> = {}
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    const lower = name.toLowerCase()
    if (!ALLOWED_REQUEST_HEADERS.has(lower)) continue
    if (typeof value !== 'string' || /[\r\n]/.test(value)) {
      throw new ApiProxyError('INVALID_REQUEST', `Invalid value for header ${lower}.`)
    }
    headers[lower] = value
  }
  return headers
}

/** Validates the renderer payload before anything touches the network. */
export function sanitizeProxyRequest(raw: unknown): ProxyRequest {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ApiProxyError('INVALID_REQUEST', 'Invalid proxy request.')
  }
  const input = raw as Record<string, unknown>
  const path = sanitizeProxyPath(input.path)
  if (typeof input.method !== 'string') {
    throw new ApiProxyError('INVALID_REQUEST', 'Missing request method.')
  }
  const method = input.method.toUpperCase()
  if (!ALLOWED_METHODS.has(method)) {
    throw new ApiProxyError('INVALID_REQUEST', `Method ${method} is not allowed.`)
  }

  let body: string | undefined
  if (input.body !== undefined) {
    if (typeof input.body !== 'string') {
      throw new ApiProxyError('INVALID_REQUEST', 'The request body must be a string.')
    }
    if (method === 'GET' || method === 'DELETE') {
      throw new ApiProxyError('INVALID_REQUEST', `Method ${method} cannot carry a body.`)
    }
    const bytes = new TextEncoder().encode(input.body).length
    if (bytes > API_PROXY_MAX_BODY_BYTES) {
      throw new ApiProxyError('BODY_TOO_LARGE', 'The request body exceeds 1 MB.')
    }
    body = input.body
  }

  let origin: string | undefined
  if (input.origin !== undefined) {
    const normalized = normalizeProxyOrigin(input.origin)
    if (!normalized) throw new ApiProxyError('INVALID_REQUEST', 'Invalid probe origin.')
    origin = normalized
  }

  const request: ProxyRequest = {
    path,
    method,
    headers: sanitizeHeaders(input.headers),
  }
  if (body !== undefined) request.body = body
  if (origin !== undefined) request.origin = origin
  return request
}

/**
 * Chromium stamps `Sec-Fetch-Site: none` (plus any Origin/Referer) on
 * session fetches, and the native-client gate requires Fetch Metadata to be
 * absent. This runs only in the dedicated API session, which no renderer
 * request can reach, so every request there is a proxy request.
 */
export function stripFetchMetadata(headers: Record<string, string | string[]>): void {
  for (const name of Object.keys(headers)) {
    const lower = name.toLowerCase()
    if (lower === 'sec-fetch-site' || lower === 'origin' || lower === 'referer') {
      delete headers[name]
    }
  }
}

export interface FetchMetadataSession {
  webRequest: {
    onBeforeSendHeaders(
      filter: { urls: string[] },
      listener: (
        details: { requestHeaders: Record<string, string | string[]> },
        callback: (response: {
          requestHeaders: Record<string, string | string[]>
        }) => void,
      ) => void,
    ): void
  }
}

/**
 * Installs the strip only on the dedicated API session. The default session is
 * never touched, so renderer requests keep their real Fetch Metadata.
 */
export function installFetchMetadataStrip(ses: FetchMetadataSession): void {
  ses.webRequest.onBeforeSendHeaders(
    { urls: ['http://*/*', 'https://*/*'] },
    (details, callback) => {
      stripFetchMetadata(details.requestHeaders)
      callback({ requestHeaders: details.requestHeaders })
    },
  )
}

/** The packaged renderer origin, or the configured dev server while unpackaged. */
export function isTrustedSender(
  frameUrl: string | null | undefined,
  policy: { isPackaged: boolean; devUrl: string },
): boolean {
  if (!frameUrl) return false
  let url: URL
  try {
    url = new URL(frameUrl)
  } catch {
    return false
  }
  if (policy.isPackaged) return url.protocol === `${APP_SCHEME}:` && url.host === APP_HOST
  try {
    return url.origin === new URL(policy.devUrl).origin
  } catch {
    return false
  }
}

export interface IpcSenderState {
  senderIsMainWindow: boolean
  frameIsMainFrame: boolean
  frameUrl: string | null | undefined
}

/** IPC is only accepted from the main window's top frame on the app origin. */
export function isTrustedIpcSender(
  state: IpcSenderState,
  policy: { isPackaged: boolean; devUrl: string },
): boolean {
  return (
    state.senderIsMainWindow &&
    state.frameIsMainFrame &&
    isTrustedSender(state.frameUrl, policy)
  )
}

export interface TokenVaultFile {
  read(): string | null
  write(value: string): void
  remove(): void
}

export interface VaultFs {
  readFileSync(filePath: string, encoding: 'utf8'): string
  mkdirSync(dirPath: string, options: { recursive: true }): void
  writeFileSync(filePath: string, data: string, options: { mode: number }): void
  chmodSync(filePath: string, mode: number): void
  renameSync(from: string, to: string): void
  rmSync(filePath: string, options: { force: true }): void
}

/**
 * Atomic credential file: write a private temp file, fsync the mode and rename
 * over the target. A failed write removes the temp file and propagates.
 */
export function createVaultFile(
  vaultPath: string,
  fs: VaultFs,
  nextTempPath: (vaultPath: string) => string = (target) =>
    `${target}.${process.pid}.${Date.now()}.tmp`,
): TokenVaultFile {
  const read = (): string | null => {
    try {
      return fs.readFileSync(vaultPath, 'utf8')
    } catch {
      return null
    }
  }

  const write = (value: string): void => {
    fs.mkdirSync(path.dirname(vaultPath), { recursive: true })
    const temp = nextTempPath(vaultPath)
    try {
      fs.writeFileSync(temp, value, { mode: 0o600 })
      fs.chmodSync(temp, 0o600)
      fs.renameSync(temp, vaultPath)
    } catch (error) {
      try {
        fs.rmSync(temp, { force: true })
      } catch {
        // Keep the original write error.
      }
      throw error
    }
  }

  return {
    read,
    write,
    // `force` tolerates a missing file; permission/read-only errors surface.
    remove: () => fs.rmSync(vaultPath, { force: true }),
  }
}

export interface TokenVaultCrypto {
  isEncryptionAvailable(): boolean
  /** True when the OS keyring is missing and safeStorage falls back to plaintext. */
  usesPlainTextBackend(): boolean
  encryptString(value: string): Buffer
  decryptString(value: Buffer): string
}

export interface TokenVault {
  persistence(): SessionPersistence
  load(origin: string | null): string | null
  save(origin: string, token: string): void
  clear(): void
}

interface StoredSession {
  version: 1
  origin: string
  token: string
}

/**
 * Persists the refresh token through `safeStorage` on disk, keyed by server
 * origin. When encryption is unavailable (or Linux reports the `basic_text`
 * backend) the token only lives in this process; the UI is told so at runtime.
 */
export function createTokenVault(deps: {
  file: TokenVaultFile
  crypto: TokenVaultCrypto
}): TokenVault {
  let memory: { origin: string; token: string } | null = null
  // Once a persisted credential cannot be deleted, never trust the vault
  // again in this process: reloading it would resurrect a session the user
  // tried to close.
  let vaultBlocked = false

  const canPersist = (): boolean => {
    try {
      return deps.crypto.isEncryptionAvailable() && !deps.crypto.usesPlainTextBackend()
    } catch {
      return false
    }
  }

  const parseStored = (raw: string | null): StoredSession | null => {
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as Partial<StoredSession>
      if (
        parsed.version !== 1 ||
        typeof parsed.origin !== 'string' ||
        typeof parsed.token !== 'string'
      ) {
        return null
      }
      return { version: 1, origin: parsed.origin, token: parsed.token }
    } catch {
      return null
    }
  }

  const removeStored = (): void => {
    try {
      deps.file.remove()
    } catch (error) {
      vaultBlocked = true
      throw error
    }
  }

  return {
    persistence: () => (canPersist() ? 'encrypted' : 'memory-only'),

    load: (origin) => {
      if (!origin || vaultBlocked) return null
      if (memory?.origin === origin) return memory.token
      if (memory) memory = null
      const raw = deps.file.read()
      const stored = parseStored(raw)
      if (!stored) {
        // Without encryption any leftover file is an orphan, even corrupt.
        if (!canPersist() && raw !== null) removeStored()
        return null
      }
      // Without encryption a persisted token is unusable. Remove it instead of
      // leaving an orphan that a later keyring-enabled run would restore.
      if (!canPersist() || stored.origin !== origin) {
        removeStored()
        return null
      }
      try {
        const token = deps.crypto.decryptString(Buffer.from(stored.token, 'base64'))
        memory = { origin, token }
        return token
      } catch {
        return null
      }
    },

    save: (origin, token) => {
      if (!canPersist()) {
        // Memory-only sessions must not leave an old encrypted credential
        // behind for a later process to resurrect.
        if (deps.file.read() !== null) {
          try {
            removeStored()
          } catch (error) {
            memory = null
            throw error
          }
        }
        memory = { origin, token }
        return
      }
      const encrypted = deps.crypto.encryptString(token)
      const stored: StoredSession = {
        version: 1,
        origin,
        token: encrypted.toString('base64'),
      }
      // Write first: a failed disk write must not leave a phantom session.
      deps.file.write(JSON.stringify(stored))
      memory = { origin, token }
    },

    clear: () => {
      memory = null
      // Missing files are handled by the file adapter; real delete failures
      // (permissions, read-only volumes) must reach the caller.
      removeStored()
    },
  }
}

export interface ApiProxy {
  request(raw: unknown): Promise<ProxyResult>
  setServer(raw: unknown): SessionState
  sessionState(): SessionState
  signOut(): SessionState
}

export interface ApiProxyDeps {
  fetch: typeof fetch
  vault: TokenVault
  timeoutMs?: number
  healthTimeoutMs?: number
}

function failure(code: string, message: string): ProxyResult {
  return { ok: false, error: { code, message } }
}

function resolveOrigin(request: ProxyRequest, configured: string | null): string {
  if (request.origin !== undefined) {
    if (request.path !== HEALTH_PATH) {
      throw new ApiProxyError(
        'ORIGIN_NOT_ALLOWED',
        'Only the health probe may target a server other than the configured one.',
      )
    }
    return request.origin
  }
  if (!configured) {
    throw new ApiProxyError(
      'SYNC_NOT_CONFIGURED',
      'Choose a sync server in Settings before signing in.',
    )
  }
  return configured
}

function responseFrom(
  res: Response,
  body: string,
  cleanupError?: ProxyResponse['cleanupError'],
): ProxyResponse {
  const headers: Record<string, string> = {}
  res.headers.forEach((value, name) => {
    const lower = name.toLowerCase()
    if (ALLOWED_RESPONSE_HEADERS.has(lower)) headers[lower] = value
  })
  const response: ProxyResponse = { status: res.status, statusText: res.statusText, headers, body }
  if (cleanupError) response.cleanupError = cleanupError
  return response
}

/** True when the transport rejected a request because it redirected. */
function isRedirectFailure(error: unknown): boolean {
  let current: unknown = error
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    if (/redirect/i.test(current.message)) return true
    current = (current as Error & { cause?: unknown }).cause
  }
  return false
}

/** Normalizes the pathname before matching auth/logout routes (S2). */
function pathnameOf(path: string): string {
  return new URL(path, 'http://proxy.invalid').pathname
}

/** Reads a response without ever buffering more than the proxy cap (I7). */
async function readResponseBody(
  res: Response,
  controller: AbortController,
  markOversize: () => void,
): Promise<string> {
  const failOversize = async (): Promise<never> => {
    // Stop the transfer before surfacing the size error; waiting for the body
    // would defeat the cap. Mark the reason before aborting: the shared abort
    // race may reject first.
    markOversize()
    controller.abort()
    await res.body?.cancel().catch(() => undefined)
    throw new ApiProxyError('RESPONSE_TOO_LARGE', 'The server response exceeds 5 MB.')
  }
  const declared = Number(res.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > API_PROXY_MAX_RESPONSE_BYTES) {
    return failOversize()
  }
  if (!res.body) return ''
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > API_PROXY_MAX_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined)
      return failOversize()
    }
    text += decoder.decode(value, { stream: true })
  }
  return text + decoder.decode()
}

function stripRefreshToken(body: string): { body: string; token: string | null } {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new ApiProxyError('INVALID_RESPONSE', 'The server returned an invalid auth response.')
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ApiProxyError('INVALID_RESPONSE', 'The server returned an invalid auth response.')
  }
  const record = parsed as Record<string, unknown>
  const token = typeof record.refreshToken === 'string' ? record.refreshToken : null
  delete record.refreshToken
  return { body: JSON.stringify(record), token }
}

export function createApiProxy(deps: ApiProxyDeps): ApiProxy {
  const timeoutMs = deps.timeoutMs ?? API_PROXY_TIMEOUT_MS
  const healthTimeoutMs = deps.healthTimeoutMs ?? API_PROXY_HEALTH_TIMEOUT_MS
  let serverOrigin: string | null = null
  let refreshToken: string | null = null
  let tokenOrigin: string | null = null
  // Every server switch or local sign-out invalidates in-flight work. A
  // response can only commit a token if its generation is still current.
  let generation = 0
  const inFlight = new Set<AbortController>()

  const abortInFlight = (): void => {
    for (const controller of inFlight) controller.abort()
    inFlight.clear()
  }

  /** Compare-and-swap: only clear the token that the caller actually sent. */
  const dropToken = (expected?: string): void => {
    if (expected !== undefined && refreshToken !== expected) return
    refreshToken = null
    tokenOrigin = null
    deps.vault.clear()
  }

  const sessionState = (): SessionState => ({
    persistence: deps.vault.persistence(),
    // A token minted for another server can never count as signed in.
    signedIn: refreshToken !== null && tokenOrigin === serverOrigin && serverOrigin !== null,
    serverOrigin,
  })

  const setServer = (raw: unknown): SessionState => {
    const next = raw === null || raw === undefined || raw === '' ? null : normalizeProxyOrigin(raw)
    if (raw !== null && raw !== undefined && raw !== '' && next === null) {
      throw new ApiProxyError('ORIGIN_NOT_ALLOWED', 'Invalid sync server origin.')
    }
    generation += 1
    abortInFlight()

    const previous = serverOrigin
    refreshToken = null
    tokenOrigin = null
    serverOrigin = next

    if (next === null) {
      // Boot without a server (or turning sync off) always clears the vault.
      deps.vault.clear()
    } else if (previous !== null && previous !== next) {
      deps.vault.clear()
    }
    // Going from "no server" to one is the boot path: load() also deletes a
    // persisted credential that belongs to a different origin.
    if (serverOrigin) {
      const loaded = deps.vault.load(serverOrigin)
      if (loaded && serverOrigin === next) {
        refreshToken = loaded
        tokenOrigin = serverOrigin
      }
    }
    return sessionState()
  }

  const signOut = (): SessionState => {
    generation += 1
    abortInFlight()
    dropToken()
    return sessionState()
  }

  const request = async (raw: unknown): Promise<ProxyResult> => {
    let targetOrigin: string
    let request: ProxyRequest
    try {
      request = sanitizeProxyRequest(raw)
      targetOrigin = resolveOrigin(request, serverOrigin)
    } catch (error) {
      if (error instanceof ApiProxyError) return failure(error.code, error.message)
      throw error
    }

    const requestGeneration = generation
    const pathname = pathnameOf(request.path)
    const isRefresh = pathname === REFRESH_PATH
    const sentToken = isRefresh ? refreshToken : null
    const headers: Record<string, string> = { ...request.headers }
    let body = request.body
    if (AUTH_TOKEN_PATHS.has(pathname)) headers['x-client-platform'] = NATIVE_CLIENT_PLATFORM
    if (isRefresh) {
      if (!sentToken || tokenOrigin !== targetOrigin) {
        return failure('AUTH_TOKEN_EXPIRED', 'You are not signed in on this server.')
      }
      headers['content-type'] = 'application/json'
      body = JSON.stringify({ refreshToken: sentToken })
    }

    const controller = new AbortController()
    inFlight.add(controller)
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, pathname === HEALTH_PATH ? healthTimeoutMs : timeoutMs)
    // Race the transport as well as the signal: a transport that ignores
    // AbortSignal must still not hang the main process forever.
    const timeoutRejection = new Promise<never>((_resolve, reject) => {
      controller.signal.addEventListener('abort', () => reject(new Error('aborted')), {
        once: true,
      })
    })

    const fetchOnce = (url: string): Promise<Response> =>
      Promise.race([
        deps.fetch(url, {
          method: request.method,
          headers,
          body,
          credentials: 'omit',
          redirect: 'error',
          signal: controller.signal,
        }),
        timeoutRejection,
      ])

    let res: Response
    let responseBody: string
    let responseTooLarge = false
    try {
      res = await fetchOnce(`${targetOrigin}${request.path}`)
      responseBody = await Promise.race([
        readResponseBody(res, controller, () => {
          responseTooLarge = true
        }),
        timeoutRejection,
      ])
    } catch (error) {
      if (error instanceof ApiProxyError) return failure(error.code, error.message)
      if (responseTooLarge) {
        return failure('RESPONSE_TOO_LARGE', 'The server response exceeds 5 MB.')
      }
      if (timedOut) {
        return failure('API_TIMEOUT', 'The sync server did not answer in time.')
      }
      if (controller.signal.aborted) {
        return failure('REQUEST_ABORTED', 'The session changed while the request was in flight.')
      }
      if (pathname === HEALTH_PATH && isRedirectFailure(error)) {
        return failure(
          'HEALTH_REDIRECT',
          'That address redirects elsewhere — use the final https:// address.',
        )
      }
      return failure('API_UNREACHABLE', 'Could not reach the sync server.')
    } finally {
      clearTimeout(timer)
      inFlight.delete(controller)
    }

    if (requestGeneration !== generation) {
      return failure('REQUEST_ABORTED', 'The session changed while the request was in flight.')
    }

    if (AUTH_TOKEN_PATHS.has(pathname) && res.ok) {
      try {
        const stripped = stripRefreshToken(responseBody)
        if (!stripped.token) {
          try {
            dropToken(isRefresh ? (sentToken ?? undefined) : undefined)
          } catch {
            // The vault is blocked; the typed error still reaches the UI.
          }
          return failure(
            'NATIVE_GRANT_REQUIRED',
            'The server did not grant a desktop session. Update the sync server and try again.',
          )
        }
        // A concurrent logout/server switch, or a newer rotation, wins.
        if (requestGeneration !== generation || (isRefresh && sentToken !== refreshToken)) {
          return failure('REQUEST_ABORTED', 'The session changed while the request was in flight.')
        }
        deps.vault.save(targetOrigin, stripped.token)
        refreshToken = stripped.token
        tokenOrigin = targetOrigin
        responseBody = stripped.body
      } catch (error) {
        if (error instanceof ApiProxyError) return failure(error.code, error.message)
        return failure('VAULT_WRITE_FAILED', 'Could not persist the sync session.')
      }
    }

    let cleanupError: ProxyResponse['cleanupError']
    try {
      // A rejected rotation means the family is gone (expired, revoked or
      // reused); keep a dead token only to fail every future refresh.
      if (isRefresh && (res.status === 401 || res.status === 403)) {
        dropToken(sentToken ?? undefined)
      }
      if (LOGOUT_PATHS.has(pathname) && res.ok) dropToken()
    } catch {
      // Never replace a meaningful 401 (or a successful 204) with a local
      // cleanup failure: the HTTP semantics drive restore/logout. The vault is
      // blocked from reloading in this process, and the warning travels with
      // the response.
      cleanupError = {
        code: 'VAULT_DELETE_FAILED',
        message: 'The local sync session could not be cleared.',
      }
    }

    if (requestGeneration !== generation) {
      return failure('REQUEST_ABORTED', 'The session changed while the request was in flight.')
    }
    return { ok: true, response: responseFrom(res, responseBody, cleanupError) }
  }

  return { request, setServer, sessionState, signOut }
}
