import { z } from 'zod';

import { seedSaltSchema } from './primitives';

/**
 * Local settings persisted in the client before any backend exists.
 *
 * `locale` + `timezone` are `Intl` inputs, `dayCloseHour` is the day boundary
 * (default 04:00), `userSeedSalt` enables offline map generation (ADR-015) and
 * `engineVersion` freezes the generator used for the day's run (ADR-002).
 */
export const localSettingsSchema = z.object({
  locale: z.string().min(2),
  timezone: z.string().min(1),
  dayCloseHour: z.number().int().min(0).max(23),
  userSeedSalt: seedSaltSchema,
  engineVersion: z.string().min(1),
});

export type LocalSettings = z.infer<typeof localSettingsSchema>;
