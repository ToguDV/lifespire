import { describe, expect, it } from 'vitest'
import { createRng, hashString } from './rng.js'

function sequence(seed: string, length = 8): number[] {
  const rng = createRng(seed)
  return Array.from({ length }, () => rng.next())
}

describe('hashString', () => {
  it('is stable and distinguishes seeds', () => {
    expect(hashString('lifespire')).toBe(hashString('lifespire'))
    expect(hashString('lifespire')).not.toBe(hashString('lifespire:'))
    expect(hashString('')).toBeTypeOf('number')
    expect(hashString('run:one')).toBeGreaterThanOrEqual(0)
    expect(hashString('run:one')).toBeLessThan(2 ** 32)
  })
})

describe('createRng', () => {
  it('reproduces the same sequence for the same seed', () => {
    expect(sequence('wayfarer')).toEqual(sequence('wayfarer'))
    expect(sequence('wayfarer')).not.toEqual(sequence('craft'))
  })

  it('emits values in [0, 1)', () => {
    const rng = createRng('bounds')
    for (let index = 0; index < 1000; index += 1) {
      const value = rng.next()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('keeps int results inside the requested range', () => {
    const rng = createRng('ints')
    for (let index = 0; index < 1000; index += 1) {
      const value = rng.int(7)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(7)
    }
    expect(() => rng.int(0)).toThrow()
    expect(() => rng.int(-2)).toThrow()
    expect(() => rng.int(1.5)).toThrow()
  })

  it('picks deterministically and rejects empty lists', () => {
    const items = ['a', 'b', 'c', 'd'] as const
    const first = createRng('pick')
    const second = createRng('pick')
    expect(Array.from({ length: 10 }, () => first.pick(items))).toEqual(
      Array.from({ length: 10 }, () => second.pick(items)),
    )
    expect(() => createRng('pick').pick([])).toThrow('empty')
  })

  it('shuffles a copy deterministically', () => {
    const items = [1, 2, 3, 4, 5, 6]
    const first = createRng('shuffle').shuffle(items)
    const second = createRng('shuffle').shuffle(items)
    expect(first).toEqual(second)
    expect(items).toEqual([1, 2, 3, 4, 5, 6])
    expect([...first].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('respects weighted picks and validates weights', () => {
    const items = ['common', 'rare', 'epic'] as const
    const weights = { common: 60, rare: 30, epic: 10 }
    const rng = createRng('weighted')
    for (let index = 0; index < 100; index += 1) {
      expect(items).toContain(rng.weightedPick(items, (item) => weights[item]))
    }
    expect(createRng('only').weightedPick(items, (item) => (item === 'epic' ? 1 : 0))).toBe(
      'epic',
    )
    expect(() => createRng('zero').weightedPick(items, () => 0)).toThrow('positive')
    expect(() => createRng('negative').weightedPick(items, () => -1)).toThrow('non-negative')
    expect(() => createRng('empty').weightedPick([], () => 1)).toThrow('empty')
  })

  it('is deterministic from a numeric seed too', () => {
    const first = createRng(42)
    const second = createRng(42)
    expect(Array.from({ length: 5 }, () => first.next())).toEqual(
      Array.from({ length: 5 }, () => second.next()),
    )
  })
})
