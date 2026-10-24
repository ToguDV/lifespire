import { Controller, Delete, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../common/current-user.decorator';
import { ApiError } from '../common/api-error';

@ApiTags('devices')
@Controller('v1/devices')
export class DevicesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: { sub: string; did: string | null }) {
    const rows = await this.prisma.device.findMany({
      where: { userId: user.sub },
      orderBy: { lastSeenAt: 'desc' },
    });
    return rows.map((d) => ({
      id: d.id,
      name: d.name,
      platform: d.platform,
      lastSeenAt: d.lastSeenAt,
      revokedAt: d.revokedAt,
      current: d.id === user.did,
    }));
  }

  @Delete(':id')
  async revoke(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    const row = await this.prisma.device.findFirst({ where: { id, userId: user.sub } });
    if (!row) throw new ApiError({ status: 404, code: 'DEVICE_NOT_FOUND', title: 'Device not found' });
    await this.prisma.$transaction([
      this.prisma.device.update({ where: { id }, data: { revokedAt: new Date() } }),
      this.prisma.refreshSession.updateMany({
        where: { deviceId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }
}
