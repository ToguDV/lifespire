import { describe, expect, it } from 'vitest';

import { bytesToHex, cyrb128, hexToBytes, hmacSha256, sha256, utf8Encode, xmur3 } from './hash';

describe('SHA-256', () => {
  it('matches the FIPS 180-4 "abc" vector', () => {
    expect(bytesToHex(sha256(utf8Encode('abc')))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('matches the empty-string vector', () => {
    expect(bytesToHex(sha256(new Uint8Array(0)))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('hashes messages longer than one block', () => {
    const digest = sha256(utf8Encode('a'.repeat(1000)));
    expect(digest).toHaveLength(32);
    expect(digest).toEqual(sha256(utf8Encode('a'.repeat(1000))));
  });
});

describe('HMAC-SHA-256', () => {
  it('matches RFC 4231 test case 2', () => {
    const key = utf8Encode('Jefe');
    const message = utf8Encode('what do ya want for nothing?');
    expect(bytesToHex(hmacSha256(key, message))).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    );
  });
});

describe('encoding helpers', () => {
  it('round-trips hex bytes', () => {
    const bytes = Uint8Array.from([0x00, 0x0f, 0x80, 0xff]);
    expect(bytesToHex(bytes)).toBe('000f80ff');
    expect(hexToBytes('000f80ff')).toEqual(bytes);
  });

  it('encodes multibyte UTF-8 without TextEncoder', () => {
    expect(bytesToHex(utf8Encode('ñ'))).toBe('c3b1');
    expect(bytesToHex(utf8Encode('😀'))).toBe('f09f9880');
  });
});

describe('string hashes', () => {
  it('xmur3 is deterministic and seed-sensitive', () => {
    const first = xmur3('lifespire');
    const second = xmur3('lifespire');
    const other = xmur3('lifespire!');
    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
    expect(first()).not.toBe(other());
  });

  it('cyrb128 returns four deterministic 32-bit words', () => {
    const a = cyrb128('2026-10-19');
    const b = cyrb128('2026-10-19');
    const c = cyrb128('2026-10-20');
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    for (const word of a) {
      expect(Number.isInteger(word)).toBe(true);
      expect(word).toBeGreaterThanOrEqual(0);
      expect(word).toBeLessThanOrEqual(0xffffffff);
    }
  });
});
