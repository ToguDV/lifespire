import { describe, expect, it } from 'vitest';

import { deriveDailySeed } from './seed';

const SALT = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
const DAY = '2026-10-19';
const VERSION = '0.1.0';

describe('deriveDailySeed', () => {
  it('returns a stable 64-character hex seed', () => {
    const seed = deriveDailySeed(SALT, DAY, VERSION);
    expect(seed).toMatch(/^[0-9a-f]{64}$/);
    expect(deriveDailySeed(SALT, DAY, VERSION)).toBe(seed);
  });

  it('is sensitive to the salt', () => {
    expect(deriveDailySeed(SALT, DAY, VERSION)).not.toBe(
      deriveDailySeed('ff'.repeat(32), DAY, VERSION),
    );
  });

  it('is sensitive to the day key', () => {
    expect(deriveDailySeed(SALT, '2026-10-19', VERSION)).not.toBe(
      deriveDailySeed(SALT, '2026-10-20', VERSION),
    );
  });

  it('is sensitive to the engine version', () => {
    expect(deriveDailySeed(SALT, DAY, '0.1.0')).not.toBe(deriveDailySeed(SALT, DAY, '0.1.1'));
  });

  it('accepts non-hex salts as UTF-8', () => {
    expect(deriveDailySeed('local-dev-salt', DAY, VERSION)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects empty inputs', () => {
    expect(() => deriveDailySeed('', DAY, VERSION)).toThrow(RangeError);
    expect(() => deriveDailySeed(SALT, '', VERSION)).toThrow(RangeError);
    expect(() => deriveDailySeed(SALT, DAY, '')).toThrow(RangeError);
  });
});
