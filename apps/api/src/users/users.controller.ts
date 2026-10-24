import { Controller, Delete, Get, HttpCode } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../common/current-user.decorator';
import { ApiError } from '../common/api-error';

@ApiTags('me')
@Controller('v1/me')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async me(@CurrentUser() user: { sub: string }) {
    const row = await this.prisma.user.findUnique({ where: { id: user.sub } });
    if (!row || row.status === 'DISABLED') {
      throw new ApiError({ status: 403, code: 'USER_DISABLED', title: 'Account is disabled' });
    }
    return {
      id: row.id,
      email: row.email,
      role: row.role,
      status: row.status,
      totpEnabled: row.totpEnabledAt !== null,
      createdAt: row.createdAt,
    };
  }

  @Get('export')
  async export(@CurrentUser() user: { sub: string }) {
    const row = await this.prisma.user.findUnique({
      where: { id: user.sub },
      include: { document: true, devices: true },
    });
    if (!row) throw new ApiError({ status: 404, code: 'USER_NOT_FOUND', title: 'Not found' });
    return {
      account: { id: row.id, email: row.email, role: row.role, createdAt: row.createdAt },
      document: row.document?.document ?? null,
      documentVersion: row.document ? row.document.version.toString() : null,
      devices: row.devices.map((d) => ({ id: d.id, name: d.name, lastSeenAt: d.lastSeenAt })),
    };
  }

  @Delete()
  @HttpCode(204)
  async remove(@CurrentUser() user: { sub: string }): Promise<void> {
    // Hard delete with cascade; backups expire separately.
    const me = await this.prisma.user.findUnique({ where: { id: user.sub } });
    if (me && me.role === 'ADMIN' && me.status === 'ACTIVE') {
      const remaining = await this.prisma.user.count({
        where: { role: 'ADMIN', status: 'ACTIVE', id: { not: user.sub } },
      });
      if (remaining === 0) {
        throw new ApiError({ status: 400, code: 'FORBIDDEN', title: 'Cannot remove the last active admin' });
      }
    }
    await this.prisma.user.delete({ where: { id: user.sub } });
  }
}
