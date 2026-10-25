import { describe, expect, it } from 'vitest'
import {
  API_PROXY_MAX_BODY_BYTES,
  API_PROXY_MAX_RESPONSE_BYTES,
  createApiProxy,
  createTokenVault,
  isTrustedSender,
  normalizeProxyOrigin,
  sanitizeProxyRequest,
  stripFetchMetadata,
} from './apiProxy'

const SERVER = 'https://sync.example.com'
const OTHER_SERVER = 'https://other.example.com'

function memoryFile() {
  let value: string | null = null
  return {
    read: () => value,
    write: (next: string) => {
      value = next
    },
    remove: () => {
      value = null
    },
    snapshot: () => value,
  }
}

function makeVault(options: { available?: boolean; plaintext?: boolean } = {}) {
  const file = memoryFile()
  const vault = createTokenVault({
    file,
    crypto: {
      isEncryptionAvailable: () => options.available ?? true,
      usesPlainTextBackend: () => options.plaintext ?? false,
      encryptString: (value) => Buffer.from(`enc:${value}`, 'utf8'),
      decryptString: (buffer) => buffer.toString('utf8').replace(/^enc:/, ''),
    },
  })
  return { vault, file }
}

interface Call {
  url: string
  init: RequestInit
}

function makeProxy(
  handler: (url: string, init: RequestInit) => Promise<Response>,
  options: {
    available?: boolean
    plaintext?: boolean
    timeoutMs?: number
    healthTimeoutMs?: number
  } = {},
) {
  const calls: Call[] = []
  const { vault, file } = makeVault(options)
  const proxy = createApiProxy({
    vault,
    timeoutMs: options.timeoutMs,
    healthTimeoutMs: options.healthTimeoutMs,
    fetch: (async (input: unknown, init?: RequestInit) => {
      calls.push({ url: String(input), init: init ?? {} })
      return handler(String(input), init ?? {})
    }) as typeof fetch,
  })
  return { proxy, calls, vault, file }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', etag: '"3"' },
  })
}

function loginBody(refreshToken = 'refresh-1') {
  return {
    accessToken: 'access-1',
    refreshToken,
    user: { id: 'u1', email: 'a@b.c', role: 'USER', status: 'ACTIVE' },
    totpSetupRequired: false,
  }
}

function requestHeaders(init: RequestInit): Record<string, string> {
  return (init.headers as Record<string, string>) ?? {}
}

describe('normalizeProxyOrigin', () => {
  it('keeps canonical http(s) origins', () => {
    expect(normalizeProxyOrigin('https://sync.example.com')).toBe('https://sync.example.com')
    expect(normalizeProxyOrigin('https://sync.example.com:443')).toBe('https://sync.example.com')
    expect(normalizeProxyOrigin('http://localhost:3000')).toBe('http://localhost:3000')
  })

  it('allows private LAN ranges for self-hosting', () => {
    expect(normalizeProxyOrigin('http://192.168.1.10:3000')).toBe('http://192.168.1.10:3000')
    expect(normalizeProxyOrigin('http://10.0.0.2')).toBe('http://10.0.0.2')
    expect(normalizeProxyOrigin('http://[fd00::1]:3000')).toBe('http://[fd00::1]:3000')
  })

  it('always blocks link-local and cloud metadata addresses', () => {
    expect(normalizeProxyOrigin('http://169.254.169.254')).toBeNull()
    expect(normalizeProxyOrigin('http://169.254.1.1:3000')).toBeNull()
    expect(normalizeProxyOrigin('http://[fd00:ec2::254]')).toBeNull()
    expect(normalizeProxyOrigin('http://[fd00:ec2::254]:8080')).toBeNull()
  })
})

describe('sanitizeProxyRequest', () => {
  it('accepts API paths and drops headers outside the allowlist', () => {
    const request = sanitizeProxyRequest({
      path: '/v1/sync?limit=20',
      method: 'get',
      headers: {
        Authorization: 'Bearer access',
        'If-Match': '"3"',
        'Idempotency-Key': 'key-1',
        Cookie: '__Secure-ls_rt=secret',
        'X-Custom': 'nope',
      },
    })
    expect(request).toEqual({
      path: '/v1/sync?limit=20',
      method: 'GET',
      headers: {
        authorization: 'Bearer access',
        'if-match': '"3"',
        'idempotency-key': 'key-1',
      },
    })
  })

  it('accepts the health probe', () => {
    expect(sanitizeProxyRequest({ path: '/health/live', method: 'GET' }).path).toBe(
      '/health/live',
    )
  })

  it('rejects absolute URLs, protocol-relative paths and traversal', () => {
    for (const path of [
      'https://evil.example.com/v1/sync',
      '//evil.example.com/v1/sync',
      '/v1/../auth/login',
      '/v1/%2e%2e/auth/login',
      '/v1/%2Fetc',
      '/health/ready',
      '/v2/sync',
      '/v1',
      'v1/sync',
    ]) {
      expect(() => sanitizeProxyRequest({ path, method: 'GET' }), path).toThrow()
    }
  })

  it('rejects methods outside the allowlist', () => {
    expect(() => sanitizeProxyRequest({ path: '/v1/sync', method: 'TRACE' })).toThrow()
    expect(() => sanitizeProxyRequest({ path: '/v1/sync', method: 'OPTIONS' })).toThrow()
  })

  it('rejects a body over 2 MB and allows the exact limit', () => {
    const exact = 'a'.repeat(API_PROXY_MAX_BODY_BYTES)
    expect(
      sanitizeProxyRequest({
        path: '/v1/sync',
        method: 'PUT',
        body: exact,
        headers: { 'content-type': 'application/json' },
      }).body,
    ).toHaveLength(API_PROXY_MAX_BODY_BYTES)

    expect(() =>
      sanitizeProxyRequest({ path: '/v1/sync', method: 'PUT', body: `${exact}a` }),
    ).toThrow()
  })

  it('rejects non-string bodies and header values', () => {
    expect(() =>
      sanitizeProxyRequest({ path: '/v1/sync', method: 'PUT', body: { a: 1 } }),
    ).toThrow()
    expect(() =>
      sanitizeProxyRequest({
        path: '/v1/sync',
        method: 'GET',
        headers: { Authorization: 42 },
      }),
    ).toThrow()
  })

  it('rejects bodies on bodyless methods', () => {
    expect(() =>
      sanitizeProxyRequest({ path: '/v1/sync', method: 'GET', body: '{}' }),
    ).toThrow()
  })
})

describe('createApiProxy requests', () => {
  it('refuses /v1 calls before a server is configured', async () => {
    const { proxy, calls } = makeProxy(async () => json({}))
    const result = await proxy.request({ path: '/v1/sync', method: 'GET' })
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'SYNC_NOT_CONFIGURED' },
    })
    expect(calls).toHaveLength(0)
  })

  it('calls the configured origin with a hard timeout and no redirects', async () => {
    const { proxy, calls } = makeProxy(async () => json({ version: '3' }))
    proxy.setServer(SERVER)
    const result = await proxy.request({
      path: '/v1/sync?limit=20',
      method: 'GET',
      headers: { 'if-none-match': '"2"' },
    })
    expect(result.ok).toBe(true)
    expect(calls[0]?.url).toBe(`${SERVER}/v1/sync?limit=20`)
    expect(calls[0]?.init.redirect).toBe('error')
    expect(calls[0]?.init.signal).toBeInstanceOf(AbortSignal)
    expect(requestHeaders(calls[0]!.init)['if-none-match']).toBe('"2"')
  })

  it('rejects a different origin on API paths', async () => {
    const { proxy, calls } = makeProxy(async () => json({}))
    proxy.setServer(SERVER)
    const result = await proxy.request({
      path: '/v1/sync',
      method: 'GET',
      origin: OTHER_SERVER,
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'ORIGIN_NOT_ALLOWED' } })
    expect(calls).toHaveLength(0)
  })

  it('allows an explicit origin only for the health probe', async () => {
    const { proxy, calls } = makeProxy(async () => json({ status: 'ok' }))
    const result = await proxy.request({
      path: '/health/live',
      method: 'GET',
      origin: OTHER_SERVER,
    })
    expect(result.ok).toBe(true)
    expect(calls[0]?.url).toBe(`${OTHER_SERVER}/health/live`)
    expect(requestHeaders(calls[0]!.init)['x-client-platform']).toBeUndefined()
  })

  it('follows same-origin redirects for the health probe only', async () => {
    const { proxy, calls } = makeProxy(async (url) => {
      if (url === `${OTHER_SERVER}/health/live`) {
        return new Response(null, {
          status: 302,
          headers: { location: '/health/live?probe=1' },
        })
      }
      return json({ status: 'ok' })
    })
    const result = await proxy.request({
      path: '/health/live',
      method: 'GET',
      origin: OTHER_SERVER,
    })
    expect(result.ok).toBe(true)
    expect(calls.map((call) => call.url)).toEqual([
      `${OTHER_SERVER}/health/live`,
      `${OTHER_SERVER}/health/live?probe=1`,
    ])
    expect(calls[0]?.init.redirect).toBe('manual')
  })

  it('rejects a health redirect to another origin', async () => {
    const { proxy } = makeProxy(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://evil.example.com/health/live' },
        }),
    )
    const result = await proxy.request({
      path: '/health/live',
      method: 'GET',
      origin: OTHER_SERVER,
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'REDIRECT_NOT_ALLOWED' } })
    if (!result.ok) expect(result.error.message).toMatch(/use that address/i)
  })

  it('keeps redirects disabled for API requests', async () => {
    const { proxy, calls } = makeProxy(async () => json({}))
    proxy.setServer(SERVER)
    await proxy.request({ path: '/v1/sync', method: 'GET' })
    expect(calls[0]?.init.redirect).toBe('error')
  })

  it('caps responses declared over 5 MB', async () => {
    const { proxy } = makeProxy(
      async () =>
        new Response('{}', {
          headers: { 'content-length': String(API_PROXY_MAX_RESPONSE_BYTES + 1) },
        }),
    )
    proxy.setServer(SERVER)
    const result = await proxy.request({ path: '/v1/sync', method: 'GET' })
    expect(result).toMatchObject({ ok: false, error: { code: 'RESPONSE_TOO_LARGE' } })
  })

  it('caps streamed responses over 5 MB', async () => {
    const { proxy } = makeProxy(async () => {
      const chunk = new Uint8Array(API_PROXY_MAX_RESPONSE_BYTES + 1)
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(chunk)
          controller.close()
        },
      })
      return new Response(body)
    })
    proxy.setServer(SERVER)
    const result = await proxy.request({ path: '/v1/sync', method: 'GET' })
    expect(result).toMatchObject({ ok: false, error: { code: 'RESPONSE_TOO_LARGE' } })
  })

  it('uses a shorter timeout for the health probe', async () => {
    const { proxy } = makeProxy(() => new Promise<Response>(() => undefined), {
      healthTimeoutMs: 5,
      timeoutMs: 5000,
    })
    const result = await proxy.request({
      path: '/health/live',
      method: 'GET',
      origin: OTHER_SERVER,
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'API_TIMEOUT' } })
  })

  it('maps transport failures and timeouts', async () => {
    const failing = makeProxy(async () => {
      throw new TypeError('fetch failed')
    })
    failing.proxy.setServer(SERVER)
    const unreachable = await failing.proxy.request({ path: '/v1/sync', method: 'GET' })
    expect(unreachable).toMatchObject({ ok: false, error: { code: 'API_UNREACHABLE' } })

    const hanging = makeProxy(() => new Promise<Response>(() => undefined), { timeoutMs: 5 })
    hanging.proxy.setServer(SERVER)
    const timedOut = await hanging.proxy.request({ path: '/v1/sync', method: 'GET' })
    expect(timedOut).toMatchObject({ ok: false, error: { code: 'API_TIMEOUT' } })
  })
})

describe('createApiProxy session handling', () => {
  it('captures the login token, strips it from the response and persists it encrypted', async () => {
    const { proxy, calls, file } = makeProxy(async () => json(loginBody()))
    proxy.setServer(SERVER)

    const result = await proxy.request({
      path: '/v1/auth/login',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.c', password: 'secret' }),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.response.body).not.toContain('refreshToken')
    expect(JSON.parse(result.response.body)).not.toHaveProperty('refreshToken')
    expect(requestHeaders(calls[0]!.init)['x-client-platform']).toBe('desktop')
    expect(proxy.sessionState()).toMatchObject({
      signedIn: true,
      serverOrigin: SERVER,
      persistence: 'encrypted',
    })
    expect(file.snapshot()).not.toContain('refresh-1')
    const stored = JSON.parse(file.snapshot() ?? '{}') as { origin?: string }
    expect(stored.origin).toBe(SERVER)
  })

  it('rejects an auth response without a desktop refresh token', async () => {
    const { proxy, calls } = makeProxy(async () =>
      json({
        accessToken: 'access-1',
        user: { id: 'u1', email: 'a@b.c', role: 'USER', status: 'ACTIVE' },
        totpSetupRequired: false,
      }),
    )
    proxy.setServer(SERVER)
    const result = await proxy.request({ path: '/v1/auth/login', method: 'POST', body: '{}' })
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'NATIVE_GRANT_REQUIRED' },
    })
    expect(calls).toHaveLength(1)
    expect(proxy.sessionState().signedIn).toBe(false)
  })

  it('aborts an in-flight refresh when signing out', async () => {
    const refresh = deferred<Response>()
    const started = deferred<void>()
    const { proxy, file } = makeProxy(async (url) => {
      if (url.endsWith('/v1/auth/refresh')) {
        started.resolve()
        return refresh.promise
      }
      return json(loginBody())
    })
    proxy.setServer(SERVER)
    await proxy.request({ path: '/v1/auth/login', method: 'POST', body: '{}' })

    const pending = proxy.request({ path: '/v1/auth/refresh', method: 'POST' })
    await started.promise
    proxy.signOut()
    refresh.resolve(json({ accessToken: 'access-2', refreshToken: 'refresh-2' }))

    const result = await pending
    expect(result).toMatchObject({ ok: false, error: { code: 'REQUEST_ABORTED' } })
    expect(proxy.sessionState().signedIn).toBe(false)
    expect(file.snapshot()).toBeNull()
  })

  it('aborts an in-flight refresh when the server changes', async () => {
    const refresh = deferred<Response>()
    const started = deferred<void>()
    const { proxy, file } = makeProxy(async (url) => {
      if (url.endsWith('/v1/auth/refresh')) {
        started.resolve()
        return refresh.promise
      }
      return json(loginBody())
    })
    proxy.setServer(SERVER)
    await proxy.request({ path: '/v1/auth/login', method: 'POST', body: '{}' })

    const pending = proxy.request({ path: '/v1/auth/refresh', method: 'POST' })
    await started.promise
    proxy.setServer(OTHER_SERVER)
    refresh.resolve(json({ accessToken: 'access-2', refreshToken: 'refresh-from-a' }))

    const result = await pending
    expect(result).toMatchObject({ ok: false, error: { code: 'REQUEST_ABORTED' } })
    expect(proxy.sessionState()).toMatchObject({
      signedIn: false,
      serverOrigin: OTHER_SERVER,
    })
    expect(file.snapshot()).toBeNull()
  })

  it('does not drop a newer token when an older refresh is rejected', async () => {
    const refresh = deferred<Response>()
    const started = deferred<void>()
    let logins = 0
    const { proxy } = makeProxy(async (url) => {
      if (url.endsWith('/v1/auth/refresh')) {
        started.resolve()
        return refresh.promise
      }
      logins += 1
      return json(loginBody(logins === 1 ? 'refresh-1' : 'refresh-2'))
    })
    proxy.setServer(SERVER)
    await proxy.request({ path: '/v1/auth/login', method: 'POST', body: '{}' })

    const pending = proxy.request({ path: '/v1/auth/refresh', method: 'POST' })
    await started.promise
    await proxy.request({ path: '/v1/auth/login', method: 'POST', body: '{}' })
    refresh.resolve(json({ title: 'Expired', code: 'AUTH_TOKEN_EXPIRED' }, 401))

    const result = await pending
    expect(result.ok).toBe(true)
    expect(proxy.sessionState().signedIn).toBe(true)
  })

  it('recognizes auth and logout paths with a query string', async () => {
    const { proxy, calls } = makeProxy(async (url) => {
      if (url.includes('/v1/auth/login')) return json(loginBody())
      return new Response(null, { status: 204 })
    })
    proxy.setServer(SERVER)
    await proxy.request({ path: '/v1/auth/login?trace=1', method: 'POST', body: '{}' })
    expect(requestHeaders(calls[0]!.init)['x-client-platform']).toBe('desktop')
    expect(proxy.sessionState().signedIn).toBe(true)

    await proxy.request({ path: '/v1/auth/logout?trace=1', method: 'POST' })
    expect(proxy.sessionState().signedIn).toBe(false)
  })

  it('injects the stored token on refresh and rotates it', async () => {
    const { proxy, calls, file } = makeProxy(async (url) => {
      if (url.endsWith('/v1/auth/refresh')) {
        return json({ accessToken: 'access-2', refreshToken: 'refresh-2' })
      }
      return json(loginBody())
    })
    proxy.setServer(SERVER)
    await proxy.request({
      path: '/v1/auth/login',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    const result = await proxy.request({ path: '/v1/auth/refresh', method: 'POST' })

    expect(result.ok).toBe(true)
    const refreshCall = calls[1]
    expect(requestHeaders(refreshCall!.init)['x-client-platform']).toBe('desktop')
    expect(JSON.parse(String(refreshCall!.init.body))).toEqual({ refreshToken: 'refresh-1' })
    expect(file.snapshot()).not.toContain('refresh-1')

    const rotated = await proxy.request({ path: '/v1/auth/refresh', method: 'POST' })
    expect(rotated.ok).toBe(true)
    expect(JSON.parse(String(calls[2]!.init.body))).toEqual({ refreshToken: 'refresh-2' })
  })

  it('refuses to refresh without a stored token', async () => {
    const { proxy, calls } = makeProxy(async () => json({}))
    proxy.setServer(SERVER)
    const result = await proxy.request({ path: '/v1/auth/refresh', method: 'POST' })
    expect(result).toMatchObject({ ok: false, error: { code: 'AUTH_TOKEN_EXPIRED' } })
    expect(calls).toHaveLength(0)
  })

  it('drops the token when refresh is rejected', async () => {
    const { proxy, file } = makeProxy(async (url) => {
      if (url.endsWith('/v1/auth/refresh')) {
        return json({ title: 'Expired', code: 'AUTH_TOKEN_EXPIRED' }, 401)
      }
      return json(loginBody())
    })
    proxy.setServer(SERVER)
    await proxy.request({ path: '/v1/auth/login', method: 'POST', body: '{}' })
    await proxy.request({ path: '/v1/auth/refresh', method: 'POST' })
    expect(proxy.sessionState().signedIn).toBe(false)
    expect(file.snapshot()).toBeNull()
  })

  it('keeps the session memory-only when safeStorage is unavailable', async () => {
    for (const options of [{ available: false }, { plaintext: true }]) {
      const { proxy, file } = makeProxy(async () => json(loginBody()), options)
      proxy.setServer(SERVER)
      await proxy.request({ path: '/v1/auth/login', method: 'POST', body: '{}' })
      expect(proxy.sessionState()).toMatchObject({
        signedIn: true,
        persistence: 'memory-only',
      })
      expect(file.snapshot()).toBeNull()
    }
  })

  it('clears the credential on logout and logout-all', async () => {
    for (const path of ['/v1/auth/logout', '/v1/auth/logout-all']) {
      const { proxy, file } = makeProxy(async (url) => {
        if (url.endsWith(path)) return new Response(null, { status: 204 })
        return json(loginBody())
      })
      proxy.setServer(SERVER)
      await proxy.request({ path: '/v1/auth/login', method: 'POST', body: '{}' })
      await proxy.request({ path, method: 'POST' })
      expect(proxy.sessionState().signedIn, path).toBe(false)
      expect(file.snapshot(), path).toBeNull()
    }
  })

  it('clears the credential when the server changes', async () => {
    const { proxy, file } = makeProxy(async () => json(loginBody()))
    proxy.setServer(SERVER)
    await proxy.request({ path: '/v1/auth/login', method: 'POST', body: '{}' })
    proxy.setServer(OTHER_SERVER)
    expect(proxy.sessionState()).toMatchObject({
      signedIn: false,
      serverOrigin: OTHER_SERVER,
    })
    expect(file.snapshot()).toBeNull()
  })

  it('restores a persisted token for the matching origin', async () => {
    const { proxy, file } = makeProxy(async () => json(loginBody()))
    proxy.setServer(SERVER)
    await proxy.request({ path: '/v1/auth/login', method: 'POST', body: '{}' })
    const persisted = file.snapshot()

    const restored = makeProxy(async () => json({ accessToken: 'access-3' }), {
      // Reuse the encrypted payload through a second vault on the same file.
    })
    restored.file.write(persisted ?? '')
    restored.proxy.setServer(SERVER)
    expect(restored.proxy.sessionState().signedIn).toBe(true)

    restored.proxy.setServer(OTHER_SERVER)
    expect(restored.proxy.sessionState().signedIn).toBe(false)
  })
})

describe('token vault', () => {
  it('ignores corrupt files and clears on demand', () => {
    const { vault, file } = makeVault()
    file.write('not json')
    expect(vault.load(SERVER)).toBeNull()
    vault.save(SERVER, 'refresh-1')
    expect(vault.load(SERVER)).toBe('refresh-1')
    vault.clear()
    expect(vault.load(SERVER)).toBeNull()
    expect(file.snapshot()).toBeNull()
  })

  it('removes a token stored for another origin', () => {
    const { vault, file } = makeVault()
    vault.save(SERVER, 'refresh-1')
    expect(vault.load(OTHER_SERVER)).toBeNull()
    expect(file.snapshot()).toBeNull()
  })

  it('clears a persisted token when booting without a server', () => {
    const { vault, file } = makeVault()
    vault.save(SERVER, 'refresh-1')
    const proxy = createApiProxy({
      vault,
      fetch: (async () => json({})) as typeof fetch,
    })
    proxy.setServer(null)
    expect(proxy.sessionState().signedIn).toBe(false)
    expect(file.snapshot()).toBeNull()
  })

  it('removes a token from another origin when booting with a server', () => {
    const { vault, file } = makeVault()
    vault.save(SERVER, 'refresh-1')
    const proxy = createApiProxy({
      vault,
      fetch: (async () => json({})) as typeof fetch,
    })
    proxy.setServer(OTHER_SERVER)
    expect(proxy.sessionState().signedIn).toBe(false)
    expect(file.snapshot()).toBeNull()
  })

  it('propagates write and delete failures instead of hiding them', () => {
    const brokenWrite = createTokenVault({
      file: {
        read: () => null,
        write: () => {
          throw new Error('disk full')
        },
        remove: () => undefined,
      },
      crypto: {
        isEncryptionAvailable: () => true,
        usesPlainTextBackend: () => false,
        encryptString: (value) => Buffer.from(`enc:${value}`),
        decryptString: (buffer) => buffer.toString().replace(/^enc:/, ''),
      },
    })
    expect(() => brokenWrite.save(SERVER, 'refresh-1')).toThrow(/disk full/)
    expect(brokenWrite.load(SERVER)).toBeNull()

    const brokenRemove = createTokenVault({
      file: {
        read: () => null,
        write: () => undefined,
        remove: () => {
          throw new Error('read-only filesystem')
        },
      },
      crypto: {
        isEncryptionAvailable: () => true,
        usesPlainTextBackend: () => false,
        encryptString: (value) => Buffer.from(`enc:${value}`),
        decryptString: (buffer) => buffer.toString().replace(/^enc:/, ''),
      },
    })
    expect(() => brokenRemove.clear()).toThrow(/read-only filesystem/)
  })
})

describe('stripFetchMetadata', () => {
  it('removes Fetch Metadata before the request leaves the API session', () => {
    const headers = {
      'sec-fetch-site': 'none',
      Origin: 'lifespire-app://app',
      referer: 'lifespire-app://app/settings',
      'content-type': 'application/json',
    }
    stripFetchMetadata(headers)
    expect(headers).toEqual({ 'content-type': 'application/json' })
  })

  it('normalizes header names case-insensitively', () => {
    const headers = { 'SEC-FETCH-SITE': 'none', origin: 'x', Referer: 'y' }
    stripFetchMetadata(headers)
    expect(headers).toEqual({})
  })
})

describe('isTrustedSender', () => {
  const packaged = { isPackaged: true, devUrl: 'http://localhost:5173' }
  const development = { isPackaged: false, devUrl: 'http://localhost:5173' }

  it('accepts the packaged app origin', () => {
    expect(isTrustedSender('lifespire-app://app/index.html', packaged)).toBe(true)
    expect(isTrustedSender('lifespire-app://app/', packaged)).toBe(true)
  })

  it('rejects a different host or protocol', () => {
    expect(isTrustedSender('lifespire-app://evil/index.html', packaged)).toBe(false)
    expect(isTrustedSender('https://app/index.html', packaged)).toBe(false)
    expect(isTrustedSender('javascript:alert(1)', packaged)).toBe(false)
    expect(isTrustedSender(null, packaged)).toBe(false)
  })

  it('accepts only the dev origin while unpackaged', () => {
    expect(isTrustedSender('http://localhost:5173/map', development)).toBe(true)
    expect(isTrustedSender('http://localhost:6006/map', development)).toBe(false)
    expect(isTrustedSender('lifespire-app://app/index.html', development)).toBe(false)
    expect(isTrustedSender('http://localhost:5173/map', packaged)).toBe(false)
  })
})
