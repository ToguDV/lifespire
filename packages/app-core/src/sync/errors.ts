/**
 * Errors shared by the local (LAN) sync engine and the platform transports.
 *
 * The old cloud client had its own error classes in `@lifespire/api-client`.
 * Local sync keeps the same conflict shape so the conservative 3-way merge and
 * the conflict dialog could be ported without changing their semantics.
 */

export class SyncConflictError extends Error {
  readonly currentVersion: string
  readonly currentUpdatedAt: string

  constructor(currentVersion: string, currentUpdatedAt: string) {
    super('SYNC_VERSION_CONFLICT')
    this.name = 'SyncConflictError'
    this.currentVersion = currentVersion
    this.currentUpdatedAt = currentUpdatedAt
  }
}

/** A transport-level failure with an HTTP-like status when one exists. */
export class LocalSyncError extends Error {
  readonly status: number | null
  readonly code: string | null

  constructor(message: string, options: { status?: number; code?: string } = {}) {
    super(message)
    this.name = 'LocalSyncError'
    this.status = options.status ?? null
    this.code = options.code ?? null
  }
}

const NETWORK_CODES = new Set([
  'EHOSTUNREACH',
  'EHOSTDOWN',
  'ENETUNREACH',
  'ENETDOWN',
  'ENETRESET',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ERR_SOCKET_TIMEOUT',
  'EPIPE',
  'ENOTFOUND',
  'EAI_AGAIN',
])

const NETWORK_MESSAGE_PATTERN =
  /\bEHOSTUNREACH\b|\bEHOSTDOWN\b|\bENETUNREACH\b|\bENETDOWN\b|\bENETRESET\b|\bECONNREFUSED\b|\bECONNRESET\b|\bETIMEDOUT\b|\bERR_SOCKET_TIMEOUT\b|\bEPIPE\b|\bENOTFOUND\b|\bEAI_AGAIN\b|\bsocket hang up\b/i

function readCode(error: unknown, depth = 0): string | null {
  if (!error || typeof error !== 'object' || depth > 2) return null
  const code = (error as { code?: unknown }).code
  if (typeof code === 'string' && code.length > 0) return code.toUpperCase()
  return readCode((error as { cause?: unknown }).cause, depth + 1)
}

function readMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return ''
}

/**
 * True when the failure means the peer is unreachable on the network (gone,
 * wrong Wi-Fi, blocked port). Callers use this to report `offline` instead of
 * `error` so a missing device does not look like a broken save.
 */
export function isNetworkUnreachable(error: unknown): boolean {
  const code = readCode(error)
  if (code && NETWORK_CODES.has(code)) return true
  return NETWORK_MESSAGE_PATTERN.test(readMessage(error))
}

const FRIENDLY_PREFIXES = [
  'The other device',
  'The document',
  'The merged',
  'A previous conflict',
  'Could not',
  'Unknown device',
  'Push failed',
  'Pull failed',
  'Sync failed',
  'Pairing',
  'The pairing',
  'Discovery',
  'No ',
]

function stripTechnical(message: string): string {
  return message
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?\b/g, '')
    .replace(/\[[0-9a-fA-F:.]+](?::\d{1,5})?/g, '')
    .replace(/lifespire:[^\s)'"`]*/gi, '')
    .replace(/^(Error:\s*|connect\s+)/i, '')
    .replace(/(^|\s):\d{1,5}\b/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim()
}

/**
 * User-facing sync failure text. Raw transport errors (Node errnos with
 * IPs/ports, IPC channel names) never reach the screen: network failures get
 * actionable guidance, already-friendly messages pass through, and anything
 * else is sanitized with `fallback` as the safety net. The raw error should
 * still go to the console/log for debugging.
 */
export function toUserSyncError(error: unknown, fallback: string): string {
  if (isNetworkUnreachable(error)) {
    return "Couldn't reach the other device. Make sure both apps are open on the same Wi-Fi."
  }
  const message = readMessage(error).trim()
  if (!message) return fallback
  if (FRIENDLY_PREFIXES.some((prefix) => message.startsWith(prefix))) return message
  const cleaned = stripTechnical(message)
  if (cleaned.length >= 8 && /[A-Za-z]{3,}/.test(cleaned)) return cleaned
  return fallback
}
