/**
 * User-facing failure text for non-sync flows (store toasts, file dialogs).
 * Anything that looks like engine output falls back; curated copy passes
 * through. Raw text still belongs in the console/log for debugging.
 */

const TECHNICAL_PATTERN =
  /\berrors?\b|Exception|NotAllowed|QuotaExceeded|SecurityError|AbortError|Cannot read|Cannot set|is not a function|is not defined|undefined is not|null is not|Unexpected token|Unexpected end|failed to fetch|Load failed|Failed to execute|exceeded the quota|Permission denied|file:\/\/|content:\/\/|\/data\/|\/storage\/|\.(js|ts|tsx|jsx|json|java|kt)(:\d+)?\b|\b\d{1,3}(\.\d{1,3}){3}|lifespire:|^connect |"[^"]*[\d_./\\-]+[^"]*"|^\s*at\s+\S+\s*\(/im

/** Errno-style codes are uppercase by convention; matched case-sensitively so normal words never hit. */
const ERRNO_PATTERN = /\bE[A-Z]{2,}\b/

const MAX_MESSAGE_LENGTH = 180

export function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return ''
}

/** True when the text reads like engine output instead of guidance. */
export function looksTechnical(message: string): boolean {
  return TECHNICAL_PATTERN.test(message) || ERRNO_PATTERN.test(message)
}

/**
 * Display-safe failure text. Curated short messages pass through; anything
 * else resolves to the caller-provided fallback.
 */
export function toUserMessage(error: unknown, fallback: string): string {
  const message = readErrorMessage(error).trim()
  if (!message || message.length > MAX_MESSAGE_LENGTH) return fallback
  if (looksTechnical(message)) return fallback
  return message
}

/** Strips addresses, IPC channels and connect prefixes from a raw message. */
export function stripTechnical(message: string): string {
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
