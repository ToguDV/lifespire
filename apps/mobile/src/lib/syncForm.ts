import { ApiRequestError } from '@lifespire/api-client'
import { extractAuthToken, isAuthToken } from '@lifespire/app-core/sync/authLink'
import { newPasswordProblem } from '@lifespire/app-core/sync/password'

export type AccountLinkKind = 'invite' | 'reset'

export type AccountLinkValidation = { ok: true; token: string } | { ok: false; error: string }

const LINK_NOUN: Record<AccountLinkKind, string> = {
  invite: 'invite',
  reset: 'reset',
}

/**
 * Validates the manual invite/reset forms before the request leaves the
 * device: the shared extractor accepts a raw token, a fragment link or a query
 * link, and the password policy mirrors the API so a known failure never waits
 * for the network.
 */
export function validateAccountLink(
  kind: AccountLinkKind,
  rawToken: string,
  password: string,
): AccountLinkValidation {
  const token = extractAuthToken(rawToken)
  if (!isAuthToken(token)) {
    return {
      ok: false,
      error: `Paste the full ${LINK_NOUN[kind]} link or its 43-character token.`,
    }
  }
  const passwordIssue = newPasswordProblem(password)
  if (passwordIssue) return { ok: false, error: passwordIssue }
  return { ok: true, token }
}

/** Mirrors the web login form's local check; the API stays authoritative. */
export function loginProblem(email: string, password: string): string | null {
  if (!email.trim() || !password) return 'Enter your email and password.'
  return null
}

/**
 * Actionable copy for account-link failures, mirroring the web
 * `authErrorMessage` so both clients explain the same server codes.
 */
export function accountLinkErrorMessage(error: unknown, kind: AccountLinkKind): string {
  if (error instanceof ApiRequestError) {
    switch (error.code) {
      case 'RESET_INVALID':
        return 'This reset link is not valid on this server. Generate a new link from the same server.'
      case 'RESET_EXPIRED':
        return 'This reset link expired. Ask your admin for a new one.'
      case 'RESET_USED':
        return 'This reset link was already used. If you just set the password, sign in with it.'
      case 'INVITE_INVALID':
        return 'This invite link is not valid on this server. Ask your admin for a new one.'
      case 'INVITE_EXPIRED':
        return 'This invite expired. Ask your admin for a new one.'
      case 'INVITE_USED':
        return 'This invite was already used. Sign in with your password.'
      case 'RATE_LIMITED':
        return 'Too many attempts. Wait a minute and try again.'
      case 'VALIDATION_FAILED':
        return error.message && error.message !== 'Request failed'
          ? error.message
          : 'The link or password is not valid. Paste the full link and use at least 12 characters.'
      default:
        break
    }
  }
  if (error instanceof Error && error.message) return error.message
  return kind === 'reset'
    ? 'The password could not be updated.'
    : 'The invite could not be accepted.'
}
