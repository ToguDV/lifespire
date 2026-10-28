import { describe, expect, it } from 'vitest'
import {
  PAIRING_SCHEME,
  decodePairingPayload,
  encodePairingPayload,
  isPairingCode,
  isPairingPayload,
  normalizePlatform,
  pairingCodeFromSecret,
  shortFingerprint,
} from './protocol'
import type { PairingPayload } from './protocol'

const PAYLOAD: PairingPayload = {
  v: 1,
  kind: 'lifespire-pair',
  deviceId: 'device-1234-abcd',
  name: 'Pixel 8',
  fingerprint: 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz012345',
  host: '192.168.1.20',
  port: 49152,
  secret: '0123456789abcdef0123456789abcdef',
  expiresAt: '2026-10-27T12:05:00.000Z',
}

describe('pairing payload', () => {
  it('round-trips through the QR URL', () => {
    const encoded = encodePairingPayload(PAYLOAD)
    expect(encoded.startsWith(`${PAIRING_SCHEME}://pair?p=`)).toBe(true)
    expect(decodePairingPayload(encoded)).toEqual(PAYLOAD)
  })

  it('accepts raw JSON too', () => {
    expect(decodePairingPayload(JSON.stringify(PAYLOAD))).toEqual(PAYLOAD)
  })

  it('rejects incomplete or future payloads', () => {
    expect(isPairingPayload({ ...PAYLOAD, v: 2 })).toBe(false)
    expect(isPairingPayload({ ...PAYLOAD, secret: 'short' })).toBe(false)
    expect(isPairingPayload({ ...PAYLOAD, deviceId: '' })).toBe(false)
    expect(decodePairingPayload('not a payload')).toBeNull()
  })

  it('normalizes the fallback code', () => {
    const code = pairingCodeFromSecret(PAYLOAD.secret)
    expect(code).toHaveLength(8)
    expect(isPairingCode(code)).toBe(true)
    expect(isPairingCode(` ${code.toLowerCase()} `)).toBe(true)
  })

  it('formats a short fingerprint for comparison', () => {
    expect(shortFingerprint('AABBCCDDEEFF')).toBe('AABB-CCDD-EEFF')
  })
})

describe('device platform', () => {
  it('round-trips as an optional pairing field', () => {
    const encoded = encodePairingPayload({ ...PAYLOAD, platform: 'android' })
    expect(decodePairingPayload(encoded)).toMatchObject({ platform: 'android' })
  })

  it('accepts payloads from older clients without a platform', () => {
    expect(isPairingPayload(PAYLOAD)).toBe(true)
    const decoded = decodePairingPayload(JSON.stringify(PAYLOAD))
    expect(decoded).not.toBeNull()
    expect('platform' in (decoded ?? {})).toBe(false)
  })

  it('tolerates unknown future platform values without breaking pairing', () => {
    expect(isPairingPayload({ ...PAYLOAD, platform: 'watch' })).toBe(true)
    expect(normalizePlatform('watch')).toBeUndefined()
  })

  it('normalizes platform names', () => {
    expect(normalizePlatform('android')).toBe('android')
    expect(normalizePlatform('desktop')).toBe('desktop')
    expect(normalizePlatform('watch')).toBeUndefined()
    expect(normalizePlatform(undefined)).toBeUndefined()
  })
})
