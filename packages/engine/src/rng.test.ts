import { describe, expect, it } from 'vitest';

import { createRng } from './rng';

function take(rng: ReturnType<typeof createRng>, count: number): number[] {
  return Array.from({ length: count }, () => rng.next());
}

describe('createRng (xoshiro128**)', () => {
  it('produces the same sequence for the same seed', () => {
    expect(take(createRng('2026-10-19:engine'), 32)).toEqual(
      take(createRng('2026-10-19:engine'), 32),
    );
  });

  it('produces different sequences for different seeds', () => {
    expect(take(createRng('seed-a'), 16)).not.toEqual(take(createRng('seed-b'), 16));
  });

  it('returns floats in [0, 1)', () => {
    const values = take(createRng('range'), 1_000);
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('is not stuck at zero', () => {
    expect(new Set(take(createRng('not-zero'), 50)).size).toBeGreaterThan(1);
  });

  it('nextInt stays within [0, maxExclusive)', () => {
    const rng = createRng('ints');
    for (let i = 0; i < 500; i += 1) {
      const value = rng.nextInt(7);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
    }
  });

  it('nextInt rejects non-positive and non-integer bounds', () => {
    const rng = createRng('ints');
    expect(() => rng.nextInt(0)).toThrow(RangeError);
    expect(() => rng.nextInt(-1)).toThrow(RangeError);
    expect(() => rng.nextInt(1.5)).toThrow(RangeError);
  });

  it('pick returns an item from the array and rejects empty arrays', () => {
    const rng = createRng('pick');
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 50; i += 1) {
      expect(items).toContain(rng.pick(items));
    }
    expect(() => rng.pick([])).toThrow(RangeError);
  });
});
