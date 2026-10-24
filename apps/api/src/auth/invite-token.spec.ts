import { describe, expect, it } from 'vitest';
import {
  INVITE_TOKEN_BYTES,
  INVITE_TOKEN_TTL_MS,
  isInviteTokenFormat,
} from './invite-token';

describe('invite-token', () => {
  it('exposes token size and TTL constants', () => {
    expect(INVITE_TOKEN_BYTES).toBe(32);
    expect(INVITE_TOKEN_TTL_MS).toBe(72 * 60 * 60 * 1000);
  });

  it('validates token format (base64url, 32 bytes)', () => {
    // 32 random bytes -> 43 base64url chars without padding.
    const valid = 'A'.repeat(43).replace(/A/g, 'a');
    expect(isInviteTokenFormat(valid)).toBe(true);
    expect(isInviteTokenFormat('short')).toBe(false);
    expect(isInviteTokenFormat('')).toBe(false);
    expect(isInviteTokenFormat('a'.repeat(43) + '!')).toBe(false);
    expect(isInviteTokenFormat(null as unknown as string)).toBe(false);
  });
});
