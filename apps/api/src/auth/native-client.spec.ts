import { describe, expect, it } from 'vitest';
import { isNativeClient } from './native-client';

describe('isNativeClient', () => {
  it('accepts the Android app request shape', () => {
    expect(isNativeClient({ headers: { 'x-client-platform': 'android' } })).toBe(true);
  });

  it('accepts the iOS app request shape', () => {
    expect(isNativeClient({ headers: { 'x-client-platform': 'ios' } })).toBe(true);
  });

  it('rejects an unknown platform', () => {
    expect(isNativeClient({ headers: { 'x-client-platform': 'web' } })).toBe(false);
  });

  it('rejects requests without the header', () => {
    expect(isNativeClient({ headers: {} })).toBe(false);
  });

  it('rejects browser requests even when the header is forged', () => {
    expect(
      isNativeClient({
        headers: { 'x-client-platform': 'android', origin: 'https://app.example.com' },
      }),
    ).toBe(false);
    expect(
      isNativeClient({
        headers: { 'x-client-platform': 'android', 'sec-fetch-site': 'same-origin' },
      }),
    ).toBe(false);
  });
});
