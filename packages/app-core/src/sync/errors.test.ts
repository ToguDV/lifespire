import { describe, expect, it } from 'vitest'
import { isNetworkUnreachable, toUserSyncError } from './errors'

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
})
