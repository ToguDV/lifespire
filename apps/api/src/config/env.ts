import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  JWT_ISSUER: z.string().default('lifespire'),
  JWT_AUDIENCE: z.string().default('lifespire-web'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(30),
  TOTP_ENCRYPTION_KEY: z.string().min(32, 'TOTP_ENCRYPTION_KEY must be at least 32 chars'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  PUBLIC_WEB_URL: z.string().default('http://localhost:5173'),
  ALLOW_PUBLIC_URL_FALLBACK: z.string().default('false'),
  MAX_DOCUMENT_BYTES: z.coerce.number().int().positive().default(524288),
  MAX_REQUEST_BYTES: z.coerce.number().int().positive().default(1048576),
  // Web build served by the API itself (same-origin, no edge static server
  // needed). Unset/empty disables the static serving; compose sets it.
  WEB_DIST_DIR: z.string().optional(),
  // Long-poll change feed: has to stay below the desktop proxy's 35 s timeout.
  SYNC_WATCH_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30_000).default(25_000),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${details}`);
  }
  const env = parsed.data;
  // Fail closed in production: a localhost PUBLIC_WEB_URL is only allowed
  // when the operator explicitly opts in via ALLOW_PUBLIC_URL_FALLBACK=true.
  if (
    env.NODE_ENV === 'production' &&
    env.PUBLIC_WEB_URL.includes('localhost') &&
    env.ALLOW_PUBLIC_URL_FALLBACK !== 'true'
  ) {
    throw new Error('Invalid environment: PUBLIC_WEB_URL must be set in production');
  }
  return env;
}
