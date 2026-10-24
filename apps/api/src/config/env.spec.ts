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
    expect(env.MAX_REQUEST_BYTES).toBe(1048576);
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

  it('rejects localhost PUBLIC_WEB_URL in production without fallback flag', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(/PUBLIC_WEB_URL/);
    expect(() =>
      validateEnv({ ...base, NODE_ENV: 'production', PUBLIC_WEB_URL: 'http://localhost:5173' }),
    ).toThrow(/PUBLIC_WEB_URL/);
  });

  it('accepts localhost PUBLIC_WEB_URL in production with fallback flag', () => {
    const env = validateEnv({
      ...base,
      NODE_ENV: 'production',
      PUBLIC_WEB_URL: 'http://localhost:5173',
      ALLOW_PUBLIC_URL_FALLBACK: 'true',
    });
    expect(env.PUBLIC_WEB_URL).toBe('http://localhost:5173');
  });

  it('accepts a real PUBLIC_WEB_URL in production', () => {
    const env = validateEnv({
      ...base,
      NODE_ENV: 'production',
      PUBLIC_WEB_URL: 'https://app.example.com',
    });
    expect(env.PUBLIC_WEB_URL).toBe('https://app.example.com');
  });
});
