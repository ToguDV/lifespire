import { ApiRequestError } from '@lifespire/api-client'
import type { AuthRouteKind } from './authRoute'

/** Actionable copy for account-link failures, shared by both reset surfaces. */
export function authErrorMessage(error: unknown, kind: AuthRouteKind): string {
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
        // The API uses this code for the password policy too, with a specific
        // title; only the generic pipe failure needs the fallback copy.
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
