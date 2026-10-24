import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ApiError } from './api-error';

/**
 * Admin routes require a two-factor-verified session. Admins log in without a
 * code only until TOTP is set up; afterwards every session must carry it.
 */
@Injectable()
export class TotpAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (req.user?.role !== 'ADMIN') return true;
    if (req.user?.totpVerified !== true) {
      throw new ApiError({ status: 401, code: 'AUTH_TOTP_REQUIRED', title: 'Two-factor verification required' });
    }
    return true;
  }
}
