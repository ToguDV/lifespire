import { describe, expect, it } from 'vitest'
import { formatDayKey, formatShortDayKey, percent, romanDay } from './format'

describe('date labels', () => {
  it('formats local day keys without UTC drift', () => {
    expect(formatShortDayKey('2026-10-22')).toBe('22 Oct')
    expect(formatDayKey('2026-10-22')).toBe('Thursday · 22 Oct')
  })

  it('keeps an invalid key readable', () => {
    expect(formatShortDayKey('not-a-day')).toBe('not-a-day')
    expect(formatDayKey('not-a-day')).toBe('not-a-day')
  })
})

describe('numeric labels', () => {
  it('clamps percentages and maps roman day indexes', () => {
    expect(percent(5, 10)).toBe(50)
    expect(percent(15, 10)).toBe(100)
    expect(percent(1, 0)).toBe(0)
    expect(romanDay(0)).toBe('I')
    expect(romanDay(6)).toBe('VII')
  })
})
