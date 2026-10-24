import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ApiError } from '../common/api-error';
import { sha256Hex } from '../common/crypto';
import { PrismaService } from '../prisma/prisma.service';
import { checksumDocument, IDEMPOTENCY_TTL_DAYS, SYNC_REVISIONS_KEPT } from './document-check';
import { formatETag, nextVersion, parseIfMatch, shouldIncrementVersion } from './sync-version';

/** Server-known schema versions. Must track @lifespire/core SCHEMA_VERSION. */
const SERVER_SCHEMA_VERSION = 3;
const MIN_SUPPORTED_SCHEMA = 3;

function byteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8');
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Robust If-None-Match matcher: accepts `"n"`, `W/"n"`, comma-separated
 * lists, and `*` (matches when the document exists — callers 404 first).
 */
function ifNoneMatchHits(header: string | undefined, version: bigint): boolean {
  if (header === undefined) return false;
  const etag = formatETag(version);
  return header
    .split(',')
    .map((part) => part.trim())
    .some((part) => part === '*' || part === etag || part === `W/${etag}`);
}

/** Detects a Prisma unique-violation raised by the SyncMutation write. */
function isSyncMutationConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const err = error as { code?: unknown; message?: unknown; meta?: unknown };
  if (err.code !== 'P2002') return false;
  if (typeof err.message === 'string' && err.message.includes('SyncMutation')) return true;
  const target = (err.meta as { target?: unknown } | undefined)?.target;
  if (Array.isArray(target)) return target.includes('key');
  return typeof target === 'string' && target.includes('key');
}

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private maxBytes(): number {
    return Number(this.config.get('MAX_DOCUMENT_BYTES', 524288));
  }

  async get(userId: string, ifNoneMatch?: string) {
    const row = await this.prisma.syncDocument.findUnique({ where: { userId } });
    if (!row) {
      throw new ApiError({ status: 404, code: 'SYNC_INVALID_DOCUMENT', title: 'No cloud save' });
    }
    const version = row.version.toString();
    if (ifNoneMatchHits(ifNoneMatch, row.version)) {
      return { notModified: true as const, version, updatedAt: row.updatedAt };
    }
    return {
      notModified: false as const,
      version,
      schemaVersion: row.schemaVersion,
      document: row.document,
      updatedAt: row.updatedAt,
    };
  }

  async put(input: {
    userId: string;
    deviceId: string | null;
    document: unknown;
    ifMatch: string | undefined;
    ifNoneMatch: string | undefined;
    idempotencyKey: string | undefined;
    ip?: string;
  }): Promise<{ version: string; updatedAt: Date; created: boolean }> {
    const { userId, document } = input;
    if (!input.idempotencyKey || !isUuid(input.idempotencyKey)) {
      throw new ApiError({
        status: 400,
        code: 'IDEMPOTENCY_KEY_MISSING',
        title: 'Idempotency-Key header is required (uuid)',
      });
    }
    const size = byteLength(document);
    if (size > this.maxBytes()) {
      throw new ApiError({ status: 413, code: 'SYNC_DOCUMENT_TOO_LARGE', title: 'Document too large' });
    }
    const { schemaVersion, valid, future } = structuralCheck(document);
    if (!valid) {
      throw new ApiError({ status: 422, code: 'SYNC_INVALID_DOCUMENT', title: 'Invalid document' });
    }
    if (future) {
      throw new ApiError({ status: 422, code: 'SYNC_SCHEMA_FUTURE', title: 'Document schema is newer than server' });
    }
    if (schemaVersion < MIN_SUPPORTED_SCHEMA) {
      throw new ApiError({
        status: 426,
        code: 'SYNC_SCHEMA_OUTDATED',
        title: 'App update required',
        detail: `schemaVersion ${schemaVersion} is no longer accepted`,
      });
    }

    const checksum = checksumDocument(document);
    const requestHash = sha256Hex(`${checksum}:${size}`);

    // Idempotency replay: same key + same content returns the recorded version.
    const prior = await this.prisma.syncMutation.findUnique({
      where: { userId_key: { userId, key: input.idempotencyKey } },
    });
    if (prior) {
      if (prior.requestHash !== requestHash) {
        throw new ApiError({
          status: 422,
          code: 'IDEMPOTENCY_KEY_REUSED',
          title: 'Idempotency key already used with different content',
        });
      }
      const doc = await this.prisma.syncDocument.findUniqueOrThrow({ where: { userId } });
      return { version: doc.version.toString(), updatedAt: doc.updatedAt, created: false };
    }

    const createOnly = input.ifNoneMatch?.trim() === '*';
    const expected = createOnly ? null : parseIfMatch(input.ifMatch);
    if (!createOnly && expected === undefined) {
      throw new ApiError({
        status: 400,
        code: 'VALIDATION_FAILED',
        title: 'If-Match header is required',
      });
    }

    const current = await this.prisma.syncDocument.findUnique({ where: { userId } });

    if (createOnly) {
      if (current) return this.conflict(current);
      try {
        const created = await this.prisma.$transaction(async (tx) => {
          const doc = await tx.syncDocument.create({
            data: {
              userId,
              version: 1n,
              schemaVersion,
              document: document as Prisma.InputJsonValue,
              checksum,
              sizeBytes: size,
              updatedByDeviceId: input.deviceId,
            },
          });
          await tx.syncRevision.create({
            data: { userId, version: 1n, schemaVersion, document: document as Prisma.InputJsonValue, checksum, deviceId: input.deviceId },
          });
          await tx.syncMutation.create({
            data: { userId, key: input.idempotencyKey as string, requestHash, version: 1n },
          });
          return doc;
        });
        await this.audit.log({ actorId: userId, action: 'sync.push', metadata: { version: '1' }, ip: input.ip });
        return { version: '1', updatedAt: created.updatedAt, created: true };
      } catch (e) {
        const replayed = await this.replayMutation(userId, input.idempotencyKey as string, requestHash, 'recorded');
        if (replayed) return replayed;
        const fresh = await this.prisma.syncDocument.findUnique({ where: { userId } });
        if (fresh) return this.conflict(fresh);
        throw e;
      }
    }

    if (!current) {
      throw new ApiError({ status: 404, code: 'SYNC_INVALID_DOCUMENT', title: 'No cloud save — use If-None-Match: *' });
    }
    if (expected !== current.version) return this.conflict(current);
    if (!shouldIncrementVersion(current.checksum, checksum)) {
      await this.recordMutation(userId, input.idempotencyKey as string, requestHash, current.version);
      return { version: current.version.toString(), updatedAt: current.updatedAt, created: false };
    }

    // Atomic compare-and-swap: only one concurrent writer wins.
    const target = nextVersion(current.version);
    let res: { version: bigint; updatedAt: Date } | null;
    try {
      res = await this.prisma.$transaction(async (tx) => {
        const swapped = await tx.syncDocument.updateMany({
          where: { userId, version: current.version },
          data: {
            version: target,
            schemaVersion,
            document: document as Prisma.InputJsonValue,
            checksum,
            sizeBytes: size,
            updatedByDeviceId: input.deviceId,
          },
        });
        if (swapped.count === 0) return null;
        await tx.syncRevision.create({
          data: { userId, version: target, schemaVersion, document: document as Prisma.InputJsonValue, checksum, deviceId: input.deviceId },
        });
        await tx.syncMutation.create({
          data: { userId, key: input.idempotencyKey as string, requestHash, version: target },
        });
        // Best-effort pruning inside the same transaction.
        const cutoffRev = target - BigInt(SYNC_REVISIONS_KEPT);
        if (cutoffRev > 0n) {
          await tx.syncRevision.deleteMany({ where: { userId, version: { lte: cutoffRev } } });
        }
        await tx.syncMutation.deleteMany({
          where: { userId, createdAt: { lt: new Date(Date.now() - IDEMPOTENCY_TTL_DAYS * 24 * 60 * 60 * 1000) } },
        });
        return tx.syncDocument.findUniqueOrThrow({ where: { userId } });
      });
    } catch (e) {
      // A concurrent retry may have recorded the same idempotency key first.
      if (!isSyncMutationConflict(e)) throw e;
      const replayed = await this.replayMutation(userId, input.idempotencyKey as string, requestHash, 'current');
      if (replayed) return replayed;
      throw e;
    }
    if (!res) {
      const fresh = await this.prisma.syncDocument.findUnique({ where: { userId } });
      if (fresh) return this.conflict(fresh);
      throw new ApiError({ status: 500, code: 'VALIDATION_FAILED', title: 'Sync failed' });
    }
    await this.audit.log({ actorId: userId, action: 'sync.push', metadata: { version: target.toString() }, ip: input.ip });
    return { version: res.version.toString(), updatedAt: res.updatedAt, created: false };
  }

  async remove(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.syncRevision.deleteMany({ where: { userId } }),
      this.prisma.syncMutation.deleteMany({ where: { userId } }),
      this.prisma.syncDocument.deleteMany({ where: { userId } }),
    ]);
    await this.audit.log({ actorId: userId, action: 'sync.deleted' });
  }

  async revisions(userId: string, limit = 20) {
    const rows = await this.prisma.syncRevision.findMany({
      where: { userId },
      orderBy: { version: 'desc' },
      take: Math.min(Math.max(limit, 1), 50),
      select: { version: true, schemaVersion: true, checksum: true, deviceId: true, createdAt: true },
    });
    return rows.map((r) => ({ ...r, version: r.version.toString() }));
  }

  private conflict(current: { version: bigint; updatedAt: Date }): never {
    throw new ApiError({
      status: 412,
      code: 'SYNC_VERSION_CONFLICT',
      title: 'Sync conflict',
      currentVersion: current.version.toString(),
      currentUpdatedAt: current.updatedAt.toISOString(),
    });
  }

  private async recordMutation(userId: string, key: string, requestHash: string, version: bigint): Promise<void> {
    try {
      await this.prisma.syncMutation.create({ data: { userId, key, requestHash, version } });
    } catch {
      // Concurrent identical retry already recorded — safe to ignore.
    }
  }

  /**
   * Re-reads a previously recorded idempotency mutation: same content replays
   * its version, different content is a 422 key-reuse. Returns null when no
   * mutation was recorded for the key.
   */
  private async replayMutation(
    userId: string,
    key: string,
    requestHash: string,
    versionStyle: 'current' | 'recorded',
  ): Promise<{ version: string; updatedAt: Date; created: boolean } | null> {
    const mutation = await this.prisma.syncMutation.findUnique({
      where: { userId_key: { userId, key } },
    });
    if (!mutation) return null;
    if (mutation.requestHash !== requestHash) {
      throw new ApiError({
        status: 422,
        code: 'IDEMPOTENCY_KEY_REUSED',
        title: 'Idempotency key already used with different content',
      });
    }
    const doc = await this.prisma.syncDocument.findUniqueOrThrow({ where: { userId } });
    const version = versionStyle === 'recorded' ? mutation.version : doc.version;
    return { version: version.toString(), updatedAt: doc.updatedAt, created: false };
  }
}

/** Lightweight structural gate. Full rule validation lives in @lifespire/core on the client. */
export function structuralCheck(document: unknown): { schemaVersion: number; valid: boolean; future: boolean } {
  if (typeof document !== 'object' || document === null || Array.isArray(document)) {
    return { schemaVersion: 0, valid: false, future: false };
  }
  const doc = document as Record<string, unknown>;
  const schemaVersion = doc.schemaVersion;
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion)) {
    return { schemaVersion: 0, valid: false, future: false };
  }
  const hasShape =
    'profile' in doc && 'goals' in doc && 'tasks' in doc && 'run' in doc && 'settings' in doc;
  if (!hasShape) return { schemaVersion, valid: false, future: false };
  if (!Array.isArray(doc.goals) || !Array.isArray(doc.tasks)) {
    return { schemaVersion, valid: false, future: false };
  }
  if (schemaVersion > SERVER_SCHEMA_VERSION) return { schemaVersion, valid: true, future: true };
  return { schemaVersion, valid: true, future: false };
}
