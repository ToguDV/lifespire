import express from 'express';
import helmet from 'helmet';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createEdgeMiddleware, API_BYPASS_PREFIXES } from '../http/edge';
import {
  createSpaMiddleware,
  resolveSpaDistDir,
  resolveWebBuild,
  SPA_SECURITY_HEADERS,
} from './spa';

const INDEX_HTML = '<!doctype html><html><head></head><body>app</body></html>';
const EXPECTED_CSP =
  "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; " +
  "script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; " +
  "form-action 'self'";

let tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
  tmpDirs = [];
});

function makeDist(extraFiles: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'lifespire-spa-'));
  tmpDirs.push(dir);
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'index.html'), INDEX_HTML);
  for (const [name, content] of Object.entries(extraFiles)) {
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

/** Bare app: the production middleware order (edge → optional SPA) plus a
 * downstream handler that mimics Nest (records path, 404s). */
function makeApp(distDir: string | null) {
  const app = express();
  const seen: string[] = [];
  app.use(createEdgeMiddleware());
  if (distDir) {
    app.use(createSpaMiddleware(distDir));
  }
  app.use((req, res) => {
    seen.push(req.path);
    res.status(404).json({ status: 404, path: req.path });
  });
  return { app, seen };
}

describe('resolveSpaDistDir', () => {
  it('returns null for a missing directory', () => {
    expect(resolveSpaDistDir('/does/not/exist')).toBeNull();
  });

  it('returns null when index.html is missing', () => {
    const dir = makeDist();
    rmSync(join(dir, 'index.html'));
    expect(resolveSpaDistDir(dir)).toBeNull();
  });

  it('returns the directory when index.html exists', () => {
    const dir = makeDist();
    expect(resolveSpaDistDir(dir)).toBe(dir);
  });

  it('resolves a relative directory to an absolute path', () => {
    const dir = makeDist();
    const rel = relative(process.cwd(), dir);
    expect(rel).not.toBe(dir);
    const resolved = resolveSpaDistDir(rel);
    expect(resolved).not.toBeNull();
    expect(isAbsolute(resolved!)).toBe(true);
    expect(resolved).toBe(dir);
  });
});

describe('resolveWebBuild', () => {
  it('disables the SPA for unset, empty or whitespace values', () => {
    expect(resolveWebBuild(undefined, 'development')).toEqual({ kind: 'disabled' });
    expect(resolveWebBuild('', 'development')).toEqual({ kind: 'disabled' });
    expect(resolveWebBuild('   ', 'production')).toEqual({ kind: 'disabled' });
  });

  it('returns a usable build resolved to an absolute path', () => {
    const dir = makeDist();
    expect(resolveWebBuild(dir, 'production')).toEqual({ kind: 'ready', dir });
  });

  it('reports an unusable build in development', () => {
    const result = resolveWebBuild('/does/not/exist', 'development');
    expect(result.kind).toBe('invalid');
    if (result.kind === 'invalid') expect(result.error).toContain('WEB_DIST_DIR');
  });

  it('fails fast for an unusable build in production', () => {
    expect(() => resolveWebBuild('/does/not/exist', 'production')).toThrow(/WEB_DIST_DIR/);
  });
});

describe('createSpaMiddleware', () => {
  it('serves an existing asset with the edge security headers', async () => {
    const dir = makeDist({ 'assets/app.css': 'body{}' });
    const { app } = makeApp(dir);
    const res = await request(app).get('/assets/app.css');
    expect(res.status).toBe(200);
    expect(res.text).toBe('body{}');
    expect(res.headers['content-security-policy']).toBe(EXPECTED_CSP);
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  it('falls back to index.html for unknown SPA routes', async () => {
    const dir = makeDist();
    const { app, seen } = makeApp(dir);
    const res = await request(app).get('/goals/weekly');
    expect(res.status).toBe(200);
    expect(res.text).toBe(INDEX_HTML);
    expect(res.headers['content-security-policy']).toBe(EXPECTED_CSP);
    expect(seen).toEqual([]);
  });

  it('serves index.html at / with the security headers', async () => {
    const dir = makeDist();
    const { app } = makeApp(dir);
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toBe(INDEX_HTML);
    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });

  it.each(['/reset-password', '/accept-invite'])(
    'serves the SPA shell for the account link %s',
    async (path) => {
      const dir = makeDist();
      const { app, seen } = makeApp(dir);
      const res = await request(app).get(path);
      expect(res.status).toBe(200);
      expect(res.text).toBe(INDEX_HTML);
      expect(res.headers['content-security-policy']).toBe(EXPECTED_CSP);
      expect(seen).toEqual([]);
    },
  );

  it.each(API_BYPASS_PREFIXES)('lets the API handle %s/* (no static, no fallback)', async (prefix) => {
    const dir = makeDist();
    const { app, seen } = makeApp(dir);
    const res = await request(app).get(`${prefix}/something`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ status: 404, path: `${prefix}/something` });
    expect(seen).toEqual([`${prefix}/something`]);
  });

  it('rewrites the legacy /api/* prefix before routing', async () => {
    const dir = makeDist();
    const { app, seen } = makeApp(dir);
    const res = await request(app).get('/api/v1/me');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ status: 404, path: '/v1/me' });
    expect(seen).toEqual(['/v1/me']);
  });

  it('serves the SPA for the exact /api prefix (no redirect)', async () => {
    const dir = makeDist();
    const { app } = makeApp(dir);
    const res = await request(app).get('/api');
    expect(res.status).toBe(200);
    expect(res.text).toBe(INDEX_HTML);
  });

  it('falls back to index.html for other legacy /api/* paths', async () => {
    const dir = makeDist();
    const { app, seen } = makeApp(dir);
    const res = await request(app).get('/api/ancient');
    expect(res.status).toBe(200);
    expect(res.text).toBe(INDEX_HTML);
    expect(seen).toEqual([]);
  });

  it('does not fall back for non-GET requests', async () => {
    const dir = makeDist();
    const { app, seen } = makeApp(dir);
    for (const method of ['post', 'put', 'delete'] as const) {
      const res = await request(app)[method]('/');
      expect(res.status).toBe(404);
    }
    expect(seen).toEqual(['/', '/', '/']);
    seen.length = 0;
    const legacy = await request(app).post('/api');
    expect(legacy.status).toBe(404);
    expect(seen).toEqual(['/']);
    const route = await request(app).post('/goals/weekly');
    expect(route.status).toBe(404);
    expect(seen).toEqual(['/', '/goals/weekly']);
  });

  it('passes exact API prefixes and the Swagger JSON/YAML docs through', async () => {
    for (const path of [...API_BYPASS_PREFIXES, '/docs-json', '/docs-yaml']) {
      const { app, seen } = makeApp(makeDist());
      const res = await request(app).get(path);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ status: 404, path });
      expect(seen).toEqual([path]);
    }
  });

  it('falls back for lookalike non-API prefixes', async () => {
    for (const path of ['/v1evil', '/healthcheck', '/apiary', '/docsfoo']) {
      const { app } = makeApp(makeDist());
      const res = await request(app).get(path);
      expect(res.status).toBe(200);
      expect(res.text).toBe(INDEX_HTML);
    }
  });

  it('ignores query strings when routing', async () => {
    const { app, seen } = makeApp(makeDist());
    const api = await request(app).get('/v1/sync?since=12');
    expect(api.status).toBe(404);
    expect(seen).toEqual(['/v1/sync']);
    const spa = await request(app).get('/goals/weekly?tab=map');
    expect(spa.status).toBe(200);
    expect(spa.text).toBe(INDEX_HTML);
  });

  it('falls back for HEAD on unknown SPA routes', async () => {
    const { app } = makeApp(makeDist());
    const res = await request(app).head('/goals/weekly');
    expect(res.status).toBe(200);
    const root = await request(app).head('/');
    expect(root.status).toBe(200);
    const legacy = await request(app).head('/api');
    expect(legacy.status).toBe(200);
  });

  it('returns 404 for traversal, dot-directories and encoded traversal', async () => {
    const { app, seen } = makeApp(makeDist());
    for (const path of ['/../etc/passwd', '/%2e%2e/%2e%2e/etc/passwd', '/.git/config']) {
      const res = await request(app).get(path);
      expect(res.status).toBe(404);
      expect(res.text).not.toContain('<!doctype html>');
    }
    expect(seen).toHaveLength(3);
  });

  it('returns 404 for a missing file with an extension instead of HTML', async () => {
    const { app, seen } = makeApp(makeDist());
    const res = await request(app).get('/assets/gone.js');
    expect(res.status).toBe(404);
    expect(res.text).not.toContain('<!doctype html>');
    expect(seen).toEqual(['/assets/gone.js']);
  });

  it('never serves dotfiles', async () => {
    const dir = makeDist({ '.secret': 'top-secret' });
    const { app } = makeApp(dir);
    const res = await request(app).get('/.secret');
    expect(res.status).toBe(404);
    expect(res.text).not.toContain('top-secret');
  });

  it('sets no-store on API paths but leaves static responses cacheable', async () => {
    const dir = makeDist({
      'assets/app-ABCD1234.css': 'body{}',
      'assets/unhashed.css': 'body{}',
      'theme.js': '/* theme */',
    });
    const { app } = makeApp(dir);
    const api = await request(app).get('/v1/me');
    expect(api.headers['cache-control']).toBe('no-store');
    // Hashed Vite assets are immutable; other static files revalidate.
    const asset = await request(app).get('/assets/app-ABCD1234.css');
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    const unhashed = await request(app).get('/assets/unhashed.css');
    expect(unhashed.headers['cache-control']).not.toContain('immutable');
    // The theme bootstrap is not hashed: installed clients must revalidate it.
    const theme = await request(app).get('/theme.js');
    expect(theme.status).toBe(200);
    expect(theme.headers['cache-control']).toBe('no-cache');
    const page = await request(app).get('/');
    expect(page.headers['cache-control']).not.toContain('no-store');
    expect(page.headers['cache-control']).not.toContain('immutable');
    const fallback = await request(app).get('/goals/weekly');
    expect(fallback.headers['cache-control']).not.toContain('no-store');
  });

  it('keeps the exact security headers when helmet runs first', async () => {
    const dir = makeDist();
    const app = express();
    app.use(helmet());
    app.use(createEdgeMiddleware());
    app.use(createSpaMiddleware(dir));
    app.use((_req, res) => {
      res.status(404).json({});
    });
    const res = await request(app).get('/goals/weekly');
    expect(res.status).toBe(200);
    expect(res.text).toBe(INDEX_HTML);
    expect(res.headers['content-security-policy']).toBe(EXPECTED_CSP);
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });
});

describe('SPA_SECURITY_HEADERS', () => {
  it('matches the served web build contract', () => {
    expect(SPA_SECURITY_HEADERS).toEqual({
      'Content-Security-Policy': EXPECTED_CSP,
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    });
  });
});
