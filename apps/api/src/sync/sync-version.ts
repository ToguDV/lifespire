/** Pure sync-version helpers. No Nest, no DB — safe to unit test. */

export function formatETag(version: bigint): string {
  if (version < 0n) throw new Error('version must be >= 0');
  return `"${version.toString()}"`;
}

export function parseETag(value: string): bigint {
  const match = /^"(\d+)"$/.exec(value.trim());
  if (!match) throw new Error(`invalid ETag: ${value}`);
  return BigInt(match[1]);
}

/**
 * Parses an If-Match header.
 * - `*` means "create only if absent" -> null sentinel.
 * - undefined means "no precondition".
 */
export function parseIfMatch(value: string | undefined): bigint | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === '*') return null;
  const match = /^"?(\d+)"?$/.exec(trimmed);
  if (!match) throw new Error(`invalid If-Match: ${value}`);
  return BigInt(match[1]);
}

export function nextVersion(current: bigint): bigint {
  if (current < 0n) throw new Error('version must be >= 0');
  return current + 1n;
}

export function shouldIncrementVersion(baseChecksum: string, nextChecksum: string): boolean {
  return baseChecksum !== nextChecksum;
}
