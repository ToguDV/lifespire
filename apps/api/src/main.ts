import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AppModule } from './app.module';
import { createSpaMiddleware, resolveSpaDistDir } from './spa/spa';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  // Bound the JSON body: MAX_REQUEST_BYTES caps the request, the smaller
  // MAX_DOCUMENT_BYTES gate in SyncService caps the document itself.
  // Must run before any route handling.
  app.use(json({ limit: process.env.MAX_REQUEST_BYTES ?? '1mb' }));
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim()),
    credentials: true,
  });
  // Same-origin web build: when WEB_DIST_DIR points at a usable build, the
  // API serves it (static + SPA fallback) so no edge static server is
  // required. API routes always win; unset WEB_DIST_DIR disables this.
  const spaDistDir = resolveSpaDistDir(process.env.WEB_DIST_DIR);
  const spaMiddleware = spaDistDir ? createSpaMiddleware(spaDistDir) : null;
  if (spaMiddleware) {
    app.use(spaMiddleware);
    app.get(Logger).log(`Serving web build from ${spaDistDir}`);
  } else if (process.env.WEB_DIST_DIR) {
    app.get(Logger).warn(
      `WEB_DIST_DIR is set but unusable (${process.env.WEB_DIST_DIR}) — serving API only`,
    );
  }
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

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('LifeSpire Sync API')
      .setDescription('Multi-user snapshot sync for LifeSpire. Closed registration; admins invite.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
