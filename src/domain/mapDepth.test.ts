import { describe, expect, it } from 'vitest'
import { MAX_DECISION_LAYERS, MIN_DECISION_LAYERS } from './balance'
import { resolveDecisionLayerCount } from './mapDepth'

describe('resolveDecisionLayerCount', () => {
  it.each([
    [1, 3],
    [2, 4],
    [3, 5],
    [4, 7],
    [5, 8],
    [6, 10],
    [7, 11],
    [8, 13],
    [9, 14],
    [10, 15],
    [0, 3],
    [-1, 3],
    [-7, 3],
    [11, 15],
    [99, 15],
  ])('maps %i goals with routines to %i decision layers', (goals, expected) => {
    expect(resolveDecisionLayerCount(goals)).toBe(expected)
  })

  it('always returns a count inside the configured bounds', () => {
    for (let goals = -10; goals <= 12; goals += 1) {
      const layers = resolveDecisionLayerCount(goals)
      expect(layers).toBeGreaterThanOrEqual(MIN_DECISION_LAYERS)
      expect(layers).toBeLessThanOrEqual(MAX_DECISION_LAYERS)
      expect(Number.isInteger(layers)).toBe(true)
    }
  })
})
