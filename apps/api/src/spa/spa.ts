import express from 'express';
import type { RequestHandler, Response } from 'express';
import { statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { isApiPath, requestPath } from '../http/edge';

/**
 * Security headers for the served web build. This module is the source of
 * truth for the API's own SPA responses; any other process that serves the
 * build must send the same values.
 */
export const SPA_SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; " +
    "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  // Align with CSP frame-ancestors 'none' instead of helmet's SAMEORIGIN.
  'X-Frame-Options': 'DENY',
};

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

export type WebBuildResolution =
  | { kind: 'disabled' }
  | { kind: 'ready'; dir: string }
  | { kind: 'invalid'; error: string };

/**
 * Classifies `WEB_DIST_DIR`: unset/empty disables the SPA, a usable build is
 * returned resolved. A configured-but-unusable directory is a deployment
 * error: in production it fails fast instead of silently serving API-only,
 * which would leave the public site dead behind a green health check.
 */
export function resolveWebBuild(
  candidate: string | undefined,
  nodeEnv: string,
): WebBuildResolution {
  const value = candidate?.trim();
  if (!value) return { kind: 'disabled' };
  const dir = resolveSpaDistDir(value);
  if (dir) return { kind: 'ready', dir };
  const error =
    `WEB_DIST_DIR is set but unusable: ${value} ` +
    '(expected a directory containing index.html)';
  if (nodeEnv === 'production') throw new Error(error);
  return { kind: 'invalid', error };
}

function applySpaHeaders(res: Response): void {
  for (const [name, value] of Object.entries(SPA_SECURITY_HEADERS)) {
    res.setHeader(name, value);
  }
}

function sendSpaIndex(res: Response, indexFile: string, next: (err?: unknown) => void): void {
  applySpaHeaders(res);
  // Revalidate every navigation response; the SW and the browser keep the
  // previous HTML until the server confirms it.
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(indexFile, (err) => {
    if (err) next(err);
  });
}

/** Vite emits content-hashed bundles under `assets/`; safe to cache forever. */
function isHashedAsset(distDir: string, filePath: string): boolean {
  return relative(distDir, filePath).split(sep)[0] === 'assets';
}

/** A last segment with a dot is a file request, not a client-side route. */
function hasFileExtension(path: string): boolean {
  return path.slice(path.lastIndexOf('/') + 1).includes('.');
}

/**
 * Serves a Vite web build (`index.html` + assets) with an SPA fallback:
 * navigation routes return `index.html` so client-side routing works.
 * API paths and the legacy `/api/*` prefix are never intercepted (the edge
 * middleware rewrites the prefix before this runs). Missing files with an
 * extension get a 404 instead of HTML, so a stale bundle cannot be parsed as
 * a document. `distDir` must be a build validated by `resolveWebBuild`.
 */
export function createSpaMiddleware(distDir: string): RequestHandler {
  const indexFile = join(distDir, 'index.html');
  const serve = express.static(distDir, {
    index: 'index.html',
    setHeaders: (res, filePath) => {
      applySpaHeaders(res);
      if (isHashedAsset(distDir, filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  });
  return (req, res, next) => {
    const path = requestPath(req.url);
    if (isApiPath(path)) {
      next();
      return;
    }
    // Serve the root ourselves: express.static's directory redirect uses the
    // original URL, which would turn a rewritten legacy `/api` into `/api/`.
    if (path === '/') {
      sendSpaIndex(res, indexFile, next);
      return;
    }
    serve(req, res, () => {
      if ((req.method !== 'GET' && req.method !== 'HEAD') || hasFileExtension(path)) {
        next();
        return;
      }
      sendSpaIndex(res, indexFile, next);
    });
  };
}
