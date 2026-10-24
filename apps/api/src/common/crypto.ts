import { createHash, timingSafeEqual } from 'node:crypto';

/** SHA-256 hex digest for checksums, token hashes and idempotency keys. */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Constant-time string comparison to avoid timing oracles on hashes. */
export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
