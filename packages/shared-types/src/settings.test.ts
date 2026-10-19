import { describe, expect, it } from 'vitest';

import { localSettingsSchema } from './settings';

const validSettings = {
  locale: 'es',
  timezone: 'Europe/Madrid',
  dayCloseHour: 4,
  userSeedSalt: 'a'.repeat(64),
  engineVersion: '0.1.0',
};

describe('LocalSettings schema', () => {
  it('parses valid local settings', () => {
    expect(localSettingsSchema.safeParse(validSettings).success).toBe(true);
  });

  it('rejects a seed salt that is not 32 bytes of lowercase hex', () => {
    expect(localSettingsSchema.safeParse({ ...validSettings, userSeedSalt: 'abc' }).success).toBe(
      false,
    );
    expect(
      localSettingsSchema.safeParse({ ...validSettings, userSeedSalt: 'A'.repeat(64) }).success,
    ).toBe(false);
    expect(
      localSettingsSchema.safeParse({ ...validSettings, userSeedSalt: 'a'.repeat(63) }).success,
    ).toBe(false);
  });

  it('rejects a day close hour outside 0-23', () => {
    expect(localSettingsSchema.safeParse({ ...validSettings, dayCloseHour: 24 }).success).toBe(
      false,
    );
    expect(localSettingsSchema.safeParse({ ...validSettings, dayCloseHour: -1 }).success).toBe(
      false,
    );
  });

  it('rejects a missing or empty engine version', () => {
    expect(localSettingsSchema.safeParse({ ...validSettings, engineVersion: '' }).success).toBe(
      false,
    );
    const { engineVersion, ...withoutVersion } = validSettings;
    expect(engineVersion).toBe('0.1.0');
    expect(localSettingsSchema.safeParse(withoutVersion).success).toBe(false);
  });
});
