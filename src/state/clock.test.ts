import { afterEach, describe, expect, it } from 'vitest'
import {
  advanceDevDay,
  devNow,
  getDevOffsetDays,
  msUntilNextLocalMidnight,
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

describe('msUntilNextLocalMidnight', () => {
  it('returns the margin when called exactly at local midnight', () => {
    expect(msUntilNextLocalMidnight(new Date(2026, 9, 23, 0, 0, 0))).toBe(1_000)
  })

  it('returns half a day plus the margin at noon', () => {
    expect(msUntilNextLocalMidnight(new Date(2026, 9, 23, 12, 0, 0))).toBe(
      12 * 60 * 60 * 1_000 + 1_000,
    )
  })

  it('returns one second plus the margin just before midnight', () => {
    expect(msUntilNextLocalMidnight(new Date(2026, 9, 23, 23, 59, 59))).toBe(2_000)
  })

  it('uses the local calendar date rather than UTC', () => {
    expect(msUntilNextLocalMidnight(new Date(2026, 5, 15, 18, 30, 0))).toBe(
      5 * 60 * 60 * 1_000 + 30 * 60 * 1_000 + 1_000,
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
