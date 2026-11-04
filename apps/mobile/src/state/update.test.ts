import { createUpdateStore, UPDATE_POLL_MS } from './update'
import type { MobileUpdateCheck } from '../lib/update'

const INSTALLED = { versionName: '0.3.1', versionCode: 3001 }

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

describe('update store', () => {
  it('records an available update and throttles the next automatic check', async () => {
    let now = 1_000
    const check = jest.fn(
      async (): Promise<MobileUpdateCheck> => ({
        status: 'available',
        update: {
          source: 'fdroid',
          version: '0.4.0',
          versionCode: 4000,
          releaseUrl: 'https://github.com/ToguDV/lifespire/releases/tag/v0.4.0',
          apkUrl: null,
        },
      }),
    )
    const store = createUpdateStore({ installed: INSTALLED, now: () => now, check })

    await store.getState().check()
    expect(store.getState().status).toBe('available')
    expect(store.getState().latest).toEqual({
      source: 'fdroid',
      version: '0.4.0',
      versionCode: 4000,
      releaseUrl: 'https://github.com/ToguDV/lifespire/releases/tag/v0.4.0',
      apkUrl: null,
    })

    now += UPDATE_POLL_MS - 1
    await store.getState().check()
    expect(check).toHaveBeenCalledTimes(1)

    await store.getState().check({ force: true })
    expect(check).toHaveBeenCalledTimes(2)
  })

  it('clears a previous update when the check says current', async () => {
    const results: MobileUpdateCheck[] = [
      {
        status: 'available',
        update: {
          source: 'fdroid',
          version: '0.4.0',
          versionCode: 4000,
          releaseUrl: 'https://github.com/ToguDV/lifespire/releases/tag/v0.4.0',
          apkUrl: null,
        },
      },
      { status: 'current' },
    ]
    const check = jest.fn(async () => results.shift() ?? { status: 'current' as const })
    const store = createUpdateStore({ installed: INSTALLED, now: () => 1_000, check })

    await store.getState().check()
    await store.getState().check({ force: true })

    expect(store.getState().status).toBe('current')
    expect(store.getState().latest).toBeNull()
  })

  it('exposes a recoverable error and allows a manual retry', async () => {
    const check = jest
      .fn<Promise<MobileUpdateCheck>, []>()
      .mockResolvedValueOnce({ status: 'error' })
      .mockResolvedValueOnce({ status: 'current' })
    const store = createUpdateStore({ installed: INSTALLED, now: () => 1_000, check })

    await store.getState().check()
    expect(store.getState().status).toBe('error')
    expect(store.getState().lastCheckedAt).toBe(1_000)

    await store.getState().check({ force: true })
    expect(store.getState().status).toBe('current')
  })

  it('recovers when the checker throws unexpectedly', async () => {
    const check = jest.fn(async () => {
      throw new Error('boom')
    })
    const store = createUpdateStore({ installed: INSTALLED, now: () => 1_000, check })

    await store.getState().check()

    expect(store.getState().status).toBe('error')
    expect(store.getState().lastCheckedAt).toBe(1_000)
  })

  it('ignores a second check while one is in flight', async () => {
    const pending = deferred<MobileUpdateCheck>()
    const check = jest.fn(() => pending.promise)
    const store = createUpdateStore({ installed: INSTALLED, now: () => 1_000, check })

    const first = store.getState().check()
    await Promise.resolve()
    await store.getState().check({ force: true })
    expect(check).toHaveBeenCalledTimes(1)

    pending.resolve({ status: 'current' })
    await first
    expect(store.getState().status).toBe('current')
  })
})
