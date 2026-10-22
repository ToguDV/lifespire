import { describe, expect, it } from 'vitest'
import { MAX_DECISION_LAYERS, MIN_DECISION_LAYERS } from './balance'
import { resolveDecisionLayerCount } from './mapDepth'

describe('resolveDecisionLayerCount', () => {
  it.each([
    [1, 3],
    [2, 4],
    [3, 5],
    [0, 3],
    [4, 5],
    [-1, 3],
    [-7, 3],
  ])('maps %i active goals to %i decision layers', (activeGoals, expected) => {
    expect(resolveDecisionLayerCount(activeGoals)).toBe(expected)
  })

  it('always returns a count inside the configured bounds', () => {
    for (let activeGoals = -10; activeGoals <= 10; activeGoals += 1) {
      const layers = resolveDecisionLayerCount(activeGoals)
      expect(layers).toBeGreaterThanOrEqual(MIN_DECISION_LAYERS)
      expect(layers).toBeLessThanOrEqual(MAX_DECISION_LAYERS)
      expect(Number.isInteger(layers)).toBe(true)
    }
  })
})
