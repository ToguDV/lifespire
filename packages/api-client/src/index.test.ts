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
});
