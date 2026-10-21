import { afterEach, describe, expect, it } from 'vitest'
import {
  advanceDevDay,
  devNow,
  getDevOffsetDays,
  resetDevClock,
  setDevOffsetDays,
} from './clock'

afterEach(() => {
  resetDevClock()
})

describe('devNow', () => {
  it('shifts calendar days while preserving the local wall clock', () => {
    const base = new Date(2026, 9, 20, 23, 59, 0)
    const shifted = devNow(base, 1)
    expect(shifted.getFullYear()).toBe(2026)
    expect(shifted.getMonth()).toBe(9)
    expect(shifted.getDate()).toBe(21)
    expect(shifted.getHours()).toBe(23)
    expect(shifted.getMinutes()).toBe(59)
    expect(base.getDate()).toBe(20)
  })

  it('crosses months, years and DST boundaries', () => {
    expect(devNow(new Date(2026, 11, 31, 12), 1).getFullYear()).toBe(2027)
    expect(devNow(new Date(2026, 0, 31, 12), 1).getMonth()).toBe(1)
    expect(devNow(new Date(2026, 2, 28, 12), 1).getDate()).toBe(29)
    expect(devNow(new Date(2026, 9, 24, 12), 1).getDate()).toBe(25)
  })

  it('accepts negative offsets and zero', () => {
    expect(devNow(new Date(2026, 0, 1, 10), -1).getDate()).toBe(31)
    expect(devNow(new Date(2026, 0, 1, 10), 0).getTime()).toBe(
      new Date(2026, 0, 1, 10).getTime(),
    )
  })
})

describe('development clock offset', () => {
  it('starts at zero, accepts values and advances', () => {
    expect(getDevOffsetDays()).toBe(0)
    setDevOffsetDays(2)
    expect(getDevOffsetDays()).toBe(2)
    expect(advanceDevDay()).toBe(3)
    expect(advanceDevDay(2)).toBe(5)
    expect(advanceDevDay(-1)).toBe(4)
    resetDevClock()
    expect(getDevOffsetDays()).toBe(0)
  })

  it('rejects non-finite offsets', () => {
    expect(() => setDevOffsetDays(Number.NaN)).toThrow()
    expect(() => devNow(new Date(), Number.POSITIVE_INFINITY)).toThrow()
  })
})
