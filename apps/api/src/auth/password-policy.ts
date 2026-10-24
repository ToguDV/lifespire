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

// Policy is length 12..256 plus a diversity floor and a small denylist.
// zxcvbn would be stronger; this stays dependency-free for a closed beta.
export function isAllowedPassword(password: string): boolean {
  if (typeof password !== 'string') return false;
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return false;
  }
  if (new Set(password).size < MIN_PASSWORD_ALPHABET) return false;
  const lowered = password.toLowerCase();
  return !DENIED_SUBSTRINGS.some((denied) => lowered.includes(denied));
}
