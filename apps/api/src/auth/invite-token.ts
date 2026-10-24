import { randomBytes } from 'node:crypto';

export const INVITE_TOKEN_BYTES = 32;
export const INVITE_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/** 32 random bytes encoded as unpadded base64url (43 chars). */
export function generateInviteToken(): string {
  return randomBytes(INVITE_TOKEN_BYTES)
    .toString('base64url')
    .replace(/=+$/, '');
}

export function isInviteTokenFormat(token: string): boolean {
  if (typeof token !== 'string') return false;
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
