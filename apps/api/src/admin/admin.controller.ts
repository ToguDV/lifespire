import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from '../common/roles.decorator';
import { TotpAdminGuard } from '../common/totp-admin.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AdminService } from './admin.service';
import { CreateUserDto, AuditQuery, ListUsersQuery, UpdateUserDto } from './dto';
import { SyncMetrics } from '../sync/sync-metrics';

function ipOf(req: Request): string | undefined {
  // Socket IP only: X-Forwarded-For is client-controlled without trust proxy.
  // Proxy-aware IPs (Caddy) are a follow-up with throttle keying (#56).
  return req.ip;
}

@ApiTags('admin')
@Controller('v1/admin')
@Roles('ADMIN')
@UseGuards(TotpAdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly syncMetrics: SyncMetrics,
  ) {}

  @Get('sync-metrics')
  metrics() {
    return { metrics: this.syncMetrics.snapshot() };
  }

  @Get('users')
  list(@Query() q: ListUsersQuery) {
    return this.admin.list(q.q, q.page ?? 1, q.pageSize ?? 20);
  }

  @Post('users')
  create(@CurrentUser() user: { sub: string }, @Body() dto: CreateUserDto, @Req() req: Request) {
    return this.admin.createUser(user.sub, dto.email, dto.role, ipOf(req));
  }

  @Patch('users/:id')
  update(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: Request,
  ) {
    return this.admin.updateUser(user.sub, id, dto, ipOf(req));
  }

  @Delete('users/:id')
  remove(@CurrentUser() user: { sub: string }, @Param('id') id: string, @Req() req: Request) {
    return this.admin.removeUser(user.sub, id, ipOf(req));
  }

  @Post('users/:id/resend-invite')
  resendInvite(@CurrentUser() user: { sub: string }, @Param('id') id: string, @Req() req: Request) {
    return this.admin.resendInvite(user.sub, id, ipOf(req));
  }

  @Post('users/:id/revoke-invite')
  revokeInvite(@CurrentUser() user: { sub: string }, @Param('id') id: string, @Req() req: Request) {
    return this.admin.revokeInvite(user.sub, id, ipOf(req));
  }

  @Post('users/:id/reset-link')
  resetLink(@CurrentUser() user: { sub: string }, @Param('id') id: string, @Req() req: Request) {
    return this.admin.resetLink(user.sub, id, ipOf(req));
  }

  @Post('users/:id/reset-totp')
  resetTotp(@CurrentUser() user: { sub: string }, @Param('id') id: string, @Req() req: Request) {
    return this.admin.resetTotp(user.sub, id, ipOf(req));
  }

  @Get('audit')
  audit(@CurrentUser() user: { sub: string }, @Query() q: AuditQuery) {
    return this.admin.auditLog(user.sub, q.page ?? 1, q.pageSize ?? 50);
  }
}
