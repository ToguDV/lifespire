import { describe, expect, it } from 'vitest';
import { isAllowedPasswordLength } from './password-policy';

describe('password-policy', () => {
  it('requires at least 12 chars', () => {
    expect(isAllowedPasswordLength('short1A!')).toBe(false);
    expect(isAllowedPasswordLength('long-enough-password-123')).toBe(true);
    expect(isAllowedPasswordLength('')).toBe(false);
    expect(isAllowedPasswordLength(null as unknown as string)).toBe(false);
  });

  it('rejects non-strings and overlong input', () => {
    expect(isAllowedPasswordLength('a'.repeat(257))).toBe(false);
    expect(isAllowedPasswordLength('a'.repeat(256))).toBe(true);
  });
});
