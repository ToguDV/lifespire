/**
 * Seeds N load-test users directly in Postgres and mints bearer tokens for k6.
 * No logins (the login throttle would 429 a hundred sequential sign-ins);
 * JwtAuthGuard only verifies the signature, so HS256 tokens minted here with
 * the API's JWT_SECRET are accepted exactly like issued ones.
 *
 * Usage (from apps/api so @prisma/client resolves):
 *   DATABASE_URL=... JWT_SECRET=... node ../../infra/load/seed.mjs [count] [out]
 * Defaults: 100 users, /tmp/lifespire-load-tokens.json
 */
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';

// @prisma/client lives under apps/api (pnpm isolation); resolve it relative
// to this script so the seed runs from any cwd.
const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { PrismaClient } = requireApi('@prisma/client');
const { PrismaPg } = requireApi('@prisma/adapter-pg');

const count = Number(process.argv[2] ?? 100);
const out = process.argv[3] ?? '/tmp/lifespire-load-tokens.json';
const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) throw new Error('JWT_SECRET (>=32 chars) is required');

const issuer = process.env.JWT_ISSUER ?? 'lifespire';
const audience = process.env.JWT_AUDIENCE ?? 'lifespire-web';

const b64url = (value) => Buffer.from(value).toString('base64url');
function mint(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64url(
    JSON.stringify({ ...payload, iat: now, exp: now + 15 * 60, iss: issuer, aud: audience }),
  );
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
try {
  await prisma.user.deleteMany({ where: { email: { startsWith: 'load-' } } });
  const tokens = [];
  for (let i = 0; i < count; i += 1) {
    const email = `load-${i}@example.com`;
    const user = await prisma.user.create({
      data: { email, role: 'USER', status: 'ACTIVE', activatedAt: new Date() },
    });
    tokens.push({
      email,
      token: mint({
        sub: user.id,
        email,
        role: 'USER',
        sid: 'load',
        did: null,
        totpVerified: true,
      }),
    });
  }
  fs.writeFileSync(out, JSON.stringify(tokens));
  console.log(`seeded ${tokens.length} users -> ${out}`);
} finally {
  await prisma.$disconnect();
}
