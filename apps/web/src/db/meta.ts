import { ENGINE_VERSION } from '@lifespire/engine';

import { db, type MetaRecord } from './db';

/** Default day boundary (docs/sync-offline.md §3, ADR-017). */
export const DEFAULT_DAY_CLOSE_HOUR = 4;

/** Only the source locale exists in M0 (ADR-012). */
export const DEFAULT_LOCALE = 'es';

/** Metadata the app needs before it can compute the day's seed. */
export interface DayMeta {
  locale: string;
  timezone: string;
  tzOffsetMinutes: number;
  dayCloseHour: number;
  userSeedSalt: string;
  engineVersion: string;
}

/** 32 random bytes as 64 lowercase hex characters (ADR-015). */
export function generateSeedSalt(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

export function detectTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/**
 * Minutes to add to UTC to get local time (positive east of Greenwich). Engine
 * `dayKey` takes this value as `tzOffsetMinutes` (ADR-017).
 */
export function detectTzOffsetMinutes(date: Date = new Date()): number {
  return -date.getTimezoneOffset();
}

/**
 * Read the persisted metadata, generating anything that is still missing.
 *
 * The `userSeedSalt` is generated exactly once and never rotated (ADR-015);
 * `dayCloseHour` and `locale` are user choices and also set once. The timezone,
 * its offset and the engine version are refreshed on every launch, because they
 * describe the current device and build rather than the user's data.
 */
export async function ensureMeta(): Promise<DayMeta> {
  return db.transaction('rw', db.meta, async () => {
    const rows = await db.meta.toArray();
    const store = new Map(rows.map((row) => [row.key, row.value] as const));

    const putOnce = async (key: string, factory: () => string): Promise<string> => {
      const current = store.get(key);
      if (current !== undefined && current !== '') {
        return current;
      }
      const next = factory();
      store.set(key, next);
      await db.meta.put({ key, value: next });
      return next;
    };

    const putFresh = async (key: string, value: string): Promise<string> => {
      if (store.get(key) !== value) {
        store.set(key, value);
        await db.meta.put({ key, value });
      }
      return value;
    };

    const userSeedSalt = await putOnce('userSeedSalt', generateSeedSalt);
    const dayCloseHourRaw = await putOnce('dayCloseHour', () => String(DEFAULT_DAY_CLOSE_HOUR));
    const locale = await putOnce('locale', () => DEFAULT_LOCALE);
    const timezone = await putFresh('timezone', detectTimezone());
    const tzOffsetMinutesRaw = await putFresh('tzOffsetMinutes', String(detectTzOffsetMinutes()));
    const engineVersion = await putFresh('engineVersion', ENGINE_VERSION);

    return {
      locale,
      timezone,
      tzOffsetMinutes: Number(tzOffsetMinutesRaw),
      dayCloseHour: Number(dayCloseHourRaw),
      userSeedSalt,
      engineVersion,
    } satisfies DayMeta;
  });
}

/** Convenience reader used by tests and diagnostics. */
export async function readMeta(key: string): Promise<string | undefined> {
  const record: MetaRecord | undefined = await db.meta.get(key);
  return record?.value;
}
