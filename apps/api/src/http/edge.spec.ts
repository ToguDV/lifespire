import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  createEdgeMiddleware,
  isApiPath,
  normalizePath,
  stripLegacyApiPrefix,
} from './edge';

/** API-only app (no SPA): the edge contract must hold on its own. */
function makeApp() {
  const app = express();
  const seen: Array<{ path: string; cache?: string }> = [];
  app.use(createEdgeMiddleware());
  app.use((req, res) => {
    const cache = res.getHeader('cache-control');
    seen.push({ path: req.path, cache: typeof cache === 'string' ? cache : undefined });
    res.status(404).json({ status: 404, path: req.path });
  });
  return { app, seen };
}

describe('stripLegacyApiPrefix', () => {
  it('maps the exact prefix to the root', () => {
    expect(stripLegacyApiPrefix('/api')).toBe('/');
    expect(stripLegacyApiPrefix('/api/')).toBe('/');
  });

  it('strips only the prefix boundary', () => {
    expect(stripLegacyApiPrefix('/api/v1/me')).toBe('/v1/me');
    expect(stripLegacyApiPrefix('/apiary')).toBe('/apiary');
    expect(stripLegacyApiPrefix('/API/v1')).toBe('/v1');
    expect(stripLegacyApiPrefix('/API')).toBe('/');
  });
});

describe('normalizePath', () => {
  it('collapses duplicate slashes', () => {
    expect(normalizePath('//v1/me')).toBe('/v1/me');
    expect(normalizePath('/api//v1/me')).toBe('/api/v1/me');
    expect(normalizePath('//')).toBe('/');
  });
});

describe('isApiPath', () => {
  it('matches exact prefixes and subpaths', () => {
    expect(isApiPath('/v1')).toBe(true);
    expect(isApiPath('/v1/me')).toBe(true);
    expect(isApiPath('/V1/me')).toBe(true);
    expect(isApiPath('/HEALTH/live')).toBe(true);
    expect(isApiPath('/health/ready')).toBe(true);
    expect(isApiPath('/docs')).toBe(true);
    expect(isApiPath('/DOCS')).toBe(true);
    expect(isApiPath('/docs-json')).toBe(true);
    expect(isApiPath('/docs-yaml')).toBe(true);
  });

  it('rejects lookalikes', () => {
    expect(isApiPath('/v1evil')).toBe(false);
    expect(isApiPath('/healthcheck')).toBe(false);
    expect(isApiPath('/docsfoo')).toBe(false);
    expect(isApiPath('/')).toBe(false);
  });
});

describe('createEdgeMiddleware', () => {
  it('rewrites the legacy /api prefix without an SPA middleware', async () => {
    const { app, seen } = makeApp();
    const res = await request(app).get('/api/v1/me');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ status: 404, path: '/v1/me' });
    expect(seen).toEqual([{ path: '/v1/me', cache: 'no-store' }]);
  });

  it('preserves the query string when rewriting', async () => {
    const { app, seen } = makeApp();
    await request(app).get('/api/v1/sync?since=12');
    expect(seen).toEqual([{ path: '/v1/sync', cache: 'no-store' }]);
  });

  it('matches API paths case-insensitively like Express routing', async () => {
    const { app, seen } = makeApp();
    await request(app).get('/V1/me');
    await request(app).get('/API/v1/me');
    expect(seen).toEqual([
      { path: '/V1/me', cache: 'no-store' },
      { path: '/v1/me', cache: 'no-store' },
    ]);
  });

  it('sets no-store on every API path', async () => {
    for (const path of ['/v1/me', '/health/live', '/docs', '/docs-json']) {
      const { app, seen } = makeApp();
      await request(app).get(path);
      expect(seen).toEqual([{ path, cache: 'no-store' }]);
    }
  });

  it('leaves SPA paths and legacy non-API routes cacheable', async () => {
    const { app, seen } = makeApp();
    await request(app).get('/goals/weekly');
    await request(app).get('/api/ancient');
    expect(seen).toEqual([
      { path: '/goals/weekly', cache: undefined },
      { path: '/ancient', cache: undefined },
    ]);
  });

  it('normalizes duplicate slashes before the API bypass', async () => {
    const { app, seen } = makeApp();
    const res = await request(app).get('//v1/me');
    expect(res.status).toBe(404);
    expect(seen).toEqual([{ path: '/v1/me', cache: 'no-store' }]);
  });

  it('maps the exact /api prefix to the SPA root', async () => {
    const { app, seen } = makeApp();
    const res = await request(app).get('/api');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ status: 404, path: '/' });
    expect(seen).toEqual([{ path: '/', cache: undefined }]);
  });

  it('does not rewrite lookalike prefixes', async () => {
    const { app, seen } = makeApp();
    await request(app).get('/apiary');
    expect(seen).toEqual([{ path: '/apiary', cache: undefined }]);
  });
});
