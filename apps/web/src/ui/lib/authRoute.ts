import { extractAuthToken, isAuthToken } from '@lifespire/app-core/sync/authLink'

export type AuthRouteKind = 'reset' | 'invite'

export interface AuthRoute {
  kind: AuthRouteKind
  /** Null when the link is missing a well-formed token; the screen asks for it. */
  token: string | null
}

/**
 * Reads the account-link route from the SPA URL. Reset and invite links keep
 * the one-time token in the fragment (`#token=…`), so it never reaches the
 * document request. Query links are accepted as a fallback.
 */
export function parseAuthRoute(
  pathname: string,
  hash: string,
  search: string,
): AuthRoute | null {
  const path = pathname.replace(/\/+$/, '').toLowerCase()
  const kind: AuthRouteKind | null =
    path === '/reset-password' ? 'reset' : path === '/accept-invite' ? 'invite' : null
  if (!kind) return null

  const token = extractAuthToken(`https://app.local${path}${search}${hash}`)
  return { kind, token: isAuthToken(token) ? token : null }
}
