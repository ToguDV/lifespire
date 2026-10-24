import { describe, expect, it, vi } from 'vitest'
import { checkServerHealth, normalizeBaseUrl, resolveSyncBaseUrl, validateServerUrl } from './api'

describe('sync base URL', () => {
  it('normalizes user input to the origin', () => {
    expect(normalizeBaseUrl('https://sync.example.com/')).toBe('https://sync.example.com')
    expect(normalizeBaseUrl('  http://localhost:3000/v1  ')).toBeNull()
    expect(normalizeBaseUrl('notaurl')).toBeNull()
    expect(normalizeBaseUrl('ftp://files.example.com')).toBeNull()
    expect(normalizeBaseUrl('')).toBeNull()
  })

  it('prefers the stored override over the build default', () => {
    expect(resolveSyncBaseUrl('https://build.example.com', 'https://custom.example.com/')).toBe(
      'https://custom.example.com',
    )
    expect(resolveSyncBaseUrl('https://build.example.com', null)).toBe(
      'https://build.example.com',
    )
    expect(resolveSyncBaseUrl(undefined, null)).toBe('')
  })

  it('ignores a corrupt stored value', () => {
    expect(resolveSyncBaseUrl('https://build.example.com', 'notaurl')).toBe(
      'https://build.example.com',
    )
  })
})

describe('validateServerUrl', () => {
  it('accepts clean origins, localhost and LAN hosts', () => {
    expect(validateServerUrl('https://sync.example.com')).toEqual({
      ok: true,
      normalized: 'https://sync.example.com',
    })
    const withSlash = validateServerUrl('https://sync.example.com/')
    expect(withSlash.ok).toBe(true)
    if (withSlash.ok) expect(withSlash.normalized).toBe('https://sync.example.com')
    expect(validateServerUrl('http://localhost:3000').ok).toBe(true)
    expect(validateServerUrl('http://127.0.0.1:3000').ok).toBe(true)
    expect(validateServerUrl('http://192.168.1.10:3000').ok).toBe(true)
    expect(validateServerUrl('http://[::1]:3000').ok).toBe(true)
  })

  it('adds https when the scheme is missing', () => {
    const out = validateServerUrl('sync.example.com')
    expect(out.ok).toBe(true)
    if (out.ok) expect(out.normalized).toBe('https://sync.example.com')
  })

  it('rejects single-label hosts and malformed names', () => {
    for (const raw of [
      'notaurl',
      'https://foo',
      'https://under_score.example.com',
      'https://-bad.example.com',
      'https://example.123',
      'https://999.999.999.999',
    ]) {
      const out = validateServerUrl(raw)
      expect(out.ok, raw).toBe(false)
    }
  })

  it('rejects credentials, queries, fragments and paths', () => {
    for (const raw of [
      'https://user:pass@sync.example.com',
      'https://sync.example.com?v=1',
      'https://sync.example.com#top',
      'https://sync.example.com/v1/sync',
      'https://sync.example.com:0',
    ]) {
      const out = validateServerUrl(raw)
      expect(out.ok, raw).toBe(false)
    }
  })

  it('rejects non-http schemes and empty input', () => {
    expect(validateServerUrl('').ok).toBe(false)
    expect(validateServerUrl('   ').ok).toBe(false)
    expect(validateServerUrl('ftp://files.example.com').ok).toBe(false)
    expect(validateServerUrl('ws://sync.example.com').ok).toBe(false)
  })

  it('explains the problem in the error message', () => {
    const out = validateServerUrl('notaurl')
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.length).toBeGreaterThan(10)
  })
})

describe('checkServerHealth', () => {
  it('resolves true when /health/live answers ok', async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({ status: 'ok' }, { status: 200 }),
    ) as unknown as typeof fetch
    await expect(checkServerHealth('https://sync.example.com', fetchFn)).resolves.toBe(true)
    expect(fetchFn).toHaveBeenCalledWith(
      'https://sync.example.com/health/live',
      expect.objectContaining({ signal: expect.anything() as unknown }),
    )
  })

  it('throws when the server is not a LifeSpire server', async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({ status: 'nope' }, { status: 200 }),
    ) as unknown as typeof fetch
    await expect(checkServerHealth('https://sync.example.com', fetchFn)).rejects.toThrow()
  })

  it('throws on network failures', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    await expect(checkServerHealth('https://sync.example.com', fetchFn)).rejects.toThrow()
  })
})
