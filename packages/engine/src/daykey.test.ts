import { describe, expect, it } from 'vitest';

import { dayKey } from './daykey';

// Bogotá is UTC-5 (offset -300); India is UTC+5:30 (offset +330).
const BOGOTA = -300;
const INDIA = 330;

describe('dayKey', () => {
  it('keeps 03:59 on the previous game day with closeHour = 4', () => {
    const timestamp = Date.UTC(2026, 9, 19, 8, 59); // 2026-10-19 03:59 in Bogotá
    expect(dayKey(timestamp, BOGOTA, 4)).toBe('2026-10-18');
  });

  it('rolls over at exactly 04:00 local time', () => {
    const timestamp = Date.UTC(2026, 9, 19, 9, 0); // 2026-10-19 04:00 in Bogotá
    expect(dayKey(timestamp, BOGOTA, 4)).toBe('2026-10-19');
  });

  it('handles a month boundary', () => {
    const timestamp = Date.UTC(2026, 10, 1, 8, 0); // 2026-11-01 03:00 in Bogotá
    expect(dayKey(timestamp, BOGOTA, 4)).toBe('2026-10-31');
  });

  it('handles a year boundary', () => {
    const timestamp = Date.UTC(2027, 0, 1, 7, 0); // 2027-01-01 02:00 in Bogotá
    expect(dayKey(timestamp, BOGOTA, 4)).toBe('2026-12-31');
  });

  it('handles a leap day', () => {
    const timestamp = Date.UTC(2028, 2, 1, 8, 0); // 2028-03-01 03:00 in Bogotá
    expect(dayKey(timestamp, BOGOTA, 4)).toBe('2028-02-29');
  });

  it('applies positive offsets such as India (+330)', () => {
    const beforeClose = Date.UTC(2026, 9, 18, 21, 30); // 2026-10-19 03:00 in India
    const afterClose = Date.UTC(2026, 9, 18, 23, 0); // 2026-10-19 04:30 in India
    expect(dayKey(beforeClose, INDIA, 4)).toBe('2026-10-18');
    expect(dayKey(afterClose, INDIA, 4)).toBe('2026-10-19');
  });

  it('uses the plain local date when closeHour is 0', () => {
    const timestamp = Date.UTC(2026, 9, 19, 8, 59);
    expect(dayKey(timestamp, BOGOTA, 0)).toBe('2026-10-19');
  });

  it('works for instants before the Unix epoch', () => {
    expect(dayKey(Date.UTC(1969, 11, 31, 23, 0), 0, 0)).toBe('1969-12-31');
    expect(dayKey(0, 0, 0)).toBe('1970-01-01');
  });

  it('rejects invalid close hours', () => {
    expect(() => dayKey(0, 0, 24)).toThrow(RangeError);
    expect(() => dayKey(0, 0, -1)).toThrow(RangeError);
    expect(() => dayKey(0, 0, 4.5)).toThrow(RangeError);
  });
});
