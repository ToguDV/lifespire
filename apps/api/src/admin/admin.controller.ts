import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from '../common/roles.decorator';
import { TotpAdminGuard } from '../common/totp-admin.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AdminService } from './admin.service';
import { CreateUserDto, ListUsersQuery, UpdateUserDto } from './dto';

function ipOf(req: Request): string | undefined {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip;
}

@ApiTags('admin')
@Controller('v1/admin')
@Roles('ADMIN')
@UseGuards(TotpAdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

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
  audit(@CurrentUser() user: { sub: string }, @Query('page') page?: string) {
    return this.admin.auditLog(user.sub, Number(page ?? 1), 50);
  }
}
