import path from 'node:path'

export const APP_SCHEME = 'lifespire-app'
export const APP_HOST = 'app'
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`

/**
 * Entry points emitted by vite-plugin-pwa. The desktop shell serves the build
 * from disk, so the worker is never registered; returning an empty script keeps
 * the browser from logging a failed registration on a custom scheme.
 */
export const PWA_SCRIPT_PATHS: ReadonlySet<string> = new Set(['/registerSW.js', '/sw.js'])

export interface NavigationPolicy {
  isPackaged: boolean
  devUrl: string
}

/** Absolute URL of a static asset served by the packaged shell. */
export function buildAppUrl(pathname = 'index.html'): string {
  return `${APP_ORIGIN}/${pathname.replace(/^\/+/, '')}`
}

/**
 * Maps an `lifespire-app://app/...` request to a file inside `rootDir`.
 * Returns `null` for foreign origins, malformed URLs and any path that would
 * escape the web build (encoded separators included).
 */
export function resolveAssetPath(rootDir: string, requestUrl: string): string | null {
  let url: URL
  try {
    url = new URL(requestUrl)
  } catch {
    return null
  }

  if (url.protocol !== `${APP_SCHEME}:` || url.host !== APP_HOST) return null

  let pathname: string
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    return null
  }

  const relative = pathname.replace(/^\/+/, '')
  const root = path.resolve(rootDir)
  const candidate = path.resolve(root, relative === '' ? 'index.html' : relative)
  const inside = path.relative(root, candidate)

  if (inside === '' || inside.startsWith('..') || path.isAbsolute(inside)) return null
  return candidate
}

/** True for in-app navigations, which are the only ones the shell allows. */
export function isInternalNavigation(targetUrl: string, policy: NavigationPolicy): boolean {
  let target: URL
  try {
    target = new URL(targetUrl)
  } catch {
    return false
  }

  if (target.protocol === `${APP_SCHEME}:`) return target.host === APP_HOST
  if (policy.isPackaged) return false

  try {
    return target.origin === new URL(policy.devUrl).origin
  } catch {
    return false
  }
}

/** True for links that must open in the user's browser, never in the shell. */
export function isExternalWebUrl(targetUrl: string): boolean {
  try {
    const protocol = new URL(targetUrl).protocol
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}
