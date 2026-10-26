export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 256;
/** At least this many distinct characters (kills `aaaaaaaaaaaa`-style input). */
export const MIN_PASSWORD_ALPHABET = 5;

/** Notorious weak substrings (case-insensitive); kept short so fixtures stay valid. */
const DENIED_SUBSTRINGS = [
  'aaaaaaaa',
  '12345678',
  'qwertyui',
  'letmein',
  'welcome123',
  'password123',
  'admin123',
  'lifespire',
];

/**
 * Returns an actionable user-facing reason, or null when the password passes.
 * Policy is length 12..256 plus a diversity floor and a small denylist.
 * zxcvbn would be stronger; this stays dependency-free for a closed beta.
 */
export function passwordPolicyIssue(password: string): string | null {
  if (typeof password !== 'string' || password.length === 0) {
    return 'Choose a password.';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Use at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  if (new Set(password).size < MIN_PASSWORD_ALPHABET) {
    return `Use at least ${MIN_PASSWORD_ALPHABET} different characters.`;
  }
  const lowered = password.toLowerCase();
  if (DENIED_SUBSTRINGS.some((denied) => lowered.includes(denied))) {
    return 'Avoid common words or phrases such as "password" or "lifespire".';
  }
  return null;
}

export function isAllowedPassword(password: string): boolean {
  return passwordPolicyIssue(password) === null;
}
