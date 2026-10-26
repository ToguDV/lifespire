import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../common/api-error';
import { SyncWatchService } from './sync-watch.service';

interface Row {
  version: bigint;
  updatedAt: Date;
}

function prismaMock(state: { row: Row | null; status?: string }) {
  return {
    user: {
      findUnique: vi.fn(async () => ({ status: state.status ?? 'ACTIVE' })),
    },
    syncDocument: {
      findUnique: vi.fn(async () => state.row),
    },
  } as never;
}

const at = new Date('2026-10-24T00:01:00.000Z');

function configMock(waitMs = 25_000) {
  return {
    get: (key: string, fallback?: unknown) =>
      key === 'SYNC_WATCH_TIMEOUT_MS' ? waitMs : fallback,
  } as never;
}

describe('SyncWatchService', () => {
  it('returns immediately when the cloud version is ahead of since', async () => {
    const state = { row: { version: 3n, updatedAt: at } };
    const service = new SyncWatchService(prismaMock(state), configMock());

    await expect(service.watch({ userId: 'u1', since: '2', waitMs: 1000 })).resolves.toEqual({
      version: '3',
      updatedAt: at.toISOString(),
    });
  });

  it('returns the cloud version for a client without a cursor', async () => {
    const state = { row: { version: 7n, updatedAt: at } };
    const service = new SyncWatchService(prismaMock(state), configMock());

    await expect(service.watch({ userId: 'u1', since: null, waitMs: 1000 })).resolves.toEqual({
      version: '7',
      updatedAt: at.toISOString(),
    });
  });

  it('waits for a notification and resolves with the pushed version', async () => {
    const state = { row: { version: 2n, updatedAt: at } };
    const service = new SyncWatchService(prismaMock(state), configMock());
    const pending = service.watch({ userId: 'u1', since: '2', waitMs: 1000 });

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(service.watcherCount('u1')).toBe(1);
    service.notify('u1', { version: '3', updatedAt: '2026-10-24T00:02:00.000Z' });

    await expect(pending).resolves.toEqual({
      version: '3',
      updatedAt: '2026-10-24T00:02:00.000Z',
    });
    expect(service.watcherCount('u1')).toBe(0);
  });

  it('resolves a different user only for their own notification', async () => {
    const state = { row: { version: 1n, updatedAt: at } };
    const service = new SyncWatchService(prismaMock(state), configMock());
    const pending = service.watch({ userId: 'u1', since: '1', waitMs: 1000 });

    await new Promise((resolve) => setTimeout(resolve, 5));
    service.notify('u2', { version: '2', updatedAt: at.toISOString() });
    expect(service.watcherCount('u1')).toBe(1);
    service.notify('u1', { version: '2', updatedAt: at.toISOString() });

    await expect(pending).resolves.toMatchObject({ version: '2' });
  });

  it('re-reads the version when the wait times out', async () => {
    const state: { row: Row | null } = { row: { version: 4n, updatedAt: at } };
    const service = new SyncWatchService(prismaMock(state), configMock());
    const pending = service.watch({ userId: 'u1', since: '4', waitMs: 10 });

    // A push from another process cannot notify this instance, so the
    // timeout re-read must still catch it.
    state.row = { version: 5n, updatedAt: new Date('2026-10-24T00:03:00.000Z') };

    await expect(pending).resolves.toEqual({
      version: '5',
      updatedAt: '2026-10-24T00:03:00.000Z',
    });
  });

  it('returns null immediately when the cloud save was deleted', async () => {
    const state: { row: Row | null } = { row: null };
    const service = new SyncWatchService(prismaMock(state), configMock());

    await expect(service.watch({ userId: 'u1', since: '2', waitMs: 1000 })).resolves.toEqual({
      version: null,
      updatedAt: null,
    });
  });

  it('waits for the first upload when there is no save and no cursor', async () => {
    const state: { row: Row | null } = { row: null };
    const service = new SyncWatchService(prismaMock(state), configMock());
    const pending = service.watch({ userId: 'u1', since: null, waitMs: 20 });

    await expect(pending).resolves.toEqual({ version: null, updatedAt: null });
  });

  it('rejects accounts that are no longer active', async () => {
    const state = { row: { version: 1n, updatedAt: at }, status: 'DISABLED' };
    const service = new SyncWatchService(prismaMock(state), configMock());

    await expect(service.watch({ userId: 'u1', since: '1', waitMs: 1000 })).rejects.toMatchObject({
      code: 'USER_DISABLED',
    });
  });

  it('uses the configured wait when the client does not send one', async () => {
    const state = { row: { version: 1n, updatedAt: at } };
    const service = new SyncWatchService(prismaMock(state), configMock(20));
    const startedAt = Date.now();

    await expect(service.watch({ userId: 'u1', since: '1' })).resolves.toEqual({
      version: '1',
      updatedAt: at.toISOString(),
    });
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(10);
  });

  it('rate-limits a user that keeps requesting immediate versions', async () => {
    const state = { row: { version: 2n, updatedAt: at } };
    const service = new SyncWatchService(prismaMock(state), configMock());

    for (let i = 0; i < 60; i += 1) {
      await service.watch({ userId: 'u1', since: '1', waitMs: 10 });
    }
    await expect(
      service.watch({ userId: 'u1', since: '1', waitMs: 10 }),
    ).rejects.toMatchObject({ code: 'SYNC_WATCH_LIMIT' });
  });

  it('caps the number of concurrent watchers per user', async () => {
    const state = { row: { version: 1n, updatedAt: at } };
    const service = new SyncWatchService(prismaMock(state), configMock());
    const pending = Array.from({ length: 16 }, () =>
      service.watch({ userId: 'u1', since: '1', waitMs: 1000 }),
    );

    await new Promise((resolve) => setTimeout(resolve, 5));
    await expect(service.watch({ userId: 'u1', since: '1', waitMs: 1000 })).rejects.toBeInstanceOf(
      ApiError,
    );
    service.notify('u1', { version: '2', updatedAt: at.toISOString() });
    await Promise.all(pending);
    expect(service.watcherCount('u1')).toBe(0);
  });

  it('disposes the waiter when the client aborts', async () => {
    const state = { row: { version: 1n, updatedAt: at } };
    const service = new SyncWatchService(prismaMock(state), configMock());
    const controller = new AbortController();
    const pending = service.watch({
      userId: 'u1',
      since: '1',
      waitMs: 1000,
      signal: controller.signal,
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(service.watcherCount('u1')).toBe(1);
    controller.abort();

    await expect(pending).resolves.toEqual({ version: '1', updatedAt: at.toISOString() });
    expect(service.watcherCount('u1')).toBe(0);
  });
});
