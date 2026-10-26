import express from 'express';
import helmet from 'helmet';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import {
  API_BYPASS_PREFIXES,
  createSpaMiddleware,
  resolveSpaDistDir,
  SPA_SECURITY_HEADERS,
} from './spa';

const INDEX_HTML = '<!doctype html><html><head></head><body>app</body></html>';
const EXPECTED_CSP =
  "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; " +
  "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

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

/** Bare app: the SPA middleware plus a downstream handler that mimics Nest (records path, 404s). */
function makeApp(distDir: string | null) {
  const app = express();
  const seen: string[] = [];
  if (distDir) {
    const middleware = createSpaMiddleware(distDir);
    expect(middleware).not.toBeNull();
    app.use(middleware!);
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

describe('createSpaMiddleware', () => {
  it('returns null when the dist directory is invalid', () => {
    expect(createSpaMiddleware('/does/not/exist')).toBeNull();
  });

  it('serves an existing asset with the edge security headers', async () => {
    const dir = makeDist({ 'assets/app.css': 'body{}' });
    const { app } = makeApp(dir);
    const res = await request(app).get('/assets/app.css');
    expect(res.status).toBe(200);
    expect(res.text).toBe('body{}');
    expect(res.headers['content-security-policy']).toBe(EXPECTED_CSP);
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
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
    const res = await request(app).post('/goals/weekly');
    expect(res.status).toBe(404);
    expect(seen).toEqual(['/goals/weekly']);
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
  });

  it('never serves dotfiles; they fall back instead', async () => {
    const dir = makeDist({ '.secret': 'top-secret' });
    const { app } = makeApp(dir);
    const res = await request(app).get('/.secret');
    expect(res.status).toBe(200);
    expect(res.text).toBe(INDEX_HTML);
    expect(res.text).not.toContain('top-secret');
  });

  it('sets no-store on API paths but leaves static responses cacheable', async () => {
    const dir = makeDist({ 'assets/app.css': 'body{}' });
    const { app } = makeApp(dir);
    const api = await request(app).get('/v1/me');
    expect(api.headers['cache-control']).toBe('no-store');
    // express.static sends `public, max-age=0` (always revalidate): cacheable
    // but never stale. What matters is it never says no-store like the API.
    const page = await request(app).get('/');
    expect(page.headers['cache-control']).not.toContain('no-store');
    const asset = await request(app).get('/assets/app.css');
    expect(asset.headers['cache-control']).not.toContain('no-store');
  });

  it('keeps the exact security headers when helmet runs first', async () => {
    const dir = makeDist();
    const middleware = createSpaMiddleware(dir);
    expect(middleware).not.toBeNull();
    const app = express();
    app.use(helmet());
    app.use(middleware!);
    app.use((_req, res) => {
      res.status(404).json({});
    });
    const res = await request(app).get('/goals/weekly');
    expect(res.status).toBe(200);
    expect(res.text).toBe(INDEX_HTML);
    expect(res.headers['content-security-policy']).toBe(EXPECTED_CSP);
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('SPA_SECURITY_HEADERS', () => {
  it('matches the edge proxy contract', () => {
    expect(SPA_SECURITY_HEADERS).toEqual({
      'Content-Security-Policy': EXPECTED_CSP,
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    });
  });
});
