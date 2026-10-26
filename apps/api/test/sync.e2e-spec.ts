import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import { generateSync } from 'otplib';
import { randomBytes, randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { hashPassword } from '../src/auth/password';
import { sha256Hex } from '../src/common/crypto';

function doc(payload: Record<string, unknown> = {}) {
  return {
    schemaVersion: 3,
    profile: null,
    goals: [],
    tasks: [],
    run: null,
    onboardingDraft: null,
    settings: { theme: 'system' },
    ...payload,
  };
}

/** Minimal rule-valid goal (passes core parseDocument). */
function goal(id: string) {
  return {
    id,
    title: 'Read',
    category: 'health',
    icon: 'star',
    weeklyObjective: 3,
    active: true,
    createdAt: '2026-10-24T00:00:00.000Z',
  };
}

function refreshCookieOf(res: request.Response): string | undefined {
  const raw = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  return raw.find((c) => c.startsWith('__Secure-ls_rt=') || c.startsWith('ls_rt_dev='))?.split(';')[0];
}

function inviteTokenOf(link: string): string {
  return link.split('#token=')[1] as string;
}

describe('sync API e2e (postgres)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = randomUUID().slice(0, 8);
  const adminEmail = `admin-${suffix}@example.com`;
  const adminPassword = 'admin-password-123';
  let adminToken = '';
  let ipOctet = 20;
  const nextIp = () => `10.7.0.${ipOctet++}`;

  async function adminCreateUser(email: string, role: 'ADMIN' | 'USER') {
    const res = await request(app.getHttpServer())
      .post('/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, role })
      .expect(201);
    return res.body as { id: string; email: string; inviteLink: string };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    // Mirror main.ts: the JSON body parser caps the request (1mb) while the
    // smaller MAX_DOCUMENT_BYTES gate in SyncService caps the document itself.
    app.use(json({ limit: process.env.MAX_REQUEST_BYTES ?? '1mb' }));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    // Let tests isolate per-endpoint throttle buckets via X-Forwarded-For.
    app.getHttpAdapter().getInstance()?.set?.('trust proxy', true);
    prisma = app.get(PrismaService);
    // Clean slate (order respects FKs).
    await prisma.auditLog.deleteMany();
    await prisma.accountToken.deleteMany();
    await prisma.refreshSession.deleteMany();
    await prisma.device.deleteMany();
    await prisma.syncRevision.deleteMany();
    await prisma.syncMutation.deleteMany();
    await prisma.syncDocument.deleteMany();
    await prisma.recoveryCode.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: { email: adminEmail, passwordHash: await hashPassword(adminPassword), role: 'ADMIN', status: 'ACTIVE', activatedAt: new Date() },
    });
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('(a) full flow: admin TOTP, invite, user sync with conflicts and idempotency', async () => {
    const userEmail = `user-a-${suffix}@example.com`;
    const userPassword = 'user-password-123';
    const admin = request.agent(app.getHttpServer());

    // 1. Admin login without TOTP (not set up yet).
    const login1 = await admin
      .post('/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword, deviceName: 'admin-laptop' })
      .expect(200);
    expect(login1.body.totpSetupRequired).toBe(true);
    let adminTok: string = login1.body.accessToken;

    // 2. TOTP setup (requires current password) + enable.
    const setup = await admin
      .post('/v1/auth/totp/setup')
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ currentPassword: adminPassword })
      .expect(201);
    expect(setup.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    const code = generateSync({ secret: setup.body.manualSecret as string });
    await admin.post('/v1/auth/totp/enable').set('Authorization', `Bearer ${adminTok}`).send({ code }).expect(201);

    // 3. Refresh to get a verified session.
    const refreshed = await admin.post('/v1/auth/refresh').expect(200);
    adminTok = refreshed.body.accessToken as string;
    adminToken = adminTok;

    // 4. Non-admin is forbidden from admin routes (prove with a user token later); admin lists users.
    await admin.get('/v1/admin/users').set('Authorization', `Bearer ${adminTok}`).expect(200);

    // 5. Create user -> manual invite link (single-use token in fragment).
    const created = await admin
      .post('/v1/admin/users')
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ email: userEmail, role: 'USER' })
      .expect(201);
    const inviteLink: string = created.body.inviteLink;
    expect(inviteLink).toContain('/accept-invite#token=');
    const inviteToken = inviteTokenOf(inviteLink);

    // 6. Accept invite.
    const user = request.agent(app.getHttpServer());
    await user
      .post('/v1/auth/accept-invite')
      .send({ token: inviteToken, password: userPassword, deviceName: 'phone' })
      .expect(201);

    // 7. Reusing the invite fails.
    await user
      .post('/v1/auth/accept-invite')
      .send({ token: inviteToken, password: userPassword, deviceName: 'phone' })
      .expect(400);

    // 8. User login.
    const userLogin = await user
      .post('/v1/auth/login')
      .send({ email: userEmail, password: userPassword, deviceName: 'phone' })
      .expect(200);
    const userToken: string = userLogin.body.accessToken;

    // 9. User cannot touch admin routes.
    await user.get('/v1/admin/users').set('Authorization', `Bearer ${userToken}`).expect(403);

    // 10. First upload creates version 1.
    const key1 = randomUUID();
    const put1 = await user
      .put('/v1/sync')
      .set('Authorization', `Bearer ${userToken}`)
      .set('If-None-Match', '*')
      .set('Idempotency-Key', key1)
      .send({ document: doc() })
      .expect(201);
    expect(put1.body.version).toBe('1');
    expect(put1.headers.etag).toBe('"1"');

    // 11. Download matches; conditional GET is 304.
    const got = await user.get('/v1/sync').set('Authorization', `Bearer ${userToken}`).expect(200);
    expect(got.body.version).toBe('1');
    expect(got.headers.etag).toBe('"1"');
    await user.get('/v1/sync').set('Authorization', `Bearer ${userToken}`).set('If-None-Match', '"1"').expect(304);

    // 12. Identical content does not bump the version.
    const same = await user
      .put('/v1/sync')
      .set('Authorization', `Bearer ${userToken}`)
      .set('If-Match', '"1"')
      .set('Idempotency-Key', randomUUID())
      .send({ document: doc() })
      .expect(200);
    expect(same.body.version).toBe('1');

    // 13. Changed content bumps to 2.
    const key3 = randomUUID();
    const changed = { ...doc(), goals: [goal('g1')] };
    const put2 = await user
      .put('/v1/sync')
      .set('Authorization', `Bearer ${userToken}`)
      .set('If-Match', '"1"')
      .set('Idempotency-Key', key3)
      .send({ document: changed })
      .expect(200);
    expect(put2.body.version).toBe('2');

    // 14. Stale write conflicts with the current version.
    const conflict = await user
      .put('/v1/sync')
      .set('Authorization', `Bearer ${userToken}`)
      .set('If-Match', '"1"')
      .set('Idempotency-Key', randomUUID())
      .send({ document: doc() })
      .expect(412);
    expect(conflict.body.code).toBe('SYNC_VERSION_CONFLICT');
    expect(conflict.body.currentVersion).toBe('2');

    // 15. Idempotent replay returns the recorded version.
    const replay = await user
      .put('/v1/sync')
      .set('Authorization', `Bearer ${userToken}`)
      .set('If-Match', '"1"')
      .set('Idempotency-Key', key3)
      .send({ document: changed })
      .expect(200);
    expect(replay.body.version).toBe('2');

    // 16. Same key with different content is rejected.
    await user
      .put('/v1/sync')
      .set('Authorization', `Bearer ${userToken}`)
      .set('If-Match', '"2"')
      .set('Idempotency-Key', key3)
      .send({ document: doc() })
      .expect(422);

    // 17. Revisions list the writes.
    const revs = await user.get('/v1/sync/revisions').set('Authorization', `Bearer ${userToken}`).expect(200);
    expect(revs.body.revisions.map((r: { version: string }) => r.version)).toEqual(['2', '1']);

    // 18. Devices: list (with `current` marker) and revoke a second device.
    const devB = request.agent(app.getHttpServer());
    await devB.post('/v1/auth/login').send({ email: userEmail, password: userPassword, deviceName: 'tablet' }).expect(200);
    const devices = await user.get('/v1/devices').set('Authorization', `Bearer ${userToken}`).expect(200);
    const tablet = (devices.body as Array<{ id: string; name: string; current?: boolean }>).find((d) => d.name === 'tablet');
    expect(tablet).toBeDefined();
    expect(devices.body.every((d: { current?: unknown }) => typeof d.current === 'boolean')).toBe(true);
    await user.delete(`/v1/devices/${tablet?.id}`).set('Authorization', `Bearer ${userToken}`).expect(200);
    await devB.post('/v1/auth/refresh').expect(401);

    // 19. Admin disables the user; login is then forbidden.
    const users = await admin.get('/v1/admin/users').set('Authorization', `Bearer ${adminTok}`).expect(200);
    const target = (users.body.users as Array<{ id: string; email: string }>).find((u) => u.email === userEmail);
    await admin.patch(`/v1/admin/users/${target?.id}`).set('Authorization', `Bearer ${adminTok}`).send({ status: 'DISABLED' }).expect(200);
    await user.post('/v1/auth/login').send({ email: userEmail, password: userPassword, deviceName: 'phone' }).expect(403);

    // 19b. The disabled account loses API access even with a live token.
    const disabledSync = await user.get('/v1/sync').set('Authorization', `Bearer ${userToken}`).expect(403);
    expect(disabledSync.body.code).toBe('USER_DISABLED');
    const disabledPut = await user
      .put('/v1/sync')
      .set('Authorization', `Bearer ${userToken}`)
      .set('If-Match', '"2"')
      .set('Idempotency-Key', randomUUID())
      .send({ document: doc() })
      .expect(403);
    expect(disabledPut.body.code).toBe('USER_DISABLED');
    await user.get('/v1/devices').set('Authorization', `Bearer ${userToken}`).expect(403);
    await user.get('/v1/me/export').set('Authorization', `Bearer ${userToken}`).expect(403);

    // 20. The last admin cannot disable itself.
    const me = (users.body.users as Array<{ id: string; email: string }>).find((u) => u.email === adminEmail);
    await admin.patch(`/v1/admin/users/${me?.id}`).set('Authorization', `Bearer ${adminTok}`).send({ status: 'DISABLED' }).expect(400);
  }, 60_000);

  it('(b) reset-password flow revokes sessions and is single-use', async () => {
    const ip = nextIp();
    const email = `user-b-${suffix}@example.com`;
    const oldPw = 'reset-old-pw-123';
    const newPw = 'reset-new-pw-123';
    const created = await adminCreateUser(email, 'USER');
    const inviteToken = inviteTokenOf(created.inviteLink);

    const user = request.agent(app.getHttpServer());
    await user
      .post('/v1/auth/accept-invite')
      .set('X-Forwarded-For', ip)
      .send({ token: inviteToken, password: oldPw, deviceName: 'phone-b' })
      .expect(201);

    const linkRes = await request(app.getHttpServer())
      .post(`/v1/admin/users/${created.id}/reset-link`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    const resetToken = inviteTokenOf(linkRes.body.resetLink as string);

    await request(app.getHttpServer())
      .post('/v1/auth/reset-password')
      .set('X-Forwarded-For', ip)
      .send({ token: resetToken, password: newPw })
      .expect(201);

    // New password works.
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email, password: newPw, deviceName: 'phone-b' })
      .expect(200);
    // Old password is dead.
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email, password: oldPw, deviceName: 'phone-b' })
      .expect(401);
    // Pre-reset sessions are dead.
    await user.post('/v1/auth/refresh').expect(401);
    // Link reuse is rejected as used.
    const reuse = await request(app.getHttpServer())
      .post('/v1/auth/reset-password')
      .set('X-Forwarded-For', ip)
      .send({ token: resetToken, password: 'reset-again-pw-123' })
      .expect(400);
    expect(reuse.body.code).toBe('RESET_USED');
  }, 60_000);

  it('(c) TOTP negatives: required, wrong code, recovery single-use', async () => {
    const ip = nextIp();
    const email = `user-c-${suffix}@example.com`;
    const password = 'totp-user-pw-123';
    const created = await adminCreateUser(email, 'USER');
    const inviteToken = inviteTokenOf(created.inviteLink);

    const agent = request.agent(app.getHttpServer());
    const accepted = await agent
      .post('/v1/auth/accept-invite')
      .set('X-Forwarded-For', ip)
      .send({ token: inviteToken, password, deviceName: 'phone-c' })
      .expect(201);
    const bearer: string = accepted.body.accessToken;

    const setup = await agent
      .post('/v1/auth/totp/setup')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${bearer}`)
      .send({ currentPassword: password })
      .expect(201);
    const secret = setup.body.manualSecret as string;
    const recoveryCodes = setup.body.recoveryCodes as string[];
    expect(recoveryCodes).toHaveLength(10);

    const good = generateSync({ secret });
    await agent
      .post('/v1/auth/totp/enable')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${bearer}`)
      .send({ code: good })
      .expect(201);

    const srv = app.getHttpServer();
    // Login without a code is rejected.
    const missing = await request(srv)
      .post('/v1/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email, password, deviceName: 'phone-c' })
      .expect(401);
    expect(missing.body.code).toBe('AUTH_TOTP_REQUIRED');
    // Wrong code is rejected.
    await request(srv)
      .post('/v1/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email, password, deviceName: 'phone-c', totpCode: '000000' })
      .expect(401);
    // A recovery code works exactly once.
    await request(srv)
      .post('/v1/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email, password, deviceName: 'phone-c', totpCode: recoveryCodes[0] })
      .expect(200);
    await request(srv)
      .post('/v1/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email, password, deviceName: 'phone-c', totpCode: recoveryCodes[0] })
      .expect(401);
  }, 60_000);

  it('(d) sync validation: headers, size, schema and shape gates', async () => {
    const ip = nextIp();
    const email = `user-d-${suffix}@example.com`;
    const password = 'sync-val-pw-1234';
    const created = await adminCreateUser(email, 'USER');
    const inviteToken = inviteTokenOf(created.inviteLink);
    const accepted = await request(app.getHttpServer())
      .post('/v1/auth/accept-invite')
      .set('X-Forwarded-For', ip)
      .send({ token: inviteToken, password, deviceName: 'phone-d' })
      .expect(201);
    const token: string = accepted.body.accessToken;
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    const srv = app.getHttpServer();

    await auth(request(srv).put('/v1/sync'))
      .set('If-None-Match', '*')
      .set('Idempotency-Key', randomUUID())
      .send({ document: doc() })
      .expect(201);

    // Missing If-Match.
    const noMatch = await auth(request(srv).put('/v1/sync'))
      .set('Idempotency-Key', randomUUID())
      .send({ document: doc() })
      .expect(400);
    expect(noMatch.body.code).toBe('VALIDATION_FAILED');

    // Missing Idempotency-Key.
    const noKey = await auth(request(srv).put('/v1/sync'))
      .set('If-Match', '"1"')
      .send({ document: doc() })
      .expect(400);
    expect(noKey.body.code).toBe('IDEMPOTENCY_KEY_MISSING');

    // Oversized document (>512KB, body itself <1MB).
    const bigGoals = Array.from({ length: 700 }, (_, i) => ({ id: `g${i}`, title: 'x'.repeat(1000) }));
    const tooBig = await auth(request(srv).put('/v1/sync'))
      .set('If-Match', '"1"')
      .set('Idempotency-Key', randomUUID())
      .send({ document: doc({ goals: bigGoals }) })
      .expect(413);
    expect(tooBig.body.code).toBe('SYNC_DOCUMENT_TOO_LARGE');

    // Outdated schema.
    const old = await auth(request(srv).put('/v1/sync'))
      .set('If-Match', '"1"')
      .set('Idempotency-Key', randomUUID())
      .send({ document: doc({ schemaVersion: 2 }) })
      .expect(426);
    expect(old.body.code).toBe('SYNC_SCHEMA_OUTDATED');

    // Future schema.
    const future = await auth(request(srv).put('/v1/sync'))
      .set('If-Match', '"1"')
      .set('Idempotency-Key', randomUUID())
      .send({ document: doc({ schemaVersion: 99 }) })
      .expect(422);
    expect(future.body.code).toBe('SYNC_SCHEMA_FUTURE');

    // Malformed document.
    const bad = await auth(request(srv).put('/v1/sync'))
      .set('If-Match', '"1"')
      .set('Idempotency-Key', randomUUID())
      .send({ document: { foo: 'bar' } })
      .expect(422);
    expect(bad.body.code).toBe('SYNC_INVALID_DOCUMENT');

    // Structurally valid but rule-invalid: passes the shape gate, fails core game rules.
    const ruleBroken = await auth(request(srv).put('/v1/sync'))
      .set('If-Match', '"1"')
      .set('Idempotency-Key', randomUUID())
      .send({ document: doc({ goals: [{ id: 'x' }] }) })
      .expect(422);
    expect(ruleBroken.body.code).toBe('SYNC_RULE_VIOLATION');
    expect(ruleBroken.body.detail).toMatch(/goals\[0\]/);
  }, 60_000);

  it('(e) expired invite token is rejected', async () => {
    const ip = nextIp();
    const email = `user-e-${suffix}@example.com`;
    const created = await adminCreateUser(email, 'USER');
    const rawToken = randomBytes(32).toString('base64url').replace(/=+$/, '');
    await prisma.accountToken.create({
      data: {
        userId: created.id,
        type: 'INVITE',
        tokenHash: sha256Hex(rawToken),
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    const res = await request(app.getHttpServer())
      .post('/v1/auth/accept-invite')
      .set('X-Forwarded-For', ip)
      .send({ token: rawToken, password: 'expired-invite-123', deviceName: 'phone-e' })
      .expect(400);
    expect(res.body.code).toBe('INVITE_EXPIRED');
  }, 60_000);

  it('(f) refresh reuse kills the family', async () => {
    const ip = nextIp();
    const email = `user-f-${suffix}@example.com`;
    const password = 'refresh-reuse-123';
    const created = await adminCreateUser(email, 'USER');
    const inviteToken = inviteTokenOf(created.inviteLink);
    const srv = app.getHttpServer();
    await request(srv)
      .post('/v1/auth/accept-invite')
      .set('X-Forwarded-For', ip)
      .send({ token: inviteToken, password, deviceName: 'phone-f' })
      .expect(201);
    const login = await request(srv)
      .post('/v1/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email, password, deviceName: 'phone-f' })
      .expect(200);
    const first = refreshCookieOf(login);
    expect(first).toBeDefined();

    const rotated = await request(srv).post('/v1/auth/refresh').set('Cookie', first as string).expect(200);
    const second = refreshCookieOf(rotated);
    expect(second).toBeDefined();
    expect(second).not.toBe(first);

    const reuse = await request(srv).post('/v1/auth/refresh').set('Cookie', first as string).expect(401);
    expect(reuse.body.code).toBe('AUTH_REFRESH_REUSED');
    // The rotated cookie is dead too (whole family revoked).
    await request(srv).post('/v1/auth/refresh').set('Cookie', second as string).expect(401);
  }, 60_000);

  it('(g) concurrency: one writer and one refresher win', async () => {
    const ip = nextIp();
    const email = `user-g-${suffix}@example.com`;
    const password = 'concurrency-pw-123';
    const created = await adminCreateUser(email, 'USER');
    const inviteToken = inviteTokenOf(created.inviteLink);
    const srv = app.getHttpServer();
    const accepted = await request(srv)
      .post('/v1/auth/accept-invite')
      .set('X-Forwarded-For', ip)
      .send({ token: inviteToken, password, deviceName: 'phone-g' })
      .expect(201);
    const token: string = accepted.body.accessToken;

    await request(srv)
      .put('/v1/sync')
      .set('Authorization', `Bearer ${token}`)
      .set('If-None-Match', '*')
      .set('Idempotency-Key', randomUUID())
      .send({ document: doc() })
      .expect(201);

    const [r1, r2] = await Promise.all([
      request(srv)
        .put('/v1/sync')
        .set('Authorization', `Bearer ${token}`)
        .set('If-Match', '"1"')
        .set('Idempotency-Key', randomUUID())
        .send({ document: doc({ goals: [goal('race-a')] }) }),
      request(srv)
        .put('/v1/sync')
        .set('Authorization', `Bearer ${token}`)
        .set('If-Match', '"1"')
        .set('Idempotency-Key', randomUUID())
        .send({ document: doc({ goals: [goal('race-b')] }) }),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([200, 412]);

    const login = await request(srv)
      .post('/v1/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email, password, deviceName: 'phone-g' })
      .expect(200);
    const cookie = refreshCookieOf(login);
    expect(cookie).toBeDefined();
    const [f1, f2] = await Promise.all([
      request(srv).post('/v1/auth/refresh').set('Cookie', cookie as string),
      request(srv).post('/v1/auth/refresh').set('Cookie', cookie as string),
    ]);
    expect([f1.status, f2.status].sort()).toEqual([200, 401]);
  }, 60_000);

  it('(h) admin self-delete: last admin blocked, second admin can leave', async () => {
    const ip = nextIp();
    const srv = app.getHttpServer();
    await request(srv).delete('/v1/me').set('Authorization', `Bearer ${adminToken}`).expect(400);

    const email = `admin2-h-${suffix}@example.com`;
    const password = 'second-admin-pw-123';
    const created = await adminCreateUser(email, 'ADMIN');
    const inviteToken = inviteTokenOf(created.inviteLink);
    await request(srv)
      .post('/v1/auth/accept-invite')
      .set('X-Forwarded-For', ip)
      .send({ token: inviteToken, password, deviceName: 'laptop-h' })
      .expect(201);
    const login = await request(srv)
      .post('/v1/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email, password, deviceName: 'laptop-h' })
      .expect(200);
    const secondToken: string = login.body.accessToken;
    await request(srv).delete('/v1/me').set('Authorization', `Bearer ${secondToken}`).expect(204);
    // Gone: cannot log in anymore.
    await request(srv)
      .post('/v1/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email, password, deviceName: 'laptop-h' })
      .expect(401);
    // Original admin still works.
    await request(srv).get('/v1/admin/users').set('Authorization', `Bearer ${adminToken}`).expect(200);
  }, 60_000);

  it('(i) audit pagination rejects non-numeric page', async () => {
    await request(app.getHttpServer())
      .get('/v1/admin/audit?page=abc')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  }, 60_000);

  it('(j) totp/enable is rate-limited', async () => {
    const ip = '10.9.9.9';
    const srv = app.getHttpServer();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await request(srv)
        .post('/v1/auth/totp/enable')
        .set('X-Forwarded-For', ip)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: '000000' });
      statuses.push(res.status);
    }
    // Fresh throttle bucket: the first 10 attempts reach the handler (400),
    // the 11th is throttled (429).
    expect(statuses.slice(0, 10).every((s) => s === 400)).toBe(true);
    expect(statuses[10]).toBe(429);
  }, 60_000);

  it('(k) sync metrics count pushes and conflicts', async () => {
    const ip = nextIp();
    const email = `user-k-${suffix}@example.com`;
    const password = 'metrics-pw-1234';
    const srv = app.getHttpServer();
    const created = await adminCreateUser(email, 'USER');
    const accepted = await request(srv)
      .post('/v1/auth/accept-invite')
      .set('X-Forwarded-For', ip)
      .send({ token: inviteTokenOf(created.inviteLink), password, deviceName: 'phone-k' })
      .expect(201);
    const token: string = accepted.body.accessToken;
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

    const before = await request(srv)
      .get('/v1/admin/sync-metrics')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(before.body.metrics.pushes).toBeGreaterThanOrEqual(0);

    await auth(request(srv).put('/v1/sync'))
      .set('If-None-Match', '*')
      .set('Idempotency-Key', randomUUID())
      .send({ document: doc() })
      .expect(201);

    await auth(request(srv).put('/v1/sync'))
      .set('If-Match', '"0"')
      .set('Idempotency-Key', randomUUID())
      .send({ document: doc() })
      .expect(412);

    const after = await request(srv)
      .get('/v1/admin/sync-metrics')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(after.body.metrics.pushes - before.body.metrics.pushes).toBe(1);
    expect(after.body.metrics.created - before.body.metrics.created).toBe(1);
    expect(after.body.metrics.conflicts - before.body.metrics.conflicts).toBe(1);
    expect(after.body.metrics.bytesIn).toBeGreaterThan(before.body.metrics.bytesIn);
    expect(after.body.metrics.avgPushLatencyMs).toBeGreaterThanOrEqual(0);
  }, 60_000);
  it('(l) native refresh grant returns a body token and rejects browser requests', async () => {
    const email = `native-${suffix}@example.com`;
    const password = 'native-password-123';
    await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        role: 'USER',
        status: 'ACTIVE',
        activatedAt: new Date(),
      },
    });
    const ip = nextIp();
    const srv = app.getHttpServer();
    const login = await request(srv)
      .post('/v1/auth/login')
      .set('X-Client-Platform', 'android')
      .set('X-Forwarded-For', ip)
      .send({ email, password, deviceName: 'android-pixel' })
      .expect(200);
    expect(typeof login.body.accessToken).toBe('string');
    expect(typeof login.body.refreshToken).toBe('string');
    expect(login.body.refreshToken.length).toBeGreaterThan(20);

    const rotated = await request(srv)
      .post('/v1/auth/refresh')
      .set('X-Client-Platform', 'android')
      .set('X-Forwarded-For', ip)
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);
    expect(typeof rotated.body.accessToken).toBe('string');
    expect(rotated.body.refreshToken).not.toBe(login.body.refreshToken);

    // A browser-like request cannot use the body token: without the cookie it
    // is treated as a web refresh and fails.
    await request(srv)
      .post('/v1/auth/refresh')
      .set('X-Client-Platform', 'android')
      .set('Origin', 'http://localhost:5173')
      .set('X-Forwarded-For', ip)
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(401);

    // Reuse detection still revokes the family, including the rotated token.
    await request(srv)
      .post('/v1/auth/refresh')
      .set('X-Client-Platform', 'android')
      .set('X-Forwarded-For', ip)
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
    await request(srv)
      .post('/v1/auth/refresh')
      .set('X-Client-Platform', 'android')
      .set('X-Forwarded-For', ip)
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(401);

    // The desktop shell (Electron main process) uses the same grant.
    const desktopIp = nextIp();
    const desktopLogin = await request(srv)
      .post('/v1/auth/login')
      .set('X-Client-Platform', 'desktop')
      .set('X-Forwarded-For', desktopIp)
      .send({ email, password, deviceName: 'desktop-linux' })
      .expect(200);
    expect(typeof desktopLogin.body.refreshToken).toBe('string');
    const desktopRotated = await request(srv)
      .post('/v1/auth/refresh')
      .set('X-Client-Platform', 'desktop')
      .set('X-Forwarded-For', desktopIp)
      .send({ refreshToken: desktopLogin.body.refreshToken })
      .expect(200);
    expect(desktopRotated.body.refreshToken).not.toBe(desktopLogin.body.refreshToken);

    // A browser-shaped request cannot opt into the desktop grant.
    await request(srv)
      .post('/v1/auth/refresh')
      .set('X-Client-Platform', 'desktop')
      .set('Origin', 'lifespire-app://app')
      .set('X-Forwarded-For', desktopIp)
      .send({ refreshToken: desktopRotated.body.refreshToken })
      .expect(401);
  }, 60_000);

  it('(m) logout revokes the whole rotated session family', async () => {
    const email = `family-${suffix}@example.com`;
    const password = 'family-password-123';
    await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        role: 'USER',
        status: 'ACTIVE',
        activatedAt: new Date(),
      },
    });
    const ip = nextIp();
    const srv = app.getHttpServer();
    const login = await request(srv)
      .post('/v1/auth/login')
      .set('X-Client-Platform', 'desktop')
      .set('X-Forwarded-For', ip)
      .send({ email, password, deviceName: 'desktop-family' })
      .expect(200);
    const first = await request(srv)
      .post('/v1/auth/refresh')
      .set('X-Client-Platform', 'desktop')
      .set('X-Forwarded-For', ip)
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);
    const second = await request(srv)
      .post('/v1/auth/refresh')
      .set('X-Client-Platform', 'desktop')
      .set('X-Forwarded-For', ip)
      .send({ refreshToken: first.body.refreshToken })
      .expect(200);

    // Logging out with the original access token must revoke the newer rotated
    // sessions of the same family too, not only the original sid.
    await request(srv)
      .post('/v1/auth/logout')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(204);

    await request(srv)
      .post('/v1/auth/refresh')
      .set('X-Client-Platform', 'desktop')
      .set('X-Forwarded-For', ip)
      .send({ refreshToken: second.body.refreshToken })
      .expect(401);
  }, 60_000);

  it('(n) long-poll watch wakes on a push and never crosses users', async () => {
    const srv = app.getHttpServer();
    const ip = nextIp();

    async function activeUser(email: string, password: string, deviceName: string) {
      await prisma.user.create({
        data: {
          email,
          passwordHash: await hashPassword(password),
          role: 'USER',
          status: 'ACTIVE',
          activatedAt: new Date(),
        },
      });
      const login = await request(srv)
        .post('/v1/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email, password, deviceName })
        .expect(200);
      return login.body.accessToken as string;
    }

    const email = `watch-${suffix}@example.com`;
    const password = 'watch-password-123';
    const token = await activeUser(email, password, 'watch-phone');

    await request(srv)
      .put('/v1/sync')
      .set('Authorization', `Bearer ${token}`)
      .set('If-None-Match', '*')
      .set('Idempotency-Key', randomUUID())
      .send({ document: doc() })
      .expect(201);

    // A second device waits on v1; the first device pushes v2 and wakes it.
    const pending = request(srv)
      .get('/v1/sync/watch?since=1')
      .set('Authorization', `Bearer ${token}`)
      .then((res) => res);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await request(srv)
      .put('/v1/sync')
      .set('Authorization', `Bearer ${token}`)
      .set('If-Match', '"1"')
      .set('Idempotency-Key', randomUUID())
      .send({ document: { ...doc(), goals: [goal('watch-goal')] } })
      .expect(200);

    const woken = await pending;
    expect(woken.status).toBe(200);
    expect(woken.body.version).toBe('2');
    expect(woken.body.updatedAt).toEqual(expect.any(String));

    // Timeout returns the current version without inventing a change.
    const timedOut = await request(srv)
      .get('/v1/sync/watch?since=2&wait=300')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(timedOut.body.version).toBe('2');

    // Another user's pushes (even up to v3) must not wake this watcher.
    const otherToken = await activeUser(
      `watch-other-${suffix}@example.com`,
      password,
      'watch-tablet',
    );
    await request(srv)
      .put('/v1/sync')
      .set('Authorization', `Bearer ${otherToken}`)
      .set('If-None-Match', '*')
      .set('Idempotency-Key', randomUUID())
      .send({ document: doc() })
      .expect(201);
    await request(srv)
      .put('/v1/sync')
      .set('Authorization', `Bearer ${otherToken}`)
      .set('If-Match', '"1"')
      .set('Idempotency-Key', randomUUID())
      .send({ document: { ...doc(), goals: [goal('other-goal')] } })
      .expect(200);
    const isolated = await request(srv)
      .get('/v1/sync/watch?since=2&wait=300')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(isolated.body.version).toBe('2');

    // Deleting the cloud save wakes watchers with a null version.
    const deletedPending = request(srv)
      .get('/v1/sync/watch?since=2')
      .set('Authorization', `Bearer ${token}`)
      .then((res) => res);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await request(srv).delete('/v1/sync').set('Authorization', `Bearer ${token}`).expect(204);
    const deleted = await deletedPending;
    expect(deleted.body).toEqual({ version: null, updatedAt: null });

    await request(srv).get('/v1/sync/watch?since=2').expect(401);
  }, 60_000);

});
