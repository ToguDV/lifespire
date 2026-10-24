import { generateSecret, generateSync, generateURI, verifySync } from 'otplib';

/** Thin adapter over otplib v13 functional API (keeps call sites stable). */
export function createTotpSecret(): string {
  return generateSecret();
}

export function totpUri(email: string, secret: string): string {
  return generateURI({ issuer: 'LifeSpire', label: email, secret });
}

export function checkTotp(secret: string, token: string): boolean {
  try {
    return verifySync({ secret, token }).valid;
  } catch {
    return false;
  }
}

/** Test helper: generates the code valid right now for a secret. */
export function generateCurrentTotp(secret: string): string {
  return generateSync({ secret });
}
