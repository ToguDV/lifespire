import { describe, expect, it } from 'vitest';
import { SyncConflictError, createApiClient } from './index';

describe('api-client', () => {
  it('builds If-Match / Idempotency-Key requests', async () => {
    const seen: Record<string, string> = {};
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      Object.assign(seen, headers);
      return new Response(JSON.stringify({ version: '8', updatedAt: '2026-10-24T00:00:00.000Z' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    try {
      const api = createApiClient({ baseUrl: 'https://api.example.com' });
      const out = await api.putSync({ a: 1 }, { ifMatch: '7', idempotencyKey: 'k' });
      expect(out.version).toBe('8');
      expect(seen['If-Match']).toBe('"7"');
      expect(seen['Idempotency-Key']).toBe('k');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('throws SyncConflictError on 412', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ currentVersion: '9' }), { status: 412 })) as typeof fetch;
    try {
      const api = createApiClient({ baseUrl: 'https://api.example.com' });
      await expect(api.putSync({}, { ifMatch: '7', idempotencyKey: 'k' })).rejects.toBeInstanceOf(
        SyncConflictError,
      );
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('does not double-quote already-quoted versions', async () => {
    const seen: Record<string, string> = {};
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      Object.assign(seen, init?.headers as Record<string, string>);
      return new Response(JSON.stringify({ version: '8', updatedAt: '2026-10-24T00:00:00.000Z' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    try {
      const api = createApiClient({ baseUrl: 'https://api.example.com' });
      await api.putSync({ a: 1 }, { ifMatch: '"7"', idempotencyKey: 'k' });
      expect(seen['If-Match']).toBe('"7"');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('throws ApiRequestError with status/code on failures', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ title: 'No cloud save', code: 'SYNC_INVALID_DOCUMENT' }), {
        status: 404,
      })) as typeof fetch;
    try {
      const api = createApiClient({ baseUrl: 'https://api.example.com' });
      await expect(api.me()).rejects.toMatchObject({ status: 404, code: 'SYNC_INVALID_DOCUMENT' });
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('returns null when no cloud save exists', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ title: 'No cloud save', code: 'SYNC_INVALID_DOCUMENT' }), {
        status: 404,
      })) as typeof fetch;
    try {
      const api = createApiClient({ baseUrl: 'https://api.example.com' });
      await expect(api.getSync()).resolves.toBeNull();
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('sends the bearer token and refreshes once on 401', async () => {
    const seenAuth: string[] = [];
    let calls = 0;
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      calls += 1;
      const target = String(url);
      if (target.endsWith('/v1/auth/refresh')) {
        return new Response(JSON.stringify({ accessToken: 'new-token' }), { status: 200 });
      }
      seenAuth.push((init?.headers as Record<string, string>)?.Authorization ?? '');
      if (calls === 1) {
        return new Response(JSON.stringify({ title: 'Unauthorized', code: 'AUTH_TOKEN_EXPIRED' }), {
          status: 401,
        });
      }
      return new Response(
        JSON.stringify({
          id: 'u1',
          email: 'a@b.c',
          role: 'USER',
          status: 'ACTIVE',
          totpEnabled: false,
          createdAt: '2026-10-24T00:00:00.000Z',
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    try {
      let token: string | null = 'old-token';
      const api = createApiClient({
        baseUrl: 'https://api.example.com',
        getAccessToken: () => token,
        setAccessToken: (next) => {
          token = next;
        },
      });
      const me = await api.me();
      expect(me.email).toBe('a@b.c');
      expect(token).toBe('new-token');
      expect(seenAuth[0]).toBe('Bearer old-token');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('keeps the web cookie mode unchanged', async () => {
    const seen: Record<string, string> = {}
    const origFetch = globalThis.fetch
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      Object.assign(seen, init?.headers as Record<string, string>)
      return new Response(
        JSON.stringify({
          accessToken: 'web-token',
          user: { id: 'u1', email: 'a@b.c', role: 'USER', status: 'ACTIVE' },
          totpSetupRequired: false,
        }),
        { status: 200 },
      )
    }) as typeof fetch
    try {
      const api = createApiClient({ baseUrl: 'https://api.example.com' })
      await api.login('a@b.c', 'password123456', 'web')
      expect(seen['X-Client-Platform']).toBeUndefined()
    } finally {
      globalThis.fetch = origFetch
    }
  })

  it('native mode captures and rotates the refresh token', async () => {
    const calls: Array<{ path: string; headers: Record<string, string>; body: unknown }> = []
    let accessToken: string | null = null
    let refreshToken: string | null = null
    const origFetch = globalThis.fetch
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      const target = String(url)
      const path = target.slice(target.indexOf('/v1'))
      calls.push({
        path,
        headers: (init?.headers as Record<string, string>) ?? {},
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      })
      if (path === '/v1/auth/login') {
        return new Response(
          JSON.stringify({
            accessToken: 'access-1',
            refreshToken: 'refresh-1',
            user: { id: 'u1', email: 'a@b.c', role: 'USER', status: 'ACTIVE' },
            totpSetupRequired: false,
          }),
          { status: 200 },
        )
      }
      if (path === '/v1/auth/refresh') {
        return new Response(
          JSON.stringify({ accessToken: 'access-2', refreshToken: 'refresh-2' }),
          { status: 200 },
        )
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }) as typeof fetch
    try {
      const api = createApiClient({
        baseUrl: 'https://api.example.com',
        mode: 'native',
        platform: 'android',
        getAccessToken: () => accessToken,
        setAccessToken: (next) => {
          accessToken = next
        },
        getRefreshToken: () => refreshToken,
        setRefreshToken: (next) => {
          refreshToken = next
        },
      })
      await api.login('a@b.c', 'password123456', 'android')
      expect(accessToken).toBe('access-1')
      expect(refreshToken).toBe('refresh-1')
      expect(calls[0]?.headers['X-Client-Platform']).toBe('android')

      await api.refresh()
      expect(accessToken).toBe('access-2')
      expect(refreshToken).toBe('refresh-2')
      expect(calls[1]?.body).toEqual({ refreshToken: 'refresh-1' })
    } finally {
      globalThis.fetch = origFetch
    }
  })

  it('native mode refuses to refresh without a stored token', async () => {
    const api = createApiClient({
      baseUrl: 'https://api.example.com',
      mode: 'native',
      getAccessToken: () => null,
      setAccessToken: () => undefined,
      getRefreshToken: () => null,
      setRefreshToken: () => undefined,
    })
    await expect(api.refresh()).rejects.toMatchObject({ status: 401 })
  })

  it('covers auth endpoints with typed results', async () => {    const paths: string[] = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      const target = String(url);
      paths.push(`${init?.method ?? 'GET'} ${target.slice(target.indexOf('/v1'))}`);
      if (target.endsWith('/v1/auth/login')) {
        return new Response(
          JSON.stringify({
            accessToken: 't',
            user: { id: 'u1', email: 'a@b.c', role: 'USER', status: 'ACTIVE' },
            totpSetupRequired: false,
          }),
          { status: 200 },
        );
      }
      if (target.endsWith('/v1/auth/totp/setup')) {
        return new Response(
          JSON.stringify({ otpauthUrl: 'otpauth://x', manualSecret: 's', recoveryCodes: ['a'] }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;
    try {
      const api = createApiClient({ baseUrl: 'https://api.example.com' });
      const login = await api.login('a@b.c', 'password123456', 'web');
      expect(login.totpSetupRequired).toBe(false);
      expect(login.accessToken).toBe('t');
      await api.acceptInvite('tok', 'password123456', 'web');
      const setup = await api.totpSetup('password123456');
      expect(setup.recoveryCodes).toEqual(['a']);
      await api.totpEnable('123456');
      await api.logout();
      expect(paths).toContain('POST /v1/auth/login');
      expect(paths).toContain('POST /v1/auth/totp/setup');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('lists admin users and creates invite links', async () => {
    const seen: Array<{ method: string; path: string; body?: unknown }> = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      const target = String(url);
      const path = target.slice(target.indexOf('/v1'));
      seen.push({
        method: init?.method ?? 'GET',
        path,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      if (path.startsWith('/v1/admin/users') && (init?.method ?? 'GET') === 'GET') {
        return new Response(
          JSON.stringify({
            total: 1,
            page: 1,
            pageSize: 100,
            users: [
              {
                id: 'u1',
                email: 'a@b.c',
                role: 'USER',
                status: 'ACTIVE',
                deviceCount: 2,
                lastLoginAt: '2026-10-24T00:00:00.000Z',
                lastSyncAt: null,
                createdAt: '2026-10-24T00:00:00.000Z',
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (path === '/v1/admin/users') {
        return new Response(
          JSON.stringify({
            id: 'u2',
            email: 'n@b.c',
            inviteLink: 'http://localhost:5173/accept-invite#token=abc',
          }),
          { status: 201 },
        );
      }
      return new Response(JSON.stringify({ title: 'Not found' }), { status: 404 });
    }) as typeof fetch;
    try {
      const api = createApiClient({ baseUrl: 'https://api.example.com' });
      const listed = await api.listUsers();
      expect(listed.total).toBe(1);
      expect(listed.users[0]?.deviceCount).toBe(2);
      const created = await api.createUser('n@b.c', 'USER');
      expect(created.inviteLink).toContain('#token=');
      expect(seen).toContainEqual({
        method: 'POST',
        path: '/v1/admin/users',
        body: { email: 'n@b.c', role: 'USER' },
      });
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('surfaces admin 403s as ApiRequestError', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ title: 'Forbidden', code: 'FORBIDDEN' }), {
        status: 403,
      })) as typeof fetch;
    try {
      const api = createApiClient({ baseUrl: 'https://api.example.com' });
      await expect(api.listUsers()).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
