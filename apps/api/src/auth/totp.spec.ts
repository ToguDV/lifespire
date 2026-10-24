import { describe, expect, it } from 'vitest';
import { checkTotp, createTotpSecret, generateCurrentTotp, totpUri } from './totp';

describe('totp adapter', () => {
  it('creates base32 secrets', () => {
    const secret = createTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
  });

  it('builds an otpauth URL', () => {
    const uri = totpUri('user@example.com', 'JBSWY3DPEHPK3PXP');
    expect(uri.startsWith('otpauth://totp/')).toBe(true);
    expect(uri).toContain('LifeSpire');
  });

  it('rejects wrong codes and accepts the current one', () => {
    const secret = createTotpSecret();
    expect(checkTotp(secret, '000000')).toBe(false);
    expect(checkTotp(secret, generateCurrentTotp(secret))).toBe(true);
  });
});
