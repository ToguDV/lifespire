export interface Rng {
  next(): number
  int(max: number): number
  pick<T>(items: readonly T[]): T
  shuffle<T>(items: readonly T[]): T[]
  weightedPick<T>(items: readonly T[], weightOf: (item: T) => number): T
}

/** FNV-1a 32-bit hash, stable across runs and platforms. */
export function hashString(input: string): number {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** Deterministic mulberry32 generator seeded by a string or a number. */
export function createRng(seed: string | number): Rng {
  let state = (typeof seed === 'number' ? seed : hashString(seed)) >>> 0

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }

  const int = (max: number): number => {
    if (!Number.isInteger(max) || max <= 0) {
      throw new Error('max must be a positive integer')
    }
    return Math.floor(next() * max)
  }

  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) {
      throw new Error('Cannot pick from an empty list')
    }
    return items[int(items.length)] as T
  }

  const shuffle = <T>(items: readonly T[]): T[] => {
    const copy = [...items]
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = int(index + 1)
      const current = copy[index] as T
      copy[index] = copy[swapIndex] as T
      copy[swapIndex] = current
    }
    return copy
  }

  const weightedPick = <T>(items: readonly T[], weightOf: (item: T) => number): T => {
    if (items.length === 0) {
      throw new Error('Cannot pick from an empty list')
    }
    const weights = items.map((item) => {
      const weight = weightOf(item)
      if (!Number.isFinite(weight) || weight < 0) {
        throw new Error('Weights must be finite and non-negative')
      }
      return weight
    })
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    if (total <= 0) {
      throw new Error('At least one weight must be positive')
    }
    const roll = next() * total
    let cumulative = 0
    for (let index = 0; index < items.length; index += 1) {
      cumulative += weights[index] as number
      if (roll < cumulative) {
        return items[index] as T
      }
    }
    return items[items.length - 1] as T
  }

  return { next, int, pick, shuffle, weightedPick }
}
