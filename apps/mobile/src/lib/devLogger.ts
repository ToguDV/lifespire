/**
 * Development-only diagnostics for the Android app.
 *
 * In production every helper is a no-op. In development it:
 * - prefixes messages with the module scope,
 * - captures unhandled JS errors and promise rejections,
 * - redacts sensitive keys from context before printing.
 *
 * It never logs the save document, tokens, passwords or cookies.
 */

export type DevScope =
  | 'app'
  | 'bootstrap'
  | 'navigation'
  | 'sync'
  | 'auth'
  | 'notifications'
  | 'storage'
  | 'files'
  | 'feedback'

const PREFIX = '[LifeSpire]'
const IS_DEV = typeof __DEV__ === 'undefined' ? false : __DEV__
const REDACTED = '[redacted]'
const SENSITIVE_KEY = /token|password|secret|authorization|cookie|document|save/i
const MAX_TEXT = 500

/** Test hook: the installed flag is module-scoped in the app. */
let installed = false

function normalize(value: unknown): string {
  if (value instanceof Error) return value.stack ?? `${value.name}: ${value.message}`
  if (typeof value === 'string') return value
  if (value === undefined) return ''
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function truncate(value: string): string {
  return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}…` : value
}

function scrubValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (typeof value === 'string') return truncate(value)
  if (value === null || typeof value !== 'object') return value
  if (depth >= 4) return '[depth-limit]'
  if (seen.has(value)) return '[circular]'
  seen.add(value)
  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, depth + 1, seen))
  }
  const safe: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    safe[key] = SENSITIVE_KEY.test(key) ? REDACTED : scrubValue(entry, depth + 1, seen)
  }
  return safe
}

/**
 * Copies a context object recursively, replacing sensitive keys and
 * truncating long strings. Never mutates the caller's object.
 */
export function sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
  return scrubValue(context, 0, new WeakSet()) as Record<string, unknown>
}

function write(
  channel: 'error' | 'warn',
  scope: DevScope,
  message: string,
  error?: unknown,
  context?: Record<string, unknown>,
): void {
  if (!IS_DEV) return
  const args: unknown[] = [`${PREFIX}[${scope}] ${message}`]
  if (context) args.push(sanitizeContext(context))
  if (error !== undefined) args.push(truncate(normalize(error)))
  console[channel](...args)
}

/** Logs a recoverable failure only in development. */
export function devWarn(
  scope: DevScope,
  message: string,
  error?: unknown,
  context?: Record<string, unknown>,
): void {
  write('warn', scope, message, error, context)
}

/** Logs a failure that deserves a stack trace only in development. */
export function devError(
  scope: DevScope,
  message: string,
  error?: unknown,
  context?: Record<string, unknown>,
): void {
  write('error', scope, message, error, context)
}

interface ErrorUtilsLike {
  getGlobalHandler?: () => (error: Error, isFatal?: boolean) => void
  setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void
}

interface RejectionEventLike {
  reason?: unknown
}

/**
 * Installs the global handlers once. Call it from the app entry point before
 * rendering; React Native's ErrorUtils handler already feeds LogBox, so the
 * previous handler is always invoked.
 */
export function installDevLogging(): void {
  if (!IS_DEV || installed) return
  installed = true

  const target = globalThis as typeof globalThis & {
    ErrorUtils?: ErrorUtilsLike
    addEventListener?: (type: string, listener: (event: RejectionEventLike) => void) => void
  }

  const errorUtils = target.ErrorUtils
  if (errorUtils?.setGlobalHandler) {
    const previous = errorUtils.getGlobalHandler?.()
    errorUtils.setGlobalHandler((error, isFatal) => {
      devError('app', isFatal ? 'Unhandled fatal JS error' : 'Unhandled JS error', error)
      previous?.(error, isFatal)
    })
  }

  if (typeof target.addEventListener === 'function') {
    target.addEventListener('unhandledrejection', (event) => {
      devError('app', 'Unhandled promise rejection', event.reason ?? event)
    })
  }

  console.info(`${PREFIX} development logger installed (console + React Native DevTools)`)
}
