import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AppModule } from './app.module';
import { createEdgeMiddleware } from './http/edge';
import { createSpaMiddleware, resolveWebBuild } from './spa/spa';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  // Edge contract independent of the web build: legacy `/api/*` rewrite and
  // `no-store` on API paths, so an API-only deployment keeps both.
  app.use(createEdgeMiddleware());
  // Bound the JSON body: MAX_REQUEST_BYTES caps the request, the smaller
  // MAX_DOCUMENT_BYTES gate in SyncService caps the document itself.
  // Must run before any route handling.
  app.use(json({ limit: process.env.MAX_REQUEST_BYTES ?? '1mb' }));
  app.use(helmet());
  // The API is the only server in front of the web build (mode A), so it
  // compresses text responses itself instead of relying on the proxy.
  app.use(compression());
  app.use(cookieParser());
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim()),
    credentials: true,
  });
  // Same-origin web build: when WEB_DIST_DIR points at a usable build, the
  // API serves it (static + SPA fallback) so no edge static server is
  // required. API routes always win; unset WEB_DIST_DIR disables this.
  const webBuild = resolveWebBuild(process.env.WEB_DIST_DIR, process.env.NODE_ENV ?? 'development');
  if (webBuild.kind === 'ready') {
    app.use(createSpaMiddleware(webBuild.dir));
    app.get(Logger).log(`Serving web build from ${webBuild.dir}`);
  } else if (webBuild.kind === 'invalid') {
    // Production threw in resolveWebBuild; development keeps serving the API.
    app.get(Logger).warn(`${webBuild.error} — serving API only`);
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

void bootstrap().catch((error: unknown) => {
  // The Nest logger may not be available if boot failed before/while wiring
  // it, so report to stderr directly and exit non-zero for the orchestrator.
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
