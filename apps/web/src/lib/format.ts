/**
 * Locale-aware formatting helpers. Every user-visible date, number and list
 * goes through `Intl` (ADR-012) instead of a formatting library.
 */

export function formatInteger(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

export function formatDecimal(value: number, locale: string, fractionDigits = 1): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** Render a close hour (0-23) as a zero-padded `HH:00` clock label. */
export function formatHour(hour: number, locale: string): string {
  const hh = new Intl.NumberFormat(locale, {
    minimumIntegerDigits: 2,
    useGrouping: false,
  }).format(hour);
  return `${hh}:00`;
}

export function formatList(items: string[], locale: string): string {
  return new Intl.ListFormat(locale, { style: 'short', type: 'conjunction' }).format(items);
}
