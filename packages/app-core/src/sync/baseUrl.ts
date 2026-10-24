/** Server URL validation and health checks shared by web and native clients. */

export type ServerUrlValidation =
  | { ok: true; normalized: string }
  | { ok: false; error: string }

function isLoopbackHost(host: string): boolean {
  const clean = host.toLowerCase().replace(/^\[/, '').replace(/\]$/, '')
  return clean === 'localhost' || clean === '127.0.0.1' || clean === '::1'
}

function isValidIpv4(host: string): boolean {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false
  return host.split('.').every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false
    const num = Number(part)
    return num >= 0 && num <= 255
  })
}

/** Hostname rules: localhost, IP, or a dotted domain with valid labels. */
function isValidHostname(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (!host) return false
  if (isLoopbackHost(host)) return true
  if (host.includes(':')) return true // IPv6 already syntax-checked by URL.
  if (isValidIpv4(host)) return true
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false // Malformed IPv4.
  if (host.length > 253) return false
  if (!host.includes('.')) return false
  if (host.includes('_') || host.includes(' ') || host.includes('!')) return false
  const labels = host.split('.')
  const labelPattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/
  for (const label of labels) {
    if (label.length < 1 || label.length > 63) return false
    if (!labelPattern.test(label)) return false
  }
  const tld = labels[labels.length - 1] ?? ''
  if (/^\d+$/.test(tld)) return false
  return true
}

const ORIGIN_EXAMPLE = 'https://sync.example.com'

/** Strict validation with a specific, actionable error per failure. */
export function validateServerUrl(raw: string): ServerUrlValidation {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, error: `Enter a server URL, e.g. ${ORIGIN_EXAMPLE}.` }
  if (trimmed.length > 2000) {
    return { ok: false, error: 'That URL is too long — paste just the server origin.' }
  }
  const candidate = trimmed.includes('://') ? trimmed : `https://${trimmed}`
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return { ok: false, error: `Enter a valid server URL, e.g. ${ORIGIN_EXAMPLE}.` }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return {
      ok: false,
      error: `Use a URL starting with http:// or https:// (e.g. ${ORIGIN_EXAMPLE}).`,
    }
  }
  if (url.username || url.password) {
    return {
      ok: false,
      error: `Remove user info from the URL — use just the origin, e.g. ${ORIGIN_EXAMPLE}.`,
    }
  }
  if (!isValidHostname(url.hostname)) {
    return {
      ok: false,
      error: 'Use a valid domain (e.g. sync.example.com), localhost, or an IP address.',
    }
  }
  if (url.port) {
    const port = Number(url.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return { ok: false, error: 'That port looks wrong — use 1–65535, e.g. http://localhost:3000.' }
    }
  }
  if (url.search && url.search !== '?') {
    return {
      ok: false,
      error: `Remove ?query and #fragment — use just the origin, e.g. ${ORIGIN_EXAMPLE}.`,
    }
  }
  if (url.hash) {
    return {
      ok: false,
      error: `Remove ?query and #fragment — use just the origin, e.g. ${ORIGIN_EXAMPLE}.`,
    }
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    return {
      ok: false,
      error: `Use just the server origin (e.g. ${ORIGIN_EXAMPLE}) — paths are ignored.`,
    }
  }
  return { ok: true, normalized: url.origin }
}

/** Verifies the URL actually serves a LifeSpire API before it is saved. */
export async function checkServerHealth(
  origin: string,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 6000,
): Promise<true> {
  const base = origin.replace(/\/+$/, '')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchFn(`${base}/health/live`, { signal: controller.signal })
    if (!res.ok) {
      throw new Error(
        `No LifeSpire server found there (HTTP ${res.status}). Check the URL and try again.`,
      )
    }
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      body = null
    }
    if (!body || typeof body !== 'object' || (body as { status?: unknown }).status !== 'ok') {
      throw new Error(
        'No LifeSpire server found there — /health/live did not answer ok. Check the URL and try again.',
      )
    }
    return true
  } catch (error) {
    if (error instanceof Error && /LifeSpire|HTTP \d+/.test(error.message)) throw error
    throw new Error(
      "Couldn't reach a LifeSpire server at that URL. Check the address and your connection, then try again.",
    )
  } finally {
    clearTimeout(timer)
  }
}

/** Normalizes a user-supplied server URL to its origin, or null if invalid. */
export function normalizeBaseUrl(raw: string): string | null {
  const out = validateServerUrl(raw)
  return out.ok ? out.normalized : null
}

/** Stored override wins over the build default; empty string means same-origin. */
export function resolveSyncBaseUrl(
  envValue: string | undefined,
  storedValue: string | null,
): string {
  const stored = storedValue ? normalizeBaseUrl(storedValue) : null
  if (stored) return stored
  if (typeof envValue === 'string' && envValue.length > 0) return envValue.replace(/\/$/, '')
  return ''
}
