import { describe, expect, it } from 'vitest';
import { isStrongPassword } from './password-policy';

describe('password-policy', () => {
  it('requires at least 12 chars', () => {
    expect(isStrongPassword('short1A!')).toBe(false);
    expect(isStrongPassword('long-enough-password-123')).toBe(true);
    expect(isStrongPassword('')).toBe(false);
    expect(isStrongPassword(null as unknown as string)).toBe(false);
  });

  it('rejects non-strings and overlong input', () => {
    expect(isStrongPassword('a'.repeat(257))).toBe(false);
    expect(isStrongPassword('a'.repeat(256))).toBe(true);
  });
});
