import { Controller, Delete, Get, Headers, HttpCode, Put, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { CurrentUser } from '../common/current-user.decorator';
import { formatETag } from './sync-version';
import { PutSyncDto, RevisionQuery, WatchQuery } from './dto';
import { Body } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncWatchService } from './sync-watch.service';

@ApiTags('sync')
@Controller('v1/sync')
export class SyncController {
  constructor(
    private readonly sync: SyncService,
    private readonly watch: SyncWatchService,
  ) {}

  @Get()
  async get(
    @CurrentUser() user: { sub: string },
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const out = await this.sync.get(user.sub, ifNoneMatch);
    if (out.notModified) {
      res.status(304).set({ ETag: formatETag(BigInt(out.version)) });
      return;
    }
    res.set({ ETag: formatETag(BigInt(out.version)), 'Cache-Control': 'no-store' });
    return { version: out.version, schemaVersion: out.schemaVersion, document: out.document, updatedAt: out.updatedAt };
  }

  @Put()
  async put(
    @CurrentUser() user: { sub: string; did: string | null },
    @Body() dto: PutSyncDto,
    @Headers('if-match') ifMatch: string | undefined,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const out = await this.sync.put({
      userId: user.sub,
      deviceId: user.did,
      document: dto.document,
      ifMatch,
      ifNoneMatch,
      idempotencyKey,
      ip: req.ip,
    });
    res.set({ ETag: formatETag(BigInt(out.version)), 'Cache-Control': 'no-store' });
    res.status(out.created ? 201 : 200);
    return { version: out.version, updatedAt: out.updatedAt };
  }

  @Get('revisions')
  async revisions(@CurrentUser() user: { sub: string }, @Query() q: RevisionQuery) {
    return { revisions: await this.sync.revisions(user.sub, q.limit ?? 20) };
  }

  /**
   * Long-poll change feed: returns as soon as another device pushes a new
   * version, or the current version after the wait. The document is never
   * sent here; the client pulls it through GET /v1/sync with its ETag.
   */
  @Get('watch')
  // The shared IP bucket would count every client behind Caddy; the service
  // enforces per-user concurrent and per-minute caps instead.
  @SkipThrottle()
  async watchFeed(
    @CurrentUser() user: { sub: string },
    @Query() q: WatchQuery,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.set({ 'Cache-Control': 'no-store' });
    const controller = new AbortController();
    const onClose = (): void => controller.abort();
    req.once('close', onClose);
    try {
      return await this.watch.watch({
        userId: user.sub,
        since: q.since ?? null,
        waitMs: q.wait,
        signal: controller.signal,
      });
    } finally {
      req.off('close', onClose);
    }
  }

  @Delete()
  @HttpCode(204)
  async remove(@CurrentUser() user: { sub: string }) {
    await this.sync.remove(user.sub);
  }
}
