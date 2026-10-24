import { devError, devWarn, sanitizeContext } from './devLogger'

describe('devLogger', () => {
  let errorSpy: jest.SpyInstance
  let warnSpy: jest.SpyInstance

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    errorSpy.mockRestore()
    warnSpy.mockRestore()
  })

  it('prefixes errors with the scope and keeps the stack', () => {
    devError('sync', 'push failed', new Error('boom'), { endpoint: '/v1/sync' })
    expect(errorSpy).toHaveBeenCalledTimes(1)
    const [line, context, detail] = errorSpy.mock.calls[0] as [string, unknown, string]
    expect(line).toBe('[LifeSpire][sync] push failed')
    expect(context).toEqual({ endpoint: '/v1/sync' })
    expect(detail).toContain('boom')
  })

  it('uses console.warn for recoverable failures', () => {
    devWarn('notifications', 'cancel failed')
    expect(warnSpy).toHaveBeenCalledWith('[LifeSpire][notifications] cancel failed')
  })

  it('redacts sensitive context values and never logs a save or token', () => {
    const safe = sanitizeContext({
      token: 'super-secret',
      refreshToken: 'refresh-secret',
      document: { profile: { name: 'Wren' } },
      password: 'hunter2',
      meta: { refreshToken: 'nested-secret', dayId: 'run:day:0' },
      dayId: 'run:day:0',
      count: 3,
    })
    expect(safe.token).toBe('[redacted]')
    expect(safe.refreshToken).toBe('[redacted]')
    expect(safe.document).toBe('[redacted]')
    expect(safe.password).toBe('[redacted]')
    expect(safe.dayId).toBe('run:day:0')
    expect((safe.meta as Record<string, unknown>).refreshToken).toBe('[redacted]')
    expect((safe.meta as Record<string, unknown>).dayId).toBe('run:day:0')
    expect(safe.count).toBe(3)
  })

  it('truncates long strings and tolerates unknown values', () => {
    const long = 'x'.repeat(900)
    devWarn('files', 'long value', undefined, { filename: long })
    const [, context] = warnSpy.mock.calls[0] as [string, Record<string, unknown>]
    expect(String(context.filename)).toHaveLength(501)
    expect(String(context.filename).endsWith('…')).toBe(true)

    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(() => devError('app', 'circular', circular)).not.toThrow()
  })
})
