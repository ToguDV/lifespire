import { describe, expect, it } from 'vitest';
import { isNativeClient } from './native-client';

describe('isNativeClient', () => {
  it('accepts the Android app request shape', () => {
    expect(isNativeClient({ headers: { 'x-client-platform': 'android' } })).toBe(true);
  });

  it('accepts the iOS app request shape', () => {
    expect(isNativeClient({ headers: { 'x-client-platform': 'ios' } })).toBe(true);
  });

  it('accepts the desktop shell request shape', () => {
    expect(isNativeClient({ headers: { 'x-client-platform': 'desktop' } })).toBe(true);
  });

  it('rejects the desktop shell when the request looks like a browser', () => {
    expect(
      isNativeClient({
        headers: { 'x-client-platform': 'desktop', origin: 'lifespire-app://app' },
      }),
    ).toBe(false);
    expect(
      isNativeClient({
        headers: { 'x-client-platform': 'desktop', 'sec-fetch-site': 'same-origin' },
      }),
    ).toBe(false);
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
