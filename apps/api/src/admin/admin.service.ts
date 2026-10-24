import { Injectable } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { ApiError } from '../common/api-error';
import { sha256Hex } from '../common/crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  private webUrl(): string {
    return this.config.get<string>('PUBLIC_WEB_URL', 'http://localhost:5173');
  }

  /** Re-checks role/status in DB so demotion/disable takes effect immediately. */
  async requireAdmin(adminId: string): Promise<void> {
    const row = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!row || row.role !== 'ADMIN' || row.status !== 'ACTIVE') {
      throw new ApiError({ status: 403, code: 'FORBIDDEN', title: 'Admin access required' });
    }
    if (!row.totpEnabledAt) {
      throw new ApiError({ status: 401, code: 'AUTH_TOTP_REQUIRED', title: 'Two-factor setup required' });
    }
  }

  async list(q?: string, page = 1, pageSize = 20) {
    const where =
      q && q.trim().length > 0 ? { email: { contains: q.trim().toLowerCase() } } : {};
    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: Math.min(pageSize, 100),
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
          _count: { select: { devices: true } },
          document: { select: { updatedAt: true, version: true } },
        },
      }),
    ]);
    return {
      total,
      page,
      pageSize,
      users: rows.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        status: u.status,
        deviceCount: u._count.devices,
        lastLoginAt: u.lastLoginAt,
        lastSyncAt: u.document?.updatedAt ?? null,
        createdAt: u.createdAt,
      })),
    };
  }

  async createUser(adminId: string, email: string, role: UserRole, ip?: string) {
    await this.requireAdmin(adminId);
    const normalized = normalizeEmail(email);
    const existing = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (existing) {
      throw new ApiError({ status: 409, code: 'VALIDATION_FAILED', title: 'Email already exists' });
    }
    const rawToken = AuthService.rawToken();
    const user = await this.prisma.user.create({
      data: {
        email: normalized,
        role,
        status: 'PENDING',
        invitedByUserId: adminId,
        invitedAt: new Date(),
      },
    });
    await this.prisma.accountToken.create({
      data: {
        userId: user.id,
        type: 'INVITE',
        tokenHash: sha256Hex(rawToken),
        expiresAt: AuthService.inviteExpiry(),
      },
    });
    await this.audit.log({ actorId: adminId, targetId: user.id, action: 'admin.user_created', metadata: { role }, ip });
    // Manual delivery: raw token is shown ONCE to the admin (no email provider).
    return { id: user.id, email: user.email, inviteLink: AuthService.inviteLink(this.webUrl(), rawToken) };
  }

  async resendInvite(adminId: string, userId: string, ip?: string) {
    await this.requireAdmin(adminId);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.status !== 'PENDING') {
      throw new ApiError({ status: 400, code: 'INVITE_USED', title: 'User already activated' });
    }
    await this.prisma.accountToken.updateMany({
      where: { userId, type: 'INVITE', usedAt: null },
      data: { usedAt: new Date() },
    });
    const rawToken = AuthService.rawToken();
    await this.prisma.accountToken.create({
      data: { userId, type: 'INVITE', tokenHash: sha256Hex(rawToken), expiresAt: AuthService.inviteExpiry() },
    });
    await this.audit.log({ actorId: adminId, targetId: userId, action: 'admin.invite_resent', ip });
    return { inviteLink: AuthService.inviteLink(this.webUrl(), rawToken) };
  }

  async revokeInvite(adminId: string, userId: string, ip?: string) {
    await this.requireAdmin(adminId);
    const res = await this.prisma.accountToken.updateMany({
      where: { userId, type: 'INVITE', usedAt: null },
      data: { usedAt: new Date() },
    });
    await this.audit.log({ actorId: adminId, targetId: userId, action: 'admin.invite_revoked', ip });
    return { revoked: res.count };
  }

  async resetLink(adminId: string, userId: string, ip?: string) {
    await this.requireAdmin(adminId);
    await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const rawToken = AuthService.rawToken();
    await this.prisma.accountToken.create({
      data: { userId, type: 'PASSWORD_RESET', tokenHash: sha256Hex(rawToken), expiresAt: AuthService.resetExpiry() },
    });
    await this.audit.log({ actorId: adminId, targetId: userId, action: 'admin.password_reset_link', ip });
    return { resetLink: `${this.webUrl().replace(/\/$/, '')}/reset-password#token=${rawToken}` };
  }

  async updateUser(adminId: string, userId: string, patch: { role?: UserRole; status?: UserStatus }, ip?: string) {
    await this.requireAdmin(adminId);
    if (patch.role || patch.status === 'DISABLED') {
      await this.guardLastAdmin(userId, patch);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext('lifespire-admin-mutations'))`);
      const row = await tx.user.update({ where: { id: userId }, data: patch });
      if (row.role !== 'ADMIN' || row.status !== 'ACTIVE') {
        const remaining = await tx.user.count({
          where: { role: 'ADMIN', status: 'ACTIVE', id: { not: userId } },
        });
        if (remaining === 0) {
          throw new ApiError({ status: 400, code: 'FORBIDDEN', title: 'Cannot remove the last active admin' });
        }
      }
      return row;
    });
    if (patch.status === 'DISABLED') {
      await this.prisma.refreshSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.audit.log({ actorId: adminId, targetId: userId, action: 'admin.user_updated', metadata: patch, ip });
    return { id: updated.id, role: updated.role, status: updated.status };
  }

  async removeUser(adminId: string, userId: string, ip?: string) {
    await this.requireAdmin(adminId);
    await this.guardLastAdmin(userId, { role: 'USER', status: 'DISABLED' });
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext('lifespire-admin-mutations'))`);
      await tx.user.delete({ where: { id: userId } });
      const remaining = await tx.user.count({
        where: { role: 'ADMIN', status: 'ACTIVE', id: { not: userId } },
      });
      if (remaining === 0) {
        throw new ApiError({ status: 400, code: 'FORBIDDEN', title: 'Cannot remove the last active admin' });
      }
    });
    await this.audit.log({ actorId: adminId, targetId: null, action: 'admin.user_deleted', metadata: { userId }, ip });
    return { ok: true };
  }

  async resetTotp(adminId: string, userId: string, ip?: string) {
    await this.requireAdmin(adminId);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { totpSecretEnc: null, totpEnabledAt: null } }),
      this.prisma.recoveryCode.deleteMany({ where: { userId } }),
    ]);
    await this.audit.log({ actorId: adminId, targetId: userId, action: 'admin.totp_reset', ip });
    return { ok: true };
  }

  async auditLog(adminId: string, page = 1, pageSize = 50) {
    await this.requireAdmin(adminId);
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: Math.min(pageSize, 100),
      }),
    ]);
    return { total, page, pageSize, entries: rows };
  }

  private async guardLastAdmin(userId: string, patch: { role?: UserRole; status?: UserStatus }): Promise<void> {
    const target = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (target.role !== 'ADMIN' || target.status !== 'ACTIVE') return;
    const demotes = patch.role === 'USER';
    const disables = patch.status === 'DISABLED';
    if (!demotes && !disables) return;
    const remaining = await this.prisma.user.count({
      where: { role: 'ADMIN', status: 'ACTIVE', id: { not: userId } },
    });
    if (remaining === 0) {
      throw new ApiError({ status: 400, code: 'FORBIDDEN', title: 'Cannot remove the last active admin' });
    }
  }
}
