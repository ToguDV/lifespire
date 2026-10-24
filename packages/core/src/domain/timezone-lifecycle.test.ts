import { describe, expect, it } from 'vitest'
import { createDemoSetup } from '../content/demo.js'
import { createRun } from './lifecycle.js'
import { DomainError } from './lifecycle.js'

function setup() {
  return createDemoSetup(new Date(2026, 9, 20, 12, 0, 0))
}

describe('createRun timeZone', () => {
  it('stores null by default (legacy)', () => {
    const run = createRun({ setup: setup(), now: new Date(2026, 9, 20, 12, 0, 0), runId: 'run_1' })
    expect(run.timeZone).toBe(null)
    expect(run.startDate).toBe('2026-10-20')
  })

  it('stores the zone and computes startDate inside it', () => {
    // 2026-10-20T02:00:00Z is Oct 19 in New York.
    const run = createRun({
      setup: setup(),
      now: new Date('2026-10-20T02:00:00.000Z'),
      runId: 'run_1',
      timeZone: 'America/New_York',
    })
    expect(run.timeZone).toBe('America/New_York')
    expect(run.startDate).toBe('2026-10-19')
    expect(run.days[0]?.date).toBe('2026-10-19')
  })

  it('rejects invalid zones', () => {
    expect(() =>
      createRun({ setup: setup(), now: new Date(), runId: 'run_1', timeZone: 'Mars/Olympus' }),
    ).toThrow(DomainError)
  })
})
