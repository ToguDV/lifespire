import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/public.decorator';
import { AuthService, REFRESH_COOKIE } from './auth.service';
import { AcceptInviteDto, ChangePasswordDto, LoginDto, ResetPasswordDto, TotpVerifyDto } from './dto';
import { CurrentUser } from '../common/current-user.decorator';

function cookieFlags(nodeEnv: string): { secure: boolean; sameSite: 'lax' } {
  return { secure: nodeEnv === 'production', sameSite: 'lax' };
}

function deviceOf(req: Request, name: string) {
  return {
    name,
    userAgent: req.headers['user-agent']?.slice(0, 500),
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip,
  };
}

@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const out = await this.auth.login({
      email: dto.email,
      password: dto.password,
      device: deviceOf(req, dto.deviceName),
      totpCode: dto.totpCode,
    });
    const env = process.env.NODE_ENV ?? 'development';
    res.cookie(REFRESH_COOKIE, out.refreshToken, {
      httpOnly: true,
      ...cookieFlags(env),
      sameSite: 'lax',
      path: '/v1/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    return { accessToken: out.accessToken, user: out.user, totpSetupRequired: out.totpSetupRequired };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('accept-invite')
  async acceptInvite(@Body() dto: AcceptInviteDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const out = await this.auth.acceptInvite({
      token: dto.token,
      password: dto.password,
      device: deviceOf(req, dto.deviceName),
    });
    const env = process.env.NODE_ENV ?? 'development';
    res.cookie(REFRESH_COOKIE, out.refreshToken, {
      httpOnly: true,
      ...cookieFlags(env),
      sameSite: 'lax',
      path: '/v1/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    return { accessToken: out.accessToken };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) {
      const { ApiError } = await import('../common/api-error');
      throw new ApiError({ status: 401, code: 'AUTH_TOKEN_EXPIRED', title: 'Missing refresh token' });
    }
    const out = await this.auth.refresh({
      refreshToken: token,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    const env = process.env.NODE_ENV ?? 'development';
    res.cookie(REFRESH_COOKIE, out.refreshToken, {
      httpOnly: true,
      ...cookieFlags(env),
      sameSite: 'lax',
      path: '/v1/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    return { accessToken: out.accessToken };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentUser() user: { sid: string }, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(user.sid);
    res.clearCookie(REFRESH_COOKIE, { path: '/v1/auth' });
  }

  @Post('logout-all')
  @HttpCode(204)
  async logoutAll(@CurrentUser() user: { sub: string }, @Res({ passthrough: true }) res: Response) {
    await this.auth.logoutAll(user.sub);
    res.clearCookie(REFRESH_COOKIE, { path: '/v1/auth' });
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword({ token: dto.token, password: dto.password });
    return { ok: true };
  }

  @Post('change-password')
  async changePassword(@CurrentUser() user: { sub: string }, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(user.sub, dto.currentPassword, dto.newPassword);
    return { ok: true };
  }

  @Post('totp/setup')
  async totpSetup(@CurrentUser() user: { sub: string }) {
    return this.auth.totpSetup(user.sub);
  }

  @Post('totp/enable')
  async totpEnable(@CurrentUser() user: { sub: string }, @Body() dto: TotpVerifyDto) {
    await this.auth.totpEnable(user.sub, dto.code);
    return { ok: true };
  }
}
