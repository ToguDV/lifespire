import { createHash } from 'node:crypto';

/** SHA-256 hex digest for checksums, token hashes and idempotency keys. */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}
