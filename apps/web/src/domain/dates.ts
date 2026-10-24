const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 86_400_000

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

function componentsOf(key: string): [number, number, number] {
  const match = DAY_KEY_PATTERN.exec(key)
  if (!match) {
    throw new Error(`Invalid day key: "${key}"`)
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/** Returns the local calendar day as `YYYY-MM-DD`, never using UTC. */
export function dayKey(date: Date, timeZone?: string | null): string {
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date')
  }
  if (timeZone === undefined || timeZone === null) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
  }
  if (!isValidTimeZone(timeZone)) {
    throw new Error(`Invalid time zone: "${timeZone}"`)
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: string): string => {
    const part = parts.find((p) => p.type === type)
    if (!part) throw new Error(`Invalid time zone: "${timeZone}"`)
    return part.value
  }
  const key = `${get('year')}-${get('month')}-${get('day')}`
  if (!isDayKey(key)) {
    throw new Error(`Invalid time zone: "${timeZone}"`)
  }
  return key
}

/** Parses a `YYYY-MM-DD` key into a local Date at midnight. */
export function parseDayKey(key: string): Date {
  const [year, month, day] = componentsOf(key)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error(`Invalid day key: "${key}"`)
  }
  return date
}

export function isDayKey(key: string): boolean {
  try {
    parseDayKey(key)
    return true
  } catch {
    return false
  }
}

/** True for real IANA zones (`UTC`, `America/New_York`). Rejects empty and overlong input. */
export function isValidTimeZone(timeZone: string): boolean {
  if (typeof timeZone !== 'string' || timeZone.length === 0 || timeZone.length > 100) {
    return false
  }
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone })
    return true
  } catch {
    return false
  }
}

/** Adds calendar days while keeping the local wall clock, including across DST. */
export function addDays(key: string, days: number): string {
  if (!Number.isInteger(days)) {
    throw new Error('days must be an integer')
  }
  const date = parseDayKey(key)
  date.setDate(date.getDate() + days)
  return dayKey(date)
}

export function compareDayKeys(a: string, b: string): number {
  parseDayKey(a)
  parseDayKey(b)
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/** Difference in calendar days, computed from UTC parts so DST cannot add drift. */
export function daysBetween(from: string, to: string): number {
  parseDayKey(from)
  parseDayKey(to)
  const [fromYear, fromMonth, fromDay] = componentsOf(from)
  const [toYear, toMonth, toDay] = componentsOf(to)
  const fromUtc = Date.UTC(fromYear, fromMonth - 1, fromDay)
  const toUtc = Date.UTC(toYear, toMonth - 1, toDay)
  return Math.round((toUtc - fromUtc) / MS_PER_DAY)
}
