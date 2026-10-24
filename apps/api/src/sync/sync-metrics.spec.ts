import { describe, expect, it } from 'vitest';
import { SyncMetrics } from './sync-metrics';

describe('SyncMetrics', () => {
  it('starts at zero', () => {
    expect(SyncMetrics.prototype).toBeDefined();
    const metrics = new SyncMetrics();
    expect(metrics.snapshot()).toEqual({
      pushes: 0,
      created: 0,
      updated: 0,
      noop: 0,
      replayed: 0,
      conflicts: 0,
      bytesIn: 0,
      avgPushLatencyMs: 0,
      maxPushLatencyMs: 0,
    });
  });

  it('counts outcomes and tracks latency', () => {
    const metrics = new SyncMetrics();
    metrics.record('created', 100, 10);
    metrics.record('updated', 200, 30);
    metrics.record('noop', 200, 5);
    metrics.record('replayed', 100, 2);
    metrics.record('conflict', 150, 20);
    const snap = metrics.snapshot();
    expect(snap.pushes).toBe(4);
    expect(snap.created).toBe(1);
    expect(snap.updated).toBe(1);
    expect(snap.noop).toBe(1);
    expect(snap.replayed).toBe(1);
    expect(snap.conflicts).toBe(1);
    // Conflicts are counted but excluded from push bytes/latency.
    expect(snap.bytesIn).toBe(600);
    expect(snap.avgPushLatencyMs).toBeCloseTo(11.75, 2);
    expect(snap.maxPushLatencyMs).toBe(30);
  });
});
