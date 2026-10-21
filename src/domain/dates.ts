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
export function dayKey(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date')
  }
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
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
