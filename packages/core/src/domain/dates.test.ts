import { describe, expect, it } from 'vitest'
import {
  addDays,
  compareDayKeys,
  dayKey,
  daysBetween,
  isDayKey,
  parseDayKey,
} from './dates.js'

describe('dayKey', () => {
  it('uses local date components around midnight', () => {
    expect(dayKey(new Date(2026, 0, 31, 23, 59, 59))).toBe('2026-01-31')
    expect(dayKey(new Date(2026, 1, 1, 0, 0, 0))).toBe('2026-02-01')
  })

  it('handles month and year boundaries', () => {
    expect(dayKey(new Date(2026, 11, 31, 12))).toBe('2026-12-31')
    expect(dayKey(new Date(2027, 0, 1, 12))).toBe('2027-01-01')
    expect(dayKey(new Date(2024, 1, 29, 12))).toBe('2024-02-29')
  })

  it('rejects invalid dates', () => {
    expect(() => dayKey(new Date(Number.NaN))).toThrow('Invalid date')
  })
})

describe('parseDayKey', () => {
  it('returns local midnight', () => {
    const date = parseDayKey('2026-10-20')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(9)
    expect(date.getDate()).toBe(20)
    expect(date.getHours()).toBe(0)
    expect(date.getMinutes()).toBe(0)
  })

  it('rejects malformed and non-existent days', () => {
    expect(() => parseDayKey('2026-02-30')).toThrow()
    expect(() => parseDayKey('2026-13-01')).toThrow()
    expect(() => parseDayKey('2026-1-01')).toThrow()
    expect(() => parseDayKey('not-a-day')).toThrow()
    expect(isDayKey('2026-02-28')).toBe(true)
    expect(isDayKey('2026-02-30')).toBe(false)
  })
})

describe('addDays', () => {
  it('crosses months, years and leap days', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01')
  })

  it('keeps the local calendar across common DST transitions', () => {
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08')
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09')
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25')
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02')
  })

  it('rejects fractional offsets', () => {
    expect(() => addDays('2026-01-01', 1.5)).toThrow('integer')
  })
})

describe('compareDayKeys and daysBetween', () => {
  it('orders keys', () => {
    expect(compareDayKeys('2026-01-01', '2026-01-02')).toBe(-1)
    expect(compareDayKeys('2026-01-02', '2026-01-01')).toBe(1)
    expect(compareDayKeys('2026-01-01', '2026-01-01')).toBe(0)
  })

  it('counts calendar days without DST drift', () => {
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0)
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
    expect(daysBetween('2026-01-01', '2026-12-31')).toBe(364)
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2)
    expect(daysBetween('2026-03-08', '2026-03-09')).toBe(1)
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2)
    expect(daysBetween('2027-01-01', '2026-12-31')).toBe(-1)
  })
})
