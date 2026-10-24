import type { PrismaClient } from '@prisma/client';
import { ApiError } from './api-error';

/**
 * Fail-closed account gate for authenticated handlers. Login and /v1/me
 * already reject DISABLED accounts; sync, devices and export must too, or a
 * previously issued access token keeps working after a disable until it
 * expires. Throws 403 USER_DISABLED (missing rows fail the same way).
 */
export async function requireActiveUser(
  prisma: Pick<PrismaClient, 'user'>,
  userId: string,
): Promise<void> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
  if (!row || row.status !== 'ACTIVE') {
    throw new ApiError({ status: 403, code: 'USER_DISABLED', title: 'Account is disabled' });
  }
}
