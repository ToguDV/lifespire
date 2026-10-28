import { describe, expect, it } from 'vitest'
import { dayKey, isValidTimeZone } from './dates.js'

describe('isValidTimeZone', () => {
  it('accepts IANA zones and rejects garbage', () => {
    expect(isValidTimeZone('UTC')).toBe(true)
    expect(isValidTimeZone('America/New_York')).toBe(true)
    expect(isValidTimeZone('Europe/Madrid')).toBe(true)
    expect(isValidTimeZone('')).toBe(false)
    expect(isValidTimeZone('Not/AZone')).toBe(false)
    expect(isValidTimeZone('UTC ')).toBe(false)
  })
})

describe('dayKey with timeZone', () => {
  it('keeps device-local behavior without a zone', () => {
    const date = new Date(2026, 9, 24, 12, 0, 0)
    expect(dayKey(date)).toBe('2026-10-24')
    expect(dayKey(date, null)).toBe('2026-10-24')
    expect(dayKey(date, undefined)).toBe('2026-10-24')
  })

  it('resolves the same instant to different keys across zones', () => {
    // 2026-10-24T00:30:00Z is still Oct 23 in New York (UTC-4).
    const instant = new Date('2026-10-24T00:30:00.000Z')
    expect(dayKey(instant, 'UTC')).toBe('2026-10-24')
    expect(dayKey(instant, 'America/New_York')).toBe('2026-10-23')
    expect(dayKey(instant, 'Pacific/Kiritimati')).toBe('2026-10-24')
  })

  it('throws on invalid zones and invalid dates', () => {
    expect(() => dayKey(new Date('2026-10-24T12:00:00Z'), 'Mars/Olympus')).toThrow()
    expect(() => dayKey(new Date(NaN), 'UTC')).toThrow()
  })
})