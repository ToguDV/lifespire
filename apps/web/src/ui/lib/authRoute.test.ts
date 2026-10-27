import { describe, expect, it } from 'vitest'
import { parseAuthRoute } from './authRoute'

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde'

describe('parseAuthRoute', () => {
  it('recognizes the reset and invite paths', () => {
    expect(parseAuthRoute('/reset-password', `#token=${TOKEN}`, '')).toEqual({
      kind: 'reset',
      token: TOKEN,
    })
    expect(parseAuthRoute('/accept-invite', `#token=${TOKEN}`, '')).toEqual({
      kind: 'invite',
      token: TOKEN,
    })
  })

  it('tolerates trailing slashes and works without a token', () => {
    expect(parseAuthRoute('/reset-password/', '', '')).toEqual({
      kind: 'reset',
      token: null,
    })
  })

  it('accepts a token in the query string', () => {
    expect(parseAuthRoute('/accept-invite', '', `?token=${TOKEN}`)).toEqual({
      kind: 'invite',
      token: TOKEN,
    })
  })

  it('rejects unknown paths and malformed tokens', () => {
    expect(parseAuthRoute('/', `#token=${TOKEN}`, '')).toBeNull()
    expect(parseAuthRoute('/settings', `#token=${TOKEN}`, '')).toBeNull()
    expect(parseAuthRoute('/reset-password', '#token=too-short', '')).toEqual({
      kind: 'reset',
      token: null,
    })
  })
})
