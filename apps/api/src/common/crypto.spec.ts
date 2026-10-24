import { describe, expect, it } from 'vitest';
import { sha256Hex } from './crypto';

describe('crypto', () => {
  it('hashes deterministically', () => {
    expect(sha256Hex('hello')).toBe(sha256Hex('hello'));
    expect(sha256Hex('hello')).not.toBe(sha256Hex('world'));
    expect(sha256Hex('hello')).toMatch(/^[0-9a-f]{64}$/);
  });
});
