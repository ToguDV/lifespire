import { describe, expect, it } from 'vitest';
import { validateEnv } from './env';

const base = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/lifespire',
  JWT_SECRET: 'a'.repeat(32),
  TOTP_ENCRYPTION_KEY: 'b'.repeat(32),
};

describe('validateEnv', () => {
  it('applies defaults', () => {
    const env = validateEnv({ ...base });
    expect(env.PORT).toBe(3000);
    expect(env.JWT_ISSUER).toBe('lifespire');
    expect(env.NODE_ENV).toBe('development');
  });

  it('rejects missing DATABASE_URL', () => {
    expect(() => validateEnv({ JWT_SECRET: 'a'.repeat(32), TOTP_ENCRYPTION_KEY: 'b'.repeat(32) })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rejects short secrets', () => {
    expect(() => validateEnv({ ...base, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
    expect(() => validateEnv({ ...base, TOTP_ENCRYPTION_KEY: 'short' })).toThrow(
      /TOTP_ENCRYPTION_KEY/,
    );
  });
});
