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

  it('covers auth endpoints with typed results', async () => {
    const paths: string[] = [];
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
});
