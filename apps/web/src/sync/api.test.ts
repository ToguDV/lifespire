import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkServerHealth,
  engineApi,
  getDesktopSessionState,
  getSyncFetch,
  normalizeBaseUrl,
  refreshSyncApi,
  resolveSyncBaseUrl,
  validateServerUrl,
} from './api'
import { SYNC_BASE_URL_KEY } from './storageKeys'

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

describe('refreshSyncApi', () => {
  const realFetch = globalThis.fetch
  const backing = new Map<string, string>()

  beforeEach(() => {
    backing.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => {
        backing.set(key, String(value))
      },
      removeItem: (key: string) => {
        backing.delete(key)
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    globalThis.fetch = realFetch
    refreshSyncApi()
  })

  it('repoints the client and the engine at the stored server', async () => {
    const calls: string[] = []
    globalThis.fetch = (async (input: unknown) => {
      calls.push(String(input))
      return Response.json({ title: 'No cloud save' }, { status: 404 })
    }) as unknown as typeof fetch
    backing.set(SYNC_BASE_URL_KEY, 'https://custom.example.com')

    const client = refreshSyncApi()
    await expect(client.getSync()).resolves.toBeNull()
    await expect(engineApi.getSync()).resolves.toBeNull()
    expect(calls).toEqual([
      'https://custom.example.com/v1/sync',
      'https://custom.example.com/v1/sync',
    ])
  })
})

describe('desktop bridge', () => {
  const realFetch = globalThis.fetch
  const backing = new Map<string, string>()

  interface Recorded {
    path: string
    method: string
    headers?: Record<string, string>
    body?: string
    origin?: string
  }

  let requests: Recorded[]
  let setServerCalls: Array<string | null>
  let signOutCalls: number
  let reply: { status: number; body: string; headers?: Record<string, string> }

  function state(persistence: 'encrypted' | 'memory-only' = 'encrypted') {
    return { persistence, signedIn: false, serverOrigin: null }
  }

  beforeEach(() => {
    backing.clear()
    requests = []
    setServerCalls = []
    signOutCalls = 0
    reply = { status: 200, body: '{}' }
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => {
        backing.set(key, String(value))
      },
      removeItem: (key: string) => {
        backing.delete(key)
      },
    })
    vi.stubGlobal('window', {
      lifespireDesktop: {
        isDesktop: true,
        api: {
          request: async (request: Recorded) => {
            requests.push(request)
            return {
              ok: true,
              response: {
                status: reply.status,
                statusText: '',
                headers: reply.headers ?? { 'content-type': 'application/json' },
                body: reply.body,
              },
            }
          },
        },
        sync: {
          setServer: async (origin: string | null) => {
            setServerCalls.push(origin)
            return state()
          },
        },
        auth: {
          sessionState: async () => state('memory-only'),
          signOut: async () => {
            signOutCalls += 1
            return state()
          },
        },
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    globalThis.fetch = realFetch
    refreshSyncApi()
  })

  it('fails /v1 requests with a clear error when no server is configured', async () => {
    refreshSyncApi()
    const fetchFn = getSyncFetch()
    await expect(fetchFn('/v1/sync')).rejects.toThrow(/choose a sync server/i)
    expect(requests).toHaveLength(0)
  })

  it('routes the client through the bridge instead of renderer fetch', async () => {
    const globalFetch = vi.fn(async () => {
      throw new Error('the renderer must not fetch the API directly')
    })
    globalThis.fetch = globalFetch as unknown as typeof fetch
    backing.set(SYNC_BASE_URL_KEY, 'https://custom.example.com')
    reply = {
      status: 200,
      body: JSON.stringify({
        version: '3',
        schemaVersion: 3,
        document: {},
        updatedAt: '2026-10-24T00:00:00.000Z',
      }),
    }

    const client = refreshSyncApi()
    const snapshot = await client.getSync()

    expect(snapshot?.version).toBe('3')
    expect(requests[0]).toMatchObject({ path: '/v1/sync', method: 'GET' })
    expect(setServerCalls).toContain('https://custom.example.com')
    expect(globalFetch).not.toHaveBeenCalled()
  })

  it('clears the main-process credential on sign-out', async () => {
    backing.set(SYNC_BASE_URL_KEY, 'https://custom.example.com')
    reply = { status: 204, body: '' }
    const client = refreshSyncApi()
    await client.logout()
    expect(requests[0]).toMatchObject({ path: '/v1/auth/logout', method: 'POST' })
    expect(signOutCalls).toBe(1)
  })

  it('uses the same bridge for a health check against a candidate origin', async () => {
    reply = { status: 200, body: JSON.stringify({ status: 'ok' }) }
    await expect(
      checkServerHealth('https://new.example.com', getSyncFetch()),
    ).resolves.toBe(true)
    expect(requests[0]).toMatchObject({
      path: '/health/live',
      method: 'GET',
      origin: 'https://new.example.com',
    })
  })

  it('exposes the session persistence state to the UI', async () => {
    await expect(getDesktopSessionState()).resolves.toMatchObject({
      persistence: 'memory-only',
    })
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
