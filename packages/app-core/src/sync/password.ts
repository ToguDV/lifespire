/**
 * Client-side mirror of the length/diversity part of the API password policy
 * (`apps/api/src/auth/password-policy.ts`). The server remains authoritative:
 * it also rejects common phrases and handles the final decision.
 */
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 256;
export const MIN_PASSWORD_ALPHABET = 5;

export function newPasswordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Use at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  if (new Set(password).size < MIN_PASSWORD_ALPHABET) {
    return `Use at least ${MIN_PASSWORD_ALPHABET} different characters.`;
  }
  return null;
}
