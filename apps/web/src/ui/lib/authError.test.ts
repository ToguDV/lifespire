import { ApiRequestError } from '@lifespire/api-client'
import { describe, expect, it } from 'vitest'
import { authErrorMessage } from './authError'

describe('authErrorMessage', () => {
  it('turns reset codes into reusable guidance', () => {
    expect(authErrorMessage(new ApiRequestError(400, 'Invalid reset link', 'RESET_INVALID'), 'reset')).toMatch(
      /same server/,
    )
    expect(authErrorMessage(new ApiRequestError(400, 'Reset link expired', 'RESET_EXPIRED'), 'reset')).toMatch(
      /new one/,
    )
    expect(authErrorMessage(new ApiRequestError(400, 'Reset link already used', 'RESET_USED'), 'reset')).toMatch(
      /sign in/,
    )
  })

  it('keeps invite and rate-limit guidance distinct', () => {
    expect(
      authErrorMessage(new ApiRequestError(400, 'Invalid invitation', 'INVITE_INVALID'), 'invite'),
    ).toMatch(/admin/)
    expect(
      authErrorMessage(new ApiRequestError(429, 'Too many requests', 'RATE_LIMITED'), 'reset'),
    ).toMatch(/Wait a minute/)
  })

  it('falls back to the error message or a kind-specific sentence', () => {
    expect(authErrorMessage(new Error('Network down'), 'reset')).toBe('Network down')
    expect(authErrorMessage(null, 'invite')).toMatch(/invite/)
  })
})
