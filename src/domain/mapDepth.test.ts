import { describe, expect, it } from 'vitest'
import { MAX_DECISION_LAYERS, MIN_DECISION_LAYERS } from './balance'
import { resolveDecisionLayerCount } from './mapDepth'

function depth(goalsWithActiveRoutines: number, weeklyTargetSum: number): number {
  return resolveDecisionLayerCount({ goalsWithActiveRoutines, weeklyTargetSum })
}

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
  ])('maps %i goals with no weekly targets to %i decision layers', (goals, expected) => {
    expect(depth(goals, 0)).toBe(expected)
  })

  it.each([
    [1, 1, 3],
    [1, 6, 3],
    [1, 7, 4],
    [1, 14, 5],
    [2, 7, 5],
    [2, 14, 6],
    [3, 9, 6],
    [4, 16, 9],
    [5, 20, 10],
    [6, 24, 13],
    [7, 28, 15],
    [10, 70, 15],
    [10, 10, 15],
  ])(
    'maps %i goals and %i weekly targets to %i decision layers',
    (goals, weeklyTargetSum, expected) => {
      expect(depth(goals, weeklyTargetSum)).toBe(expected)
    },
  )

  it('ignores negative weekly targets instead of shrinking the map', () => {
    expect(depth(3, -7)).toBe(depth(3, 0))
  })

  it('always returns a count inside the configured bounds', () => {
    for (let goals = -10; goals <= 12; goals += 1) {
      for (const weeklyTargetSum of [-10, 0, 1, 7, 40, 100]) {
        const layers = depth(goals, weeklyTargetSum)
        expect(layers).toBeGreaterThanOrEqual(MIN_DECISION_LAYERS)
        expect(layers).toBeLessThanOrEqual(MAX_DECISION_LAYERS)
        expect(Number.isInteger(layers)).toBe(true)
      }
    }
  })
})
