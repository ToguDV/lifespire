import { describe, expect, it } from 'vitest';
import { decryptSecret, deriveKey, encryptSecret, generateRecoveryCodes } from './totp-crypto';

describe('totp-crypto', () => {
  it('round-trips secrets', () => {
    const key = 'k'.repeat(32);
    const enc = encryptSecret('JBSWY3DPEHPK3PXP', key);
    expect(decryptSecret(enc, key)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('fails with the wrong key', () => {
    const enc = encryptSecret('secret', 'a'.repeat(32));
    expect(() => decryptSecret(enc, 'b'.repeat(32))).toThrow();
  });

  it('derives a 32-byte key', () => {
    expect(deriveKey('x'.repeat(32)).length).toBe(32);
  });

  it('generates recovery codes', () => {
    const codes = generateRecoveryCodes(10);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
  });
});
