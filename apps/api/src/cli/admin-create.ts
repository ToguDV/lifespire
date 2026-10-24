/** Bootstrap the first admin. Usage: pnpm admin:create --email admin@example.com [--password ...] */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword } from '../auth/password';

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function run(): Promise<void> {
  const email = arg('email')?.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    console.error('Usage: pnpm admin:create --email admin@example.com [--password <pw>]');
    process.exit(1);
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  try {
    const existingAdmins = await prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      console.error('Email already exists');
      process.exit(1);
    }
    const password = arg('password');
    if (password && password.length < 12) {
      console.error('Password must be at least 12 chars');
      process.exit(1);
    }
    const user = await prisma.user.create({
      data: {
        email,
        role: 'ADMIN',
        status: password ? 'ACTIVE' : 'PENDING',
        passwordHash: password ? await hashPassword(password) : null,
        activatedAt: password ? new Date() : null,
      },
    });
    console.log(`Admin ${existingAdmins === 0 ? '(first) ' : ''}created: ${user.id} ${user.email}`);
    if (!password) {
      console.log('No password set — generate an invite link with: pnpm admin:reset-link --email ' + email);
    } else {
      console.log('Next: log in and complete TOTP setup at POST /v1/auth/totp/setup.');
    }
  } finally {
    await app.close();
  }
}

void run();
