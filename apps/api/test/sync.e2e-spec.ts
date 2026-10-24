import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { generateSync } from 'otplib';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { hashPassword } from '../src/auth/password';

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

describe('sync API e2e (postgres)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = randomUUID().slice(0, 8);
  const adminEmail = `admin-${suffix}@example.com`;
  const userEmail = `user-${suffix}@example.com`;
  const adminPassword = 'admin-password-123';
  const userPassword = 'user-password-123';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
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

  it('full flow: admin TOTP, invite, user sync with conflicts and idempotency', async () => {
    const admin = request.agent(app.getHttpServer());

    // 1. Admin login without TOTP (not set up yet).
    const login1 = await admin
      .post('/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword, deviceName: 'admin-laptop' })
      .expect(200);
    expect(login1.body.totpSetupRequired).toBe(true);
    let adminToken: string = login1.body.accessToken;

    // 2. TOTP setup + enable.
    const setup = await admin
      .post('/v1/auth/totp/setup')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(setup.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    const code = generateSync({ secret: setup.body.manualSecret as string });
    await admin.post('/v1/auth/totp/enable').set('Authorization', `Bearer ${adminToken}`).send({ code }).expect(201);

    // 3. Refresh to get a verified session.
    const refreshed = await admin.post('/v1/auth/refresh').expect(200);
    adminToken = refreshed.body.accessToken as string;

    // 4. Non-admin is forbidden from admin routes (prove with a user token later); admin lists users.
    await admin.get('/v1/admin/users').set('Authorization', `Bearer ${adminToken}`).expect(200);

    // 5. Create user -> manual invite link (single-use token in fragment).
    const created = await admin
      .post('/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: userEmail, role: 'USER' })
      .expect(201);
    const inviteLink: string = created.body.inviteLink;
    expect(inviteLink).toContain('/accept-invite#token=');
    const inviteToken = inviteLink.split('#token=')[1] as string;

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
    const changed = { ...doc(), goals: [{ id: 'g1' }] };
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

    // 18. Devices: list and revoke a second device.
    const devB = request.agent(app.getHttpServer());
    await devB.post('/v1/auth/login').send({ email: userEmail, password: userPassword, deviceName: 'tablet' }).expect(200);
    const devices = await user.get('/v1/devices').set('Authorization', `Bearer ${userToken}`).expect(200);
    const tablet = (devices.body as Array<{ id: string; name: string }>).find((d) => d.name === 'tablet');
    expect(tablet).toBeDefined();
    await user.delete(`/v1/devices/${tablet?.id}`).set('Authorization', `Bearer ${userToken}`).expect(200);
    await devB.post('/v1/auth/refresh').expect(401);

    // 19. Admin disables the user; login is then forbidden.
    const users = await admin.get('/v1/admin/users').set('Authorization', `Bearer ${adminToken}`).expect(200);
    const target = (users.body.users as Array<{ id: string; email: string }>).find((u) => u.email === userEmail);
    await admin.patch(`/v1/admin/users/${target?.id}`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'DISABLED' }).expect(200);
    await user.post('/v1/auth/login').send({ email: userEmail, password: userPassword, deviceName: 'phone' }).expect(403);

    // 20. The last admin cannot disable itself.
    const me = (users.body.users as Array<{ id: string; email: string }>).find((u) => u.email === adminEmail);
    await admin.patch(`/v1/admin/users/${me?.id}`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'DISABLED' }).expect(400);
  }, 60_000);
});
