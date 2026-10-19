import { cyrb128 } from './hash';
import type { Rng } from './types';

function rotateLeft(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

/**
 * Deterministic xoshiro128** PRNG seeded through cyrb128.
 *
 * The same seed always produces the same stream on every platform, so map
 * generation and tests are reproducible. `next()` returns floats in [0, 1).
 */
export function createRng(seed: string): Rng {
  const [first, second, third, fourth] = cyrb128(seed);
  let s0 = first;
  let s1 = second;
  let s2 = third;
  let s3 = fourth;

  // xoshiro must never start from the all-zero state.
  if ((s0 | s1 | s2 | s3) === 0) {
    s0 = 1;
  }

  const next = (): number => {
    const result = Math.imul(rotateLeft(Math.imul(s1, 5), 7), 9) >>> 0;
    const t = (s1 << 9) >>> 0;
    s2 = (s2 ^ s0) >>> 0;
    s3 = (s3 ^ s1) >>> 0;
    s1 = (s1 ^ s2) >>> 0;
    s0 = (s0 ^ s3) >>> 0;
    s2 = (s2 ^ t) >>> 0;
    s3 = rotateLeft(s3, 11);
    return result / 4294967296;
  };

  const nextInt = (maxExclusive: number): number => {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError('maxExclusive must be a positive integer');
    }
    return Math.floor(next() * maxExclusive);
  };

  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) {
      throw new RangeError('cannot pick from an empty array');
    }
    return items[nextInt(items.length)] as T;
  };

  return { next, nextInt, pick };
}
