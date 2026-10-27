/**
 * Account-link helpers shared by web and Android.
 *
 * Admin links put the one-time token in the URL fragment
 * (`/reset-password#token=…`), so it never reaches the server with the
 * document request. Users also paste the full link into the manual forms; the
 * extractor accepts links, links wrapped in quotes/angle brackets and raw
 * tokens.
 */

/**
 * 32 random bytes as unpadded base64url, matching the API's
 * `INVITE_TOKEN_PATTERN` (`apps/api/src/auth/invite-token.ts`).
 */
export const AUTH_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isAuthToken(value: string): boolean {
  return AUTH_TOKEN_PATTERN.test(value);
}

function stripWrappers(value: string): string {
  let out = value.trim();
  for (const [open, close] of [
    ['<', '>'],
    ['"', '"'],
    ["'", "'"],
    ['`', '`'],
  ] as const) {
    if (out.length >= 2 && out.startsWith(open) && out.endsWith(close)) {
      out = out.slice(1, -1).trim();
    }
  }
  return out;
}

function tokenFromParams(raw: string): string | null {
  try {
    const token = new URLSearchParams(raw).get('token');
    return token?.trim() || null;
  } catch {
    return null;
  }
}

/** Extracts the token from a raw token, a fragment link or a query link. */
export function extractAuthToken(raw: string): string {
  const trimmed = stripWrappers(raw);
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    const fromHash = tokenFromParams(url.hash.replace(/^#/, ''));
    if (fromHash) return fromHash;
    const fromQuery = url.searchParams.get('token')?.trim();
    if (fromQuery) return fromQuery;
  } catch {
    // Not an absolute URL; fall through to the string checks.
  }

  const hashIndex = trimmed.indexOf('#');
  if (hashIndex !== -1) {
    const fromHash = tokenFromParams(trimmed.slice(hashIndex + 1));
    if (fromHash) return fromHash;
  }

  const queryIndex = trimmed.indexOf('?');
  if (queryIndex !== -1) {
    const query = trimmed.slice(queryIndex + 1).split('#')[0] ?? '';
    const fromQuery = tokenFromParams(query);
    if (fromQuery) return fromQuery;
  }

  return trimmed;
}
