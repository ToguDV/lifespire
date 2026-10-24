import { createHash } from 'node:crypto';

/** Server-side sync guardrails. The document itself is validated by @lifespire/core. */
export const MAX_DOCUMENT_BYTES = 512 * 1024;
export const MAX_REQUEST_BYTES = 1024 * 1024;
export const SYNC_REVISIONS_KEPT = 30;
export const IDEMPOTENCY_TTL_DAYS = 7;

/** Stable checksum over canonical JSON (sorted keys) so equal docs hash equal. */
export function checksumDocument(document: unknown): string {
  return createHash('sha256').update(canonicalJson(document), 'utf8').digest('hex');
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}
