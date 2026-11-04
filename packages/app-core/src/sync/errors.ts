/**
 * Errors shared by the local (LAN) sync engine and the platform transports.
 *
 * The old cloud client had its own error classes in `@lifespire/api-client`.
 * Local sync keeps the same conflict shape so the conservative 3-way merge and
 * the conflict dialog could be ported without changing their semantics.
 */

import { looksTechnical, readErrorMessage, stripTechnical } from '../ui/userError'

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

/**
 * True when the failure means the peer is unreachable on the network (gone,
 * wrong Wi-Fi, blocked port). Callers use this to report `offline` instead of
 * `error` so a missing device does not look like a broken save.
 */
export function isNetworkUnreachable(error: unknown): boolean {
  const code = readCode(error)
  if (code && NETWORK_CODES.has(code)) return true
  return NETWORK_MESSAGE_PATTERN.test(readErrorMessage(error))
}

/** True for a pairing the peer no longer honours; retrying cannot fix it. */
export function isSyncAuthFailure(error: unknown): boolean {
  // 403 means "same local network only" in this protocol; it can heal when the
  // user changes networks, so it stays on the normal backoff path.
  return readStatus(error) === 401
}

export const SYNC_OFFLINE_COPY =
  "Couldn't reach the other device. Make sure both apps are open on the same Wi-Fi."
export const SYNC_PAIRING_REVOKED_COPY =
  'The other device no longer accepts this pairing. Forget it and pair both devices again.'

const FRIENDLY_PREFIXES = [
  'The other device',
  'The document',
  'The merged',
  'The paired-device',
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
  'That ',
  'Enter ',
  'Local ',
  'This ',
  'Too many',
  'Invalid',
  "Couldn't ",
  'Nearby ',
]

function readStatus(error: unknown, depth = 0): number | null {
  if (!error || typeof error !== 'object' || depth > 2) return null
  const status = (error as { status?: unknown }).status
  if (typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599) {
    return status
  }
  return readStatus((error as { cause?: unknown }).cause, depth + 1)
}

function statusCopy(status: number): string | null {
  if (status === 401) return SYNC_PAIRING_REVOKED_COPY
  if (status === 403) return 'The other device only accepts syncs from the same local network.'
  if (status === 404) return 'The other device has no save yet.'
  if (status === 409) return 'The other device changed at the same time. Try again.'
  if (status === 413) return 'This save is too large to send. Try exporting it instead.'
  if (status === 422) return 'The other device could not read this save.'
  if (status === 429) return 'Too many attempts. Wait a minute and try again.'
  if (status >= 500) return 'The other device ran into a problem. Try again.'
  return null
}

/**
 * Removes the wrappers added by Expo (`java.lang.X: …`, "Call to function …"),
 * Electron IPC (`Error invoking remote method …`) and plain `Error:` prefixes.
 */
function unwrapTransportMessage(raw: string): string {
  let text = raw.replace(/\r/g, '').trim()
  const native = /(?:[a-z][\w$]*\.)+[A-Z][\w$]*(?:Exception|Error):\s*([^\n]+)/.exec(text)
  if (native?.[1]) text = native[1].trim()
  text = text
    .replace(/^Call to function '[^']*' has been rejected\.?\s*/i, '')
    .replace(/^Error invoking remote method '[^']*':\s*/i, '')
    .replace(/^Error:\s*/i, '')
  const stop = text.search(/\n(?:Caused by:|\s+at\s)/)
  if (stop > 0) text = text.slice(0, stop)
  return text.trim()
}

/** Curated copy for the known server/native failures every client emits. */
function knownMessageCopy(raw: string): string | null {
  const text = raw.trim()
  const answered = /^The other device answered\s+(\d{3})\.?$/i.exec(text)
  if (answered) return statusCopy(Number(answered[1]))

  if (/^Discovery is unavailable/i.test(text)) {
    return 'Nearby discovery is unavailable on this network. You can still sync with a paired device using Sync now.'
  }
  if (/^Invalid request body/i.test(text)) {
    return 'The other device sent a request this app could not read.'
  }
  if (/^Invalid document payload/i.test(text)) {
    return 'The other device sent a save this app could not read.'
  }
  if (/^Could not store the incoming document/i.test(text)) {
    return 'Could not save the incoming change. Try again.'
  }
  if (/^Local sync server failed/i.test(text)) {
    return 'Nearby sync ran into a problem. Try again.'
  }
  if (/^Local peers only\.?$/i.test(text)) {
    return 'The other device only accepts syncs from the same local network.'
  }
  if (/^Pairing token required\.?$/i.test(text)) return SYNC_PAIRING_REVOKED_COPY
  if (/^Too many pairing attempts/i.test(text)) {
    return 'Too many pairing attempts. Wait a minute and try again.'
  }
  if (/^No save yet\.?$/i.test(text)) return 'The other device has no save yet.'
  if (/^Not found\.?$/i.test(text)) {
    return 'The other device could not find what this app asked for.'
  }
  if (/^The other device is still preparing its save/i.test(text)) {
    return 'The other device is still preparing its save. Try again in a moment.'
  }
  if (/^Document too large/i.test(text)) {
    return 'This save is too large to send. Try exporting it instead.'
  }
  if (/^The document is not valid JSON/i.test(text)) {
    return 'The other device could not read this save.'
  }
  if (/^Could not store the document/i.test(text)) {
    return 'Could not save the incoming change. Try again.'
  }
  if (/^Invalid pairing request/i.test(text)) {
    return 'The pairing request was not valid. Ask the other device for a new code.'
  }
  if (/^The pairing code is invalid or expired/i.test(text)) {
    return 'That pairing code is invalid or has expired. Ask the other device for a new one.'
  }
  return null
}

/**
 * User-facing sync failure text. Raw transport errors (Node errnos with
 * IPs/ports, IPC channel names, Java/Kotlin exception wrappers) never reach the
 * screen: network failures get actionable guidance, known server failures get
 * curated copy, already-friendly messages pass through, and anything else is
 * replaced with `fallback`. The raw error should still go to the console/log.
 */
export function toUserSyncError(error: unknown, fallback: string): string {
  const status = readStatus(error)
  if (status !== null) {
    const copy = statusCopy(status)
    if (copy) return copy
  }
  if (isNetworkUnreachable(error)) return SYNC_OFFLINE_COPY

  const raw = readErrorMessage(error).trim()
  if (!raw) return fallback

  const direct = knownMessageCopy(raw)
  if (direct) return direct

  const unwrapped = unwrapTransportMessage(raw)
  if (!unwrapped) return fallback

  const known = knownMessageCopy(unwrapped)
  if (known) return known

  const cleaned = stripTechnical(unwrapped)
  if (!cleaned || looksTechnical(cleaned)) return fallback
  if (/\b(?:answered|status|HTTP)\s+[1-5]\d{2}\b/i.test(cleaned)) return fallback
  if (!FRIENDLY_PREFIXES.some((prefix) => cleaned.startsWith(prefix))) return fallback
  return cleaned
}
