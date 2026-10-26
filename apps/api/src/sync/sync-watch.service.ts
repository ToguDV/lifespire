import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { requireActiveUser } from '../common/require-active';
import { ApiError } from '../common/api-error';

/** Version-only change signal; the document is always fetched by the client. */
export interface SyncWatchResult {
  version: string | null;
  updatedAt: string | null;
}

export interface SyncWatchInput {
  userId: string;
  /** Last version the client already has, or null when it has no cursor. */
  since: string | null;
  /** Overrides the configured wait (tests and short-lived clients). */
  waitMs?: number;
  signal?: AbortSignal;
}

interface Waiter {
  deliver: (result: SyncWatchResult) => void;
}

/** Closed beta: one API process; the caps keep a single user from hoarding requests. */
const MAX_WATCHERS_PER_USER = 16;
const MAX_WATCH_OPENS_PER_MINUTE = 60;
const WATCH_RATE_WINDOW_MS = 60_000;

interface OpenWindow {
  startedAt: number;
  count: number;
}

/**
 * Authenticated long-poll change feed.
 *
 * A watcher registers before the version read so a push that commits in
 * between cannot be missed. On timeout the version is re-read: that catches
 * pushes that arrived while this process was not the notifier (restart or a
 * second API instance), so correctness does not depend on the in-process bus.
 */
@Injectable()
export class SyncWatchService {
  private readonly waiters = new Map<string, Set<Waiter>>();
  private readonly opens = new Map<string, OpenWindow>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  defaultWaitMs(): number {
    return Number(this.config.get('SYNC_WATCH_TIMEOUT_MS', 25_000));
  }

  /** Active watchers for a user (tests and diagnostics). */
  watcherCount(userId: string): number {
    return this.waiters.get(userId)?.size ?? 0;
  }

  /** Wakes every watcher of a user; called after a committed version bump or delete. */
  notify(userId: string, result: SyncWatchResult): void {
    const set = this.waiters.get(userId);
    if (!set || set.size === 0) return;
    this.waiters.delete(userId);
    for (const waiter of set) waiter.deliver(result);
  }

  async watch(input: SyncWatchInput): Promise<SyncWatchResult> {
    // The route skips the global IP throttle (behind Caddy every client shares
    // one bucket) but bounds itself per user: an immediate-answer loop cannot
    // turn 16 in-flight requests into hundreds of DB reads per second.
    this.checkRate(input.userId);
    await requireActiveUser(this.prisma, input.userId);
    const since = input.since === null ? null : BigInt(input.since);
    const slot = this.register(input.userId);
    const configuredWait = this.defaultWaitMs();
    const waitMs = Math.min(input.waitMs ?? configuredWait, configuredWait);
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const current = await this.readVersion(input.userId);
      if (settlesImmediately(current, since)) return current;

      const notified = await Promise.race([
        slot.promise,
        new Promise<null>((resolve) => {
          timer = setTimeout(() => resolve(null), waitMs);
          input.signal?.addEventListener('abort', () => resolve(null), { once: true });
        }),
      ]);
      if (notified) return notified;
      // Timeout or abort: read once more so a change written while another
      // process (or none) owned the notification still reaches this client.
      return await this.readVersion(input.userId);
    } finally {
      if (timer !== null) clearTimeout(timer);
      slot.dispose();
    }
  }

  private async readVersion(userId: string): Promise<SyncWatchResult> {
    const row = await this.prisma.syncDocument.findUnique({
      where: { userId },
      select: { version: true, updatedAt: true },
    });
    if (!row) return { version: null, updatedAt: null };
    return { version: row.version.toString(), updatedAt: row.updatedAt.toISOString() };
  }

  /** Sliding one-minute window per user; evicts on the next request after it expires. */
  private checkRate(userId: string): void {
    const now = Date.now();
    const entry = this.opens.get(userId);
    if (!entry || now - entry.startedAt >= WATCH_RATE_WINDOW_MS) {
      this.opens.set(userId, { startedAt: now, count: 1 });
      return;
    }
    if (entry.count >= MAX_WATCH_OPENS_PER_MINUTE) {
      throw new ApiError({
        status: 429,
        code: 'SYNC_WATCH_LIMIT',
        title: 'Too many sync watch requests',
      });
    }
    entry.count += 1;
  }

  private register(userId: string): {
    promise: Promise<SyncWatchResult | null>;
    dispose: () => void;
  } {
    let set = this.waiters.get(userId);
    if (!set) {
      set = new Set<Waiter>();
      this.waiters.set(userId, set);
    }
    if (set.size >= MAX_WATCHERS_PER_USER) {
      throw new ApiError({
        status: 429,
        code: 'SYNC_WATCH_LIMIT',
        title: 'Too many open sync watchers',
      });
    }

    let resolve!: (result: SyncWatchResult | null) => void;
    const promise = new Promise<SyncWatchResult | null>((r) => {
      resolve = r;
    });
    const waiter: Waiter = { deliver: (result) => resolve(result) };
    set.add(waiter);

    return {
      promise,
      dispose: () => {
        const current = this.waiters.get(userId);
        if (!current) return;
        current.delete(waiter);
        if (current.size === 0) this.waiters.delete(userId);
      },
    };
  }
}

/**
 * A client with no cursor needs the current version; one that already has it
 * only needs to know when the cloud save appears, changes or disappears.
 */
function settlesImmediately(current: SyncWatchResult, since: bigint | null): boolean {
  if (current.version === null) return since !== null;
  if (since === null) return true;
  return BigInt(current.version) > since;
}
