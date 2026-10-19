import { bytesToHex, hexToBytes, hkdfSha256, utf8Encode } from './hash';

const DAILY_SEED_INFO = utf8Encode('lifespire/daily-seed/v1');
const SALT_HEX_PATTERN = /^[0-9a-fA-F]{64}$/;

/**
 * Derives the deterministic daily seed (ADR-002):
 * `dailySeed = HKDF(userSeedSalt, dayKey + engineVersion)`.
 *
 * `userSeedSalt` is normally a 32-byte hex string; any other non-empty string
 * is treated as UTF-8 so tests and tooling can use readable salts. The result
 * is a 64-character lowercase hex string, ready for `createRng`.
 */
export function deriveDailySeed(
  userSeedSalt: string,
  dayKey: string,
  engineVersion: string,
): string {
  if (userSeedSalt.length === 0) {
    throw new RangeError('userSeedSalt must not be empty');
  }
  if (dayKey.length === 0) {
    throw new RangeError('dayKey must not be empty');
  }
  if (engineVersion.length === 0) {
    throw new RangeError('engineVersion must not be empty');
  }

  const salt = SALT_HEX_PATTERN.test(userSeedSalt)
    ? hexToBytes(userSeedSalt)
    : utf8Encode(userSeedSalt);
  const keyingMaterial = utf8Encode(`${dayKey}${engineVersion}`);

  return bytesToHex(hkdfSha256(keyingMaterial, salt, DAILY_SEED_INFO, 32));
}
