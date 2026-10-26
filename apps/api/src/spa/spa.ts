import express from 'express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Paths owned by the API. Requests under these prefixes bypass the static
 * file server so Nest keeps answering (including its JSON 404s), no matter
 * what files exist in the web build.
 */
export const API_BYPASS_PREFIXES = ['/v1', '/health', '/docs'];

/**
 * Security headers for the served web build. This module is the source of
 * truth: whoever serves the SPA — the API itself or the operator's own
 * proxy — must send exactly these (they match the previous Caddy edge).
 */
export const SPA_SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; " +
    "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

/** Legacy `/api/*` strip-prefix rule. After stripping, normal routing applies:
 * API paths are proxied to Nest, everything else falls back to the SPA. */
export function stripLegacyApiPrefix(path: string): string {
  if (path === '/api') return '/';
  if (path.startsWith('/api/')) return path.slice('/api'.length);
  return path;
}

export function isApiPath(path: string): boolean {
  // Swagger (non-production only) also serves /docs-json and /docs-yaml.
  if (path === '/docs-json' || path === '/docs-yaml') return true;
  return API_BYPASS_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/**
 * Returns the directory (as an absolute path — `res.sendFile` requires one)
 * when it looks like a web build (a directory containing `index.html`),
 * `null` otherwise. `undefined`/empty disables the static serving entirely —
 * the API answers alone.
 */
export function resolveSpaDistDir(candidate: string | undefined): string | null {
  if (!candidate) return null;
  try {
    const absolute = resolve(candidate);
    if (!statSync(absolute).isDirectory()) return null;
    if (!statSync(join(absolute, 'index.html')).isFile()) return null;
    return absolute;
  } catch {
    return null;
  }
}

function applySpaHeaders(res: Response): void {
  for (const [name, value] of Object.entries(SPA_SECURITY_HEADERS)) {
    res.setHeader(name, value);
  }
}

/**
 * Serves a Vite web build (`index.html` + assets) with an SPA fallback:
 * unknown GET routes return `index.html` so client-side routing works.
 * API paths and the legacy `/api/*` prefix are never intercepted.
 * Returns `null` when `distDir` is not a usable build (serving disabled).
 */
export function createSpaMiddleware(distDir: string): RequestHandler | null {
  const resolved = resolveSpaDistDir(distDir);
  if (!resolved) return null;
  const indexFile = join(resolved, 'index.html');
  const serve = express.static(resolved, {
    index: 'index.html',
    setHeaders: (res) => applySpaHeaders(res),
  });
  return (req: Request, res: Response, next: NextFunction) => {
    const queryIndex = req.url.indexOf('?');
    const path = queryIndex === -1 ? req.url : req.url.slice(0, queryIndex);
    const stripped = stripLegacyApiPrefix(path);
    if (stripped !== path) {
      req.url = stripped + (queryIndex === -1 ? '' : req.url.slice(queryIndex));
    }
    if (isApiPath(stripped)) {
      // The previous edge set `Cache-Control: no-store` on every API path so
      // authenticated GETs are never heuristically cached. Static assets
      // intentionally keep no directive (content-hashed, SW-precached).
      res.setHeader('Cache-Control', 'no-store');
      next();
      return;
    }
    serve(req, res, () => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }
      applySpaHeaders(res);
      res.sendFile(indexFile, (err) => {
        if (err) next(err);
      });
    });
  };
}
