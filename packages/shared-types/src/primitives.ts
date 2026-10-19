import { z } from 'zod';

/** Reusable primitives shared by the DTO schemas. */

/** A non-empty identifier. */
export const idSchema = z.string().min(1);

/** An ISO-8601 date-time string (e.g. `new Date().toISOString()`). */
export const timestampSchema = z.iso.datetime();

/** The per-user seed salt: 32 bytes encoded as 64 lowercase hex characters. */
export const seedSaltSchema = z.string().regex(/^[0-9a-f]{64}$/, {
  message: 'seed salt must be 32 bytes encoded as 64 lowercase hex characters',
});
