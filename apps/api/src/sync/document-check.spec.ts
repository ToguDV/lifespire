import { describe, expect, it } from 'vitest';
import { MAX_DOCUMENT_BYTES, MAX_REQUEST_BYTES, checksumDocument } from './document-check';

describe('document-check', () => {
  it('exposes size limits', () => {
    expect(MAX_DOCUMENT_BYTES).toBe(512 * 1024);
    expect(MAX_REQUEST_BYTES).toBe(1024 * 1024);
  });

  it('checksums deterministically', () => {
    const a = checksumDocument({ b: 1, a: 2 });
    const b = checksumDocument({ b: 1, a: 2 });
    const c = checksumDocument({ b: 1, a: 3 });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
