let devOffsetDays = 0

/** Shifts a local date by whole calendar days without changing its wall clock. */
export function devNow(base: Date, offsetDays: number): Date {
  if (!Number.isFinite(offsetDays)) {
    throw new Error('The clock offset must be a finite number of days')
  }
  const shifted = new Date(base.getTime())
  shifted.setDate(shifted.getDate() + Math.trunc(offsetDays))
  return shifted
}

export function getDevOffsetDays(): number {
  return devOffsetDays
}

export function setDevOffsetDays(days: number): void {
  if (!Number.isFinite(days)) {
    throw new Error('The clock offset must be a finite number of days')
  }
  devOffsetDays = Math.trunc(days)
}

export function advanceDevDay(days = 1): number {
  setDevOffsetDays(devOffsetDays + days)
  return devOffsetDays
}

export function resetDevClock(): void {
  devOffsetDays = 0
}

/** Current local time, including the in-memory development offset. */
export function getNow(): Date {
  return devNow(new Date(), devOffsetDays)
}

/** IANA zone of this device (e.g. `Europe/Madrid`). Injected into new runs. */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

const MIDNIGHT_MARGIN_MS = 1_000

/**
 * Milliseconds until the next local midnight, plus a one-second margin so a
 * timer never lands exactly on the day boundary. Uses local date parts so the
 * result follows the player's calendar and respects DST. At exactly midnight
 * the boundary being crossed is "now", so only the margin remains.
 */
export function msUntilNextLocalMidnight(now: Date = getNow()): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (midnight.getTime() < now.getTime()) {
    midnight.setDate(midnight.getDate() + 1)
  }
  return Math.max(0, midnight.getTime() - now.getTime() + MIDNIGHT_MARGIN_MS)
}
