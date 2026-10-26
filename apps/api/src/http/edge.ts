import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Paths owned by the API. Requests under these prefixes bypass the static
 * file server so Nest keeps answering (including its JSON 404s), no matter
 * what files exist in the web build.
 */
export const API_BYPASS_PREFIXES = ['/v1', '/health', '/docs'];

/** Path portion of a request URL, without the query string. */
export function requestPath(url: string): string {
  const queryIndex = url.indexOf('?');
  return queryIndex === -1 ? url : url.slice(0, queryIndex);
}

/** Collapses duplicate slashes so `//v1/me` cannot dodge the API bypass. */
export function normalizePath(path: string): string {
  return path.replace(/\/{2,}/g, '/');
}

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
 * Edge behavior that must run even when the API does not serve the web
 * build: the legacy `/api/*` strip-prefix rule and `Cache-Control: no-store`
 * on API paths. It deliberately does not depend on `WEB_DIST_DIR`; the edge
 * proxy that used to enforce both is no longer required.
 */
export function createEdgeMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const rawPath = requestPath(req.url);
    const stripped = stripLegacyApiPrefix(normalizePath(rawPath));
    if (stripped !== rawPath) {
      const queryIndex = req.url.indexOf('?');
      req.url = stripped + (queryIndex === -1 ? '' : req.url.slice(queryIndex));
    }
    if (isApiPath(stripped)) {
      // The previous edge set this on every API path so authenticated GETs
      // are never heuristically cached. Static assets intentionally keep no
      // directive (content-hashed, SW-precached).
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  };
}
