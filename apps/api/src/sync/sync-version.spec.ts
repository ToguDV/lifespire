import { describe, expect, it } from 'vitest';
import {
  formatETag,
  nextVersion,
  parseETag,
  parseIfMatch,
  shouldIncrementVersion,
} from './sync-version';

describe('sync-version', () => {
  it('formats a version as a strong ETag', () => {
    expect(formatETag(7n)).toBe('"7"');
    expect(formatETag(0n)).toBe('"0"');
  });

  it('parses If-Match headers', () => {
    expect(parseIfMatch('"7"')).toBe(7n);
    expect(parseIfMatch('7')).toBe(7n);
    expect(parseIfMatch('*')).toBe(null);
    expect(parseIfMatch(undefined)).toBe(undefined);
    expect(() => parseIfMatch('"abc"')).toThrow();
    expect(() => parseIfMatch('"-1"')).toThrow();
  });

  it('parses ETag response headers', () => {
    expect(parseETag('"9"')).toBe(9n);
    expect(() => parseETag('W/"9"')).toThrow();
  });

  it('computes the next version', () => {
    expect(nextVersion(0n)).toBe(1n);
    expect(nextVersion(41n)).toBe(42n);
  });

  it('only increments when content actually changed', () => {
    expect(shouldIncrementVersion('aaa', 'aaa')).toBe(false);
    expect(shouldIncrementVersion('aaa', 'bbb')).toBe(true);
  });
});
