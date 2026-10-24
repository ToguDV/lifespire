import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim()),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  // API version is part of each controller path (`v1/...`); no URI
  // versioning prefix is applied to avoid double `/v1/v1` routes.
  app.use((req: { headers: Record<string, unknown> }, _res: unknown, next: () => void) => {
    if (!req.headers['x-request-id']) {
      req.headers['x-request-id'] = randomUUID();
    }
    next();
  });

  const config = new DocumentBuilder()
    .setTitle('LifeSpire Sync API')
    .setDescription('Multi-user snapshot sync for LifeSpire. Closed registration; admins invite.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
