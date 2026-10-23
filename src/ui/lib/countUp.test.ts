import { describe, expect, it } from 'vitest'
import { countUpValue } from './countUp'

describe('countUpValue', () => {
  it('returns the start at progress 0 and the target at progress 1', () => {
    expect(countUpValue(0, 60, 0)).toBe(0)
    expect(countUpValue(0, 60, 1)).toBe(60)
  })

  it('eases out: it covers most of the distance early', () => {
    const halfway = countUpValue(0, 100, 0.5)
    expect(halfway).toBeGreaterThan(50)
    expect(halfway).toBeLessThan(100)
  })

  it('clamps progress outside 0..1', () => {
    expect(countUpValue(10, 20, -0.5)).toBe(10)
    expect(countUpValue(10, 20, 2)).toBe(20)
  })

  it('rounds to whole numbers for counters', () => {
    expect(countUpValue(0, 15, 0.33)).toBe(Math.round(countUpValue(0, 15, 0.33)))
  })
})
