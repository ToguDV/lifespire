import { describe, expect, it } from 'vitest'
import { looksTechnical, stripTechnical, toUserMessage } from './userError'

describe('looksTechnical', () => {
  it('flags platform and engine failures', () => {
    for (const raw of [
      "Failed to execute 'setItem' on 'Storage': Setting the value exceeded the quota.",
      'Unexpected token < in JSON at position 0',
      'Cannot read properties of null (reading \'profile\')',
      'SecurityError: The operation is insecure.',
      '/data/user/0/host.exp.exponent/cache/file.json: open failed: ENOENT',
      'Error: connect EHOSTUNREACH 192.168.1.18:39741',
      'TypeError: undefined is not an object',
      'NotAllowedError: permission dismissed',
      'Something broke (app.js:12:40)',
      'Invalid day key: "2026-13-45"',
    ]) {
      expect(looksTechnical(raw), raw).toBe(true)
    }
  })

  it('passes curated copy through', () => {
    for (const friendly of [
      'Give every goal a name.',
      'That file is not a valid LifeSpire save.',
      'Could not pair the device.',
      'The other device is not nearby.',
    ]) {
      expect(looksTechnical(friendly), friendly).toBe(false)
    }
  })
})

describe('stripTechnical', () => {
  it('removes addresses and channel names while keeping the gist', () => {
    expect(stripTechnical('connect EHOSTUNREACH 192.168.1.18:39741')).toBe('EHOSTUNREACH')
    expect(
      stripTechnical("Error invoking remote method 'lifespire:local-sync-request': boom"),
    ).toBe("Error invoking remote method '': boom")
  })
})

describe('toUserMessage', () => {
  it('returns the fallback for technical failures', () => {
    expect(
      toUserMessage(new Error("Failed to execute 'setItem' on 'Storage'"), 'Not saved.'),
    ).toBe('Not saved.')
    expect(toUserMessage({ code: 'ENOENT' }, 'Could not read that file.')).toBe(
      'Could not read that file.',
    )
  })

  it('keeps curated messages and caps runaway length', () => {
    expect(toUserMessage(new Error('Give every goal a name.'), 'Invalid.')).toBe(
      'Give every goal a name.',
    )
    expect(toUserMessage('x'.repeat(500), 'Invalid.')).toBe('Invalid.')
    expect(toUserMessage(null, 'Invalid.')).toBe('Invalid.')
  })
})
