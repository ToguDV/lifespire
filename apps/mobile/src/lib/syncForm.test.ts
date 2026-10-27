import { ApiRequestError } from '@lifespire/api-client'
import {
  accountLinkErrorMessage,
  loginProblem,
  validateAccountLink,
} from './syncForm'

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde'

describe('validateAccountLink', () => {
  it('accepts a raw 43-character token', () => {
    expect(validateAccountLink('reset', TOKEN, 'a-good-password-123')).toEqual({
      ok: true,
      token: TOKEN,
    })
    expect(validateAccountLink('invite', TOKEN, 'a-good-password-123')).toEqual({
      ok: true,
      token: TOKEN,
    })
  })

  it('extracts the token from the full link pasted by the user', () => {
    expect(
      validateAccountLink(
        'reset',
        `https://app.example.com/reset-password#token=${TOKEN}`,
        'a-good-password-123',
      ),
    ).toEqual({ ok: true, token: TOKEN })
    expect(
      validateAccountLink(
        'invite',
        `<https://app.example.com/accept-invite?token=${TOKEN}>`,
        'a-good-password-123',
      ),
    ).toEqual({ ok: true, token: TOKEN })
  })

  it('rejects a missing or malformed token with the form copy', () => {
    expect(validateAccountLink('invite', 'https://app.example.com/accept-invite', 'a-good-password-123')).toEqual({
      ok: false,
      error: 'Paste the full invite link or its 43-character token.',
    })
    expect(validateAccountLink('reset', 'too-short', 'a-good-password-123')).toEqual({
      ok: false,
      error: 'Paste the full reset link or its 43-character token.',
    })
  })

  it('matches the API password policy before submitting', () => {
    expect(validateAccountLink('reset', TOKEN, 'short1A!')).toEqual({
      ok: false,
      error: 'Use at least 12 characters.',
    })
    expect(validateAccountLink('invite', TOKEN, 'aaaaaaaaaaaa')).toEqual({
      ok: false,
      error: 'Use at least 5 different characters.',
    })
  })
})

describe('loginProblem', () => {
  it('requires both fields', () => {
    expect(loginProblem('', 'secret')).toBe('Enter your email and password.')
    expect(loginProblem('you@example.com', '')).toBe('Enter your email and password.')
    expect(loginProblem('you@example.com', 'secret')).toBeNull()
  })
})

describe('accountLinkErrorMessage', () => {
  it('turns reset failures into actionable copy', () => {
    expect(accountLinkErrorMessage(new ApiRequestError(400, 'x', 'RESET_INVALID'), 'reset')).toMatch(
      /not valid on this server/,
    )
    expect(accountLinkErrorMessage(new ApiRequestError(400, 'x', 'RESET_EXPIRED'), 'reset')).toMatch(
      /expired/,
    )
    expect(accountLinkErrorMessage(new ApiRequestError(400, 'x', 'RESET_USED'), 'reset')).toMatch(
      /already used/,
    )
  })

  it('turns invite failures into actionable copy', () => {
    expect(accountLinkErrorMessage(new ApiRequestError(400, 'x', 'INVITE_INVALID'), 'invite')).toMatch(
      /not valid on this server/,
    )
    expect(accountLinkErrorMessage(new ApiRequestError(400, 'x', 'INVITE_EXPIRED'), 'invite')).toMatch(
      /expired/,
    )
    expect(accountLinkErrorMessage(new ApiRequestError(400, 'x', 'INVITE_USED'), 'invite')).toMatch(
      /already used/,
    )
  })

  it('keeps the server password message and rate-limit copy', () => {
    expect(
      accountLinkErrorMessage(
        new ApiRequestError(400, 'Use at least 12 characters.', 'VALIDATION_FAILED'),
        'reset',
      ),
    ).toBe('Use at least 12 characters.')
    expect(accountLinkErrorMessage(new ApiRequestError(429, 'x', 'RATE_LIMITED'), 'invite')).toMatch(
      /Wait a minute/,
    )
  })

  it('falls back to the error message and then to generic copy', () => {
    expect(accountLinkErrorMessage(new Error('Server unreachable.'), 'invite')).toBe(
      'Server unreachable.',
    )
    expect(accountLinkErrorMessage(undefined, 'reset')).toBe(
      'The password could not be updated.',
    )
    expect(accountLinkErrorMessage(undefined, 'invite')).toBe(
      'The invite could not be accepted.',
    )
  })
})
