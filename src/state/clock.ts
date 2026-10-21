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
