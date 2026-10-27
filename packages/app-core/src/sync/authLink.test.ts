import { describe, expect, it } from 'vitest';
import { extractAuthToken, isAuthToken } from './authLink';

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde';

describe('extractAuthToken', () => {
  it('accepts a raw token', () => {
    expect(extractAuthToken(TOKEN)).toBe(TOKEN);
    expect(extractAuthToken(`  ${TOKEN}\n`)).toBe(TOKEN);
  });

  it('reads the fragment of a full reset link', () => {
    expect(extractAuthToken(`https://app.example.com/reset-password#token=${TOKEN}`)).toBe(
      TOKEN,
    );
    expect(extractAuthToken(`https://app.example.com/accept-invite#token=${TOKEN}`)).toBe(
      TOKEN,
    );
  });

  it('reads relative links and query parameters', () => {
    expect(extractAuthToken(`/reset-password#token=${TOKEN}`)).toBe(TOKEN);
    expect(extractAuthToken(`/reset-password?token=${TOKEN}`)).toBe(TOKEN);
    expect(extractAuthToken(`?token=${TOKEN}`)).toBe(TOKEN);
  });

  it('prefers the fragment over the query string', () => {
    expect(
      extractAuthToken(`https://app.example.com/reset-password?token=other#token=${TOKEN}`),
    ).toBe(TOKEN);
  });

  it('ignores extra fragment parameters', () => {
    expect(extractAuthToken(`https://app.example.com/reset-password#token=${TOKEN}&lang=en`)).toBe(
      TOKEN,
    );
  });

  it('strips wrappers used when links are shared by chat or email', () => {
    expect(extractAuthToken(`<https://app.example.com/reset-password#token=${TOKEN}>`)).toBe(
      TOKEN,
    );
    expect(extractAuthToken(`"https://app.example.com/reset-password#token=${TOKEN}"`)).toBe(
      TOKEN,
    );
    expect(extractAuthToken(`'${TOKEN}'`)).toBe(TOKEN);
    expect(extractAuthToken(`\`${TOKEN}\``)).toBe(TOKEN);
  });

  it('returns an empty string for blank input', () => {
    expect(extractAuthToken('')).toBe('');
    expect(extractAuthToken('   \n ')).toBe('');
  });
});

describe('isAuthToken', () => {
  it('accepts the 43-character base64url format', () => {
    expect(TOKEN).toHaveLength(43);
    expect(isAuthToken(TOKEN)).toBe(true);
  });

  it('rejects truncated, padded or foreign values', () => {
    expect(isAuthToken(TOKEN.slice(0, 42))).toBe(false);
    expect(isAuthToken(`${TOKEN}=`)).toBe(false);
    expect(isAuthToken(`${TOKEN}!`)).toBe(false);
    expect(isAuthToken('')).toBe(false);
  });
});
