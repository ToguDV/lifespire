import { Injectable } from '@nestjs/common';

/** Write-path outcomes of PUT /v1/sync after the validation gates. */
export type SyncPushOutcome = 'created' | 'updated' | 'noop' | 'replayed' | 'conflict';

export interface SyncMetricsSnapshot {
  /** Write attempts past validation (created + updated + noop + replayed). */
  pushes: number;
  created: number;
  updated: number;
  noop: number;
  replayed: number;
  conflicts: number;
  bytesIn: number;
  avgPushLatencyMs: number;
  maxPushLatencyMs: number;
}

/**
 * In-memory sync counters (closed beta: no metrics backend yet). Validation
 * rejections (400/413/422-shape/422-rule) are client errors, not pushes, and
 * stay out; conflicts are counted because they are version races on the write
 * path. Logged per push as structured pino fields by SyncService.
 */
@Injectable()
export class SyncMetrics {
  private readonly counts: Record<SyncPushOutcome, number> = {
    created: 0,
    updated: 0,
    noop: 0,
    replayed: 0,
    conflict: 0,
  };

  private bytesIn = 0;

  private latencyCount = 0;

  private latencyTotalMs = 0;

  private latencyMaxMs = 0;

  record(outcome: SyncPushOutcome, bytes: number, latencyMs: number): void {
    this.counts[outcome] += 1;
    this.bytesIn += bytes;
    this.latencyCount += 1;
    this.latencyTotalMs += latencyMs;
    this.latencyMaxMs = Math.max(this.latencyMaxMs, latencyMs);
  }

  snapshot(): SyncMetricsSnapshot {
    return {
      pushes:
        this.counts.created + this.counts.updated + this.counts.noop + this.counts.replayed,
      created: this.counts.created,
      updated: this.counts.updated,
      noop: this.counts.noop,
      replayed: this.counts.replayed,
      conflicts: this.counts.conflict,
      bytesIn: this.bytesIn,
      avgPushLatencyMs: this.latencyCount === 0 ? 0 : this.latencyTotalMs / this.latencyCount,
      maxPushLatencyMs: this.latencyMaxMs,
    };
  }
}
