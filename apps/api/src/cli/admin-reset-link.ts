/** Print a one-time password-reset link for a user. Usage: pnpm admin:reset-link --email user@example.com */
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../app.module';
import { AuthService } from '../auth/auth.service';
import { sha256Hex } from '../common/crypto';
import { PrismaService } from '../prisma/prisma.service';

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function run(): Promise<void> {
  const email = arg('email')?.trim().toLowerCase();
  if (!email) {
    console.error('Usage: pnpm admin:reset-link --email user@example.com');
    process.exit(1);
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const config = app.get(ConfigService);
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error('User not found');
      process.exit(1);
    }
    const raw = AuthService.rawToken();
    await prisma.accountToken.create({
      data: { userId: user.id, type: 'PASSWORD_RESET', tokenHash: sha256Hex(raw), expiresAt: AuthService.resetExpiry() },
    });
    const webUrl = config.get<string>('PUBLIC_WEB_URL', 'http://localhost:5173');
    console.log(`${webUrl.replace(/\/$/, '')}/reset-password#token=${raw}`);
    console.log('Share this link manually. It expires in 1 hour and is single-use.');
  } finally {
    await app.close();
  }
}

void run();
