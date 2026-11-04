import { describe, expect, it } from 'vitest'
import { LocalSyncError, isNetworkUnreachable, toUserSyncError } from './errors'

function coded(message: string, code: string): Error {
  return Object.assign(new Error(message), { code })
}

describe('isNetworkUnreachable', () => {
  it('detects Node errno codes on the error object', () => {
    for (const code of [
      'EHOSTUNREACH',
      'ENETUNREACH',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ECONNRESET',
      'EPIPE',
      'ENOTFOUND',
      'EAI_AGAIN',
    ]) {
      expect(isNetworkUnreachable(coded('socket failed', code)), code).toBe(true)
    }
  })

  it('detects errno codes embedded in the message', () => {
    expect(isNetworkUnreachable(new Error('connect EHOSTUNREACH 192.168.1.18:39741'))).toBe(true)
  })

  it('looks through one level of cause chains', () => {
    const wrapped = new Error('fetch failed')
    ;(wrapped as { cause?: unknown }).cause = coded('connect', 'ECONNREFUSED')
    expect(isNetworkUnreachable(wrapped)).toBe(true)
  })

  it('rejects already-friendly and unrelated errors', () => {
    expect(isNetworkUnreachable(new Error('The other device is not nearby.'))).toBe(false)
    expect(isNetworkUnreachable(new Error('The merged document is not valid.'))).toBe(false)
    expect(isNetworkUnreachable(new Error('Unknown device.'))).toBe(false)
    expect(isNetworkUnreachable(null)).toBe(false)
    expect(isNetworkUnreachable('nope')).toBe(false)
  })
})

describe('toUserSyncError', () => {
  it('maps network failures to guidance without addresses', () => {
    const message = toUserSyncError(
      coded('connect EHOSTUNREACH 192.168.1.18:39741', 'EHOSTUNREACH'),
      'Sync failed.',
    )
    expect(message).toBe(
      "Couldn't reach the other device. Make sure both apps are open on the same Wi-Fi.",
    )
    expect(message).not.toMatch(/192\.168/)
    expect(message).not.toMatch(/39741/)
  })

  it('keeps already-friendly messages untouched', () => {
    for (const friendly of [
      'The other device is not nearby.',
      'The other device presented a different certificate.',
      'The other device did not answer in time.',
      'The other device sent an invalid save.',
      'Could not pair the device.',
      'Unknown device.',
      'A previous conflict needs review.',
    ]) {
      expect(toUserSyncError(new Error(friendly), 'Sync failed.'), friendly).toBe(friendly)
    }
  })

  it('strips IPs, ports and IPC channel names from unknown errors', () => {
    const message = toUserSyncError(
      new Error("Error invoking remote method 'lifespire:local-sync-request': boom 10.0.0.5:8080"),
      'Sync failed.',
    )
    expect(message).not.toMatch(/lifespire:/)
    expect(message).not.toMatch(/10\.0\.0\.5/)
    expect(message).not.toMatch(/8080/)
    expect(message.length).toBeGreaterThan(0)
  })

  it('falls back when nothing readable remains', () => {
    expect(toUserSyncError(new Error('192.168.1.18:39741'), 'Sync failed.')).toBe('Sync failed.')
    expect(toUserSyncError(null, 'Could not pair the device.')).toBe(
      'Could not pair the device.',
    )
  })

  it('maps HTTP statuses to actionable copy without the numeric code', () => {
    const unauthorized = toUserSyncError(
      new LocalSyncError('The other device answered 401.', { status: 401 }),
      'Sync failed.',
    )
    expect(unauthorized).toMatch(/pair both devices again/i)
    expect(unauthorized).not.toMatch(/401|pairing token/i)

    expect(
      toUserSyncError(new LocalSyncError('raw', { status: 403 }), 'Sync failed.'),
    ).toMatch(/same local network/i)
    expect(
      toUserSyncError(new LocalSyncError('raw', { status: 404 }), 'Sync failed.'),
    ).toMatch(/no save yet/i)
    expect(
      toUserSyncError(new LocalSyncError('raw', { status: 413 }), 'Sync failed.'),
    ).toMatch(/too large/i)
    expect(
      toUserSyncError(new LocalSyncError('raw', { status: 422 }), 'Sync failed.'),
    ).toMatch(/could not read this save/i)
    expect(
      toUserSyncError(new LocalSyncError('raw', { status: 429 }), 'Sync failed.'),
    ).toMatch(/too many attempts/i)
    expect(
      toUserSyncError(new LocalSyncError('raw', { status: 503 }), 'Sync failed.'),
    ).toMatch(/ran into a problem/i)
  })

  it('still maps legacy "answered 401" text when no status is attached', () => {
    const message = toUserSyncError(new Error('The other device answered 401.'), 'Sync failed.')
    expect(message).toMatch(/pair both devices again/i)
    expect(message).not.toMatch(/401|answered/i)
  })

  it('unwraps Expo, Kotlin and Electron transport wrappers', () => {
    expect(
      toUserSyncError(
        new Error(
          "Call to function 'LifespireLan.pair' has been rejected.\n→ Caused by: java.lang.IllegalStateException: The other device is not nearby.",
        ),
        'Sync failed.',
      ),
    ).toBe('The other device is not nearby.')

    expect(
      toUserSyncError(
        new Error('java.lang.IllegalStateException: Local sync is not running.'),
        'Sync failed.',
      ),
    ).toBe('Local sync is not running.')

    expect(
      toUserSyncError(
        new Error(
          "Error invoking remote method 'lifespire:local-sync-request': Error: Could not pair the device.",
        ),
        'Sync failed.',
      ),
    ).toBe('Could not pair the device.')
  })

  it('never leaks Java exceptions or unknown engine text', () => {
    const java = toUserSyncError(
      new Error('java.lang.RuntimeException: boom at expo.modules.LanManager.request(LanManager.kt:42)'),
      'Nearby sync ran into a problem. Try again.',
    )
    expect(java).toBe('Nearby sync ran into a problem. Try again.')
    expect(java).not.toMatch(/java\.|Exception|at expo/i)

    const unknown = toUserSyncError(
      new Error('LifeSpire LAN needs an Android context'),
      'Nearby sync ran into a problem. Try again.',
    )
    expect(unknown).toBe('Nearby sync ran into a problem. Try again.')
  })

  it('is idempotent for already curated copy', () => {
    for (const curated of [
      "Couldn't reach the other device. Make sure both apps are open on the same Wi-Fi.",
      'Nearby sync ran into a problem. Try again.',
      'A previous conflict needs review.',
      'The other device is not nearby.',
    ]) {
      expect(toUserSyncError(new Error(curated), 'fallback')).toBe(curated)
    }
  })

  it('maps known native and server failures', () => {
    expect(
      toUserSyncError(
        'Discovery is unavailable: java.net.SocketException: socket failed',
        'Sync failed.',
      ),
    ).toMatch(/nearby discovery is unavailable/i)

    expect(toUserSyncError(new Error('Pairing token required.'), 'Sync failed.')).toMatch(
      /pair both devices again/i,
    )
    expect(
      toUserSyncError(new Error('The pairing code is invalid or expired.'), 'Sync failed.'),
    ).toMatch(/that pairing code is invalid/i)
    expect(
      toUserSyncError(new Error('Too many pairing attempts. Try again later.'), 'Sync failed.'),
    ).toMatch(/too many pairing attempts/i)
    expect(toUserSyncError(new Error('Document too large.'), 'Sync failed.')).toMatch(
      /too large/i,
    )
  })
})
