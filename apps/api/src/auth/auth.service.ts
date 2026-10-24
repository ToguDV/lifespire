import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { ApiError } from '../common/api-error';
import { sha256Hex } from '../common/crypto';
import { PrismaService } from '../prisma/prisma.service';
import { generateInviteToken, INVITE_TOKEN_TTL_MS, RESET_TOKEN_TTL_MS } from './invite-token';
import { isAllowedPasswordLength } from './password-policy';
import { hashPassword, verifyPassword } from './password';
import { decryptSecret, encryptSecret, generateRecoveryCodes } from './totp-crypto';
import { checkTotp, createTotpSecret, totpUri } from './totp';

export const REFRESH_COOKIE = '__Secure-ls_rt';

interface DeviceInfo {
  name: string;
  userAgent?: string;
  platform?: string;
  ip?: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function opaqueToken(): string {
  return randomBytes(32).toString('base64url').replace(/=+$/, '');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private refreshTtlDays(): number {
    return Number(this.config.get('REFRESH_TOKEN_TTL_DAYS', 30));
  }

  private totpKey(): string {
    const key = this.config.get<string>('TOTP_ENCRYPTION_KEY');
    if (!key) throw new Error('TOTP_ENCRYPTION_KEY is not configured');
    return key;
  }

  private signAccess(params: {
    sub: string;
    email: string;
    role: UserRole;
    sid: string;
    did: string | null;
    totpVerified: boolean;
  }): Promise<string> {
    return this.jwt.signAsync({ ...params });
  }

  async login(input: {
    email: string;
    password: string;
    device: DeviceInfo;
    totpCode?: string;
  }): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; role: UserRole; status: UserStatus };
    totpSetupRequired: boolean;
  }> {
    const email = normalizeEmail(input.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    // No enumeration: same error for unknown user and wrong password.
    if (!user?.passwordHash) {
      await verifyPassword('dummy-hash-for-timing', input.password).catch(() => false);
      throw new ApiError({
        status: 401,
        code: 'AUTH_INVALID_CREDENTIALS',
        title: 'Invalid email or password',
      });
    }
    if (user.status === 'DISABLED') {
      throw new ApiError({ status: 403, code: 'USER_DISABLED', title: 'Account is disabled' });
    }
    if (user.status !== 'ACTIVE') {
      throw new ApiError({
        status: 401,
        code: 'AUTH_INVALID_CREDENTIALS',
        title: 'Invalid email or password',
      });
    }

    const ok = await verifyPassword(user.passwordHash, input.password);
    if (!ok) {
      throw new ApiError({
        status: 401,
        code: 'AUTH_INVALID_CREDENTIALS',
        title: 'Invalid email or password',
      });
    }

    const totpEnabled = user.totpEnabledAt !== null;
    if (totpEnabled) {
      if (!input.totpCode) {
        throw new ApiError({ status: 401, code: 'AUTH_TOTP_REQUIRED', title: 'Two-factor code required' });
      }
      await this.verifyTotpOrRecovery(user.id, user.totpSecretEnc, input.totpCode);
    }

    const device = await this.upsertDevice(user.id, input.device);
    const familyId = randomBytes(16).toString('hex');
    const refreshToken = opaqueToken();
    const session = await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        deviceId: device.id,
        familyId,
        tokenHash: sha256Hex(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTtlDays() * 24 * 60 * 60 * 1000),
        ip: input.device.ip ?? null,
        userAgent: input.device.userAgent ?? null,
      },
    });

    const totpSetupRequired = user.role === 'ADMIN' && !totpEnabled;
    const accessToken = await this.signAccess({
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: session.id,
      did: device.id,
      totpVerified: totpEnabled,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.audit.log({ actorId: user.id, action: 'auth.login', ip: input.device.ip });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role, status: user.status },
      totpSetupRequired,
    };
  }

  async acceptInvite(input: {
    token: string;
    password: string;
    device: DeviceInfo;
  }): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
    if (!isAllowedPasswordLength(input.password)) {
      throw new ApiError({ status: 422, code: 'VALIDATION_FAILED', title: 'Password too weak' });
    }
    const tokenHash = sha256Hex(input.token);
    const record = await this.prisma.accountToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record || record.type !== 'INVITE') {
      throw new ApiError({ status: 400, code: 'INVITE_INVALID', title: 'Invalid invitation' });
    }
    if (record.usedAt) {
      throw new ApiError({ status: 400, code: 'INVITE_USED', title: 'Invitation already used' });
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new ApiError({ status: 400, code: 'INVITE_EXPIRED', title: 'Invitation expired' });
    }
    const user = record.user;
    if (user.status === 'DISABLED') {
      throw new ApiError({ status: 403, code: 'USER_DISABLED', title: 'Account is disabled' });
    }

    const passwordHash = await hashPassword(input.password);
    const claimed = await this.prisma.accountToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new ApiError({ status: 400, code: 'INVITE_USED', title: 'Invitation already used' });
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, status: 'ACTIVE', activatedAt: new Date() },
    });

    const device = await this.upsertDevice(user.id, input.device);
    const refreshToken = opaqueToken();
    const session = await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        deviceId: device.id,
        familyId: randomBytes(16).toString('hex'),
        tokenHash: sha256Hex(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTtlDays() * 24 * 60 * 60 * 1000),
        ip: input.device.ip ?? null,
        userAgent: input.device.userAgent ?? null,
      },
    });
    const accessToken = await this.signAccess({
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: session.id,
      did: device.id,
      totpVerified: false,
    });
    await this.audit.log({ actorId: user.id, targetId: user.id, action: 'auth.invite_accepted' });
    return { accessToken, refreshToken, userId: user.id };
  }

  async refresh(input: {
    refreshToken: string;
    ip?: string;
    userAgent?: string;
  }): Promise<{ accessToken: string; refreshToken: string; reused: false }> {
    const tokenHash = sha256Hex(input.refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: true, device: true },
    });
    if (!session) {
      throw new ApiError({ status: 401, code: 'AUTH_TOKEN_EXPIRED', title: 'Session expired' });
    }
    // Reuse detection: presenting an already-rotated token compromises the family.
    if (session.rotatedAt || session.revokedAt) {
      await this.prisma.refreshSession.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.log({
        actorId: session.userId,
        action: 'auth.refresh_reused',
        metadata: { familyId: session.familyId },
        ip: input.ip,
      });
      throw new ApiError({ status: 401, code: 'AUTH_REFRESH_REUSED', title: 'Session reused' });
    }
    if (session.expiresAt.getTime() < Date.now()) {
      throw new ApiError({ status: 401, code: 'AUTH_TOKEN_EXPIRED', title: 'Session expired' });
    }
    if (session.user.status === 'DISABLED') {
      throw new ApiError({ status: 403, code: 'USER_DISABLED', title: 'Account is disabled' });
    }
    if (session.device?.revokedAt) {
      throw new ApiError({ status: 401, code: 'DEVICE_REVOKED', title: 'Device revoked' });
    }

    const next = opaqueToken();
    const rotatedAt = new Date();
    const rotation = await this.prisma.refreshSession.updateMany({
      where: { id: session.id, rotatedAt: null, revokedAt: null },
      data: { rotatedAt },
    });
    if (rotation.count === 0) {
      await this.prisma.refreshSession.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.log({
        actorId: session.userId,
        action: 'auth.refresh_reused',
        metadata: { familyId: session.familyId },
        ip: input.ip,
      });
      throw new ApiError({ status: 401, code: 'AUTH_REFRESH_REUSED', title: 'Session reused' });
    }
    await this.prisma.refreshSession.create({
      data: {
        userId: session.userId,
        deviceId: session.deviceId,
        familyId: session.familyId,
        tokenHash: sha256Hex(next),
        expiresAt: new Date(Date.now() + this.refreshTtlDays() * 24 * 60 * 60 * 1000),
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
    const created = await this.prisma.refreshSession.findUniqueOrThrow({
      where: { tokenHash: sha256Hex(next) },
    });
    const totpEnabled = session.user.totpEnabledAt !== null;
    const accessToken = await this.signAccess({
      sub: session.user.id,
      email: session.user.email,
      role: session.user.role,
      sid: created.id,
      did: session.deviceId,
      totpVerified: totpEnabled,
    });
    return { accessToken, refreshToken: next, reused: false };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string): Promise<number> {
    const res = await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({ actorId: userId, action: 'auth.logout_all' });
    return res.count;
  }

  async resetPassword(input: { token: string; password: string }): Promise<void> {
    if (!isAllowedPasswordLength(input.password)) {
      throw new ApiError({ status: 422, code: 'VALIDATION_FAILED', title: 'Password too weak' });
    }
    const tokenHash = sha256Hex(input.token);
    const record = await this.prisma.accountToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record || record.type !== 'PASSWORD_RESET') {
      throw new ApiError({ status: 400, code: 'RESET_INVALID', title: 'Invalid reset link' });
    }
    if (record.usedAt) {
      throw new ApiError({ status: 400, code: 'RESET_USED', title: 'Reset link already used' });
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new ApiError({ status: 400, code: 'RESET_EXPIRED', title: 'Reset link expired' });
    }
    const passwordHash = await hashPassword(input.password);
    const claimed = await this.prisma.accountToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new ApiError({ status: 400, code: 'RESET_USED', title: 'Reset link already used' });
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.refreshSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit.log({ actorId: record.userId, targetId: record.userId, action: 'auth.password_reset' });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    if (!isAllowedPasswordLength(newPassword)) {
      throw new ApiError({ status: 422, code: 'VALIDATION_FAILED', title: 'Password too weak' });
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await verifyPassword(user.passwordHash, currentPassword))) {
      throw new ApiError({
        status: 401,
        code: 'AUTH_INVALID_CREDENTIALS',
        title: 'Current password is incorrect',
      });
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await hashPassword(newPassword) },
      }),
      this.prisma.refreshSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit.log({ actorId: userId, targetId: userId, action: 'auth.password_changed' });
  }

  /** Step 1 of TOTP setup: generates a secret + otpauth URL + one-time recovery codes. */
  async totpSetup(
    userId: string,
    currentPassword: string,
  ): Promise<{ otpauthUrl: string; manualSecret: string; recoveryCodes: string[] }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await verifyPassword(user.passwordHash, currentPassword))) {
      throw new ApiError({
        status: 401,
        code: 'AUTH_INVALID_CREDENTIALS',
        title: 'Current password is incorrect',
      });
    }
    const secret = createTotpSecret();
    const otpauthUrl = totpUri(user.email, secret);
    const recoveryCodes = generateRecoveryCodes(10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecretEnc: encryptSecret(secret, this.totpKey()) },
    });
    // Store hashed recovery codes (replace any previous set).
    await this.prisma.recoveryCode.deleteMany({ where: { userId } });
    await this.prisma.recoveryCode.createMany({
      data: recoveryCodes.map((code) => ({ userId, codeHash: sha256Hex(code) })),
    });
    return { otpauthUrl, manualSecret: secret, recoveryCodes };
  }

  /** Step 2: confirms the authenticator by verifying a code, enabling TOTP. */
  async totpEnable(userId: string, code: string, keepSessionId?: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.totpSecretEnc) {
      throw new ApiError({ status: 400, code: 'AUTH_TOTP_INVALID', title: 'Run setup first' });
    }
    const secret = decryptSecret(user.totpSecretEnc, this.totpKey());
    if (!checkTotp(secret, code)) {
      throw new ApiError({ status: 400, code: 'AUTH_TOTP_INVALID', title: 'Invalid code' });
    }
    await this.prisma.user.update({ where: { id: userId }, data: { totpEnabledAt: new Date() } });
    await this.prisma.refreshSession.updateMany({
      where: keepSessionId
        ? { userId, id: { not: keepSessionId }, revokedAt: null }
        : { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({ actorId: userId, targetId: userId, action: 'auth.totp_enabled' });
  }

  private async verifyTotpOrRecovery(
    userId: string,
    secretEnc: string | null,
    code: string,
  ): Promise<void> {
    if (secretEnc) {
      try {
        const secret = decryptSecret(secretEnc, this.totpKey());
        if (checkTotp(secret, code)) return;
      } catch {
        // Fall through to recovery codes.
      }
    }
    const codeHash = sha256Hex(code);
    const match = await this.prisma.recoveryCode.findUnique({
      where: { userId_codeHash: { userId, codeHash } },
    });
    if (!match || match.usedAt) {
      throw new ApiError({ status: 401, code: 'AUTH_TOTP_INVALID', title: 'Invalid two-factor code' });
    }
    await this.prisma.recoveryCode.update({ where: { id: match.id }, data: { usedAt: new Date() } });
    await this.audit.log({ actorId: userId, action: 'auth.recovery_code_used' });
  }

  private async upsertDevice(userId: string, info: DeviceInfo) {
    const name = info.name.slice(0, 120);
    return this.prisma.device.upsert({
      where: { userId_name: { userId, name } },
      update: {
        lastSeenAt: new Date(),
        ...(info.userAgent !== undefined ? { userAgent: info.userAgent.slice(0, 500) } : {}),
      },
      create: {
        userId,
        name,
        platform: info.platform?.slice(0, 60) ?? null,
        userAgent: info.userAgent?.slice(0, 500) ?? null,
      },
    });
  }

  /** Admin/CLI helper: creates a one-time invite link payload (raw token shown once). */
  static inviteLink(webUrl: string, rawToken: string): string {
    return `${webUrl.replace(/\/$/, '')}/accept-invite#token=${rawToken}`;
  }

  static inviteExpiry(): Date {
    return new Date(Date.now() + INVITE_TOKEN_TTL_MS);
  }

  static resetExpiry(): Date {
    return new Date(Date.now() + RESET_TOKEN_TTL_MS);
  }

  static rawToken(): string {
    return generateInviteToken();
  }
}
