const MILLIS_PER_MINUTE = 60_000;
const MILLIS_PER_HOUR = 3_600_000;
const MILLIS_PER_DAY = 86_400_000;

function pad(value: number, length: number): string {
  return Math.abs(value).toString().padStart(length, '0');
}

/**
 * Converts days since 1970-01-01 (UTC) to a civil date.
 * Howard Hinnant's `civil_from_days`, integer arithmetic only.
 */
function civilFromDays(daysSinceEpoch: number): { year: number; month: number; day: number } {
  const z = daysSinceEpoch + 719468;
  const era = Math.floor(z / 146097);
  const dayOfEra = z - era * 146097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36524) -
      Math.floor(dayOfEra / 146096)) /
      365,
  );
  const year = yearOfEra + era * 400;
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthPrime = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthPrime + 2) / 5) + 1;
  const month = monthPrime + (monthPrime < 10 ? 3 : -9);
  return { year: year + (month <= 2 ? 1 : 0), month, day };
}

/**
 * User-local `YYYY-MM-DD` at a configurable close hour (ADR-017).
 *
 * The calculation is pure integer arithmetic: it shifts the instant by the
 * caller's UTC offset and back by `closeHour`, then reads the UTC civil date.
 * With `closeHour = 4`, 03:59 on the 19th still belongs to the 18th.
 *
 * @param timestampMs Unix timestamp in milliseconds.
 * @param tzOffsetMinutes Offset from UTC in minutes (Bogotá = -300, India = +330).
 * @param closeHour Local hour at which the game day rolls over (0–23).
 */
export function dayKey(timestampMs: number, tzOffsetMinutes: number, closeHour: number): string {
  if (!Number.isFinite(timestampMs)) {
    throw new RangeError('timestampMs must be a finite number');
  }
  if (!Number.isInteger(tzOffsetMinutes)) {
    throw new RangeError('tzOffsetMinutes must be an integer');
  }
  if (!Number.isInteger(closeHour) || closeHour < 0 || closeHour > 23) {
    throw new RangeError('closeHour must be an integer between 0 and 23');
  }

  const shifted = timestampMs + tzOffsetMinutes * MILLIS_PER_MINUTE - closeHour * MILLIS_PER_HOUR;
  const daysSinceEpoch = Math.floor(shifted / MILLIS_PER_DAY);
  const { year, month, day } = civilFromDays(daysSinceEpoch);

  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}
