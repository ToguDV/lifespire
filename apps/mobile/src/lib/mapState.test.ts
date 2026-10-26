import type { Day, GameMap, Run } from '@lifespire/core'
import { deriveMapDayState } from './mapState'

const map = { id: 'map_1' } as GameMap

function makeDay(input: {
  id: string
  index: number
  date: string
  status: Day['status']
  map?: GameMap | null
}): Day {
  return {
    id: input.id,
    index: input.index,
    date: input.date,
    status: input.status,
    path: [],
    map: input.map ?? null,
  } as unknown as Day
}

function makeRun(days: Day[], status: Run['status'] = 'active'): Run {
  return {
    id: 'run_1',
    status,
    days,
    objectives: [],
  } as unknown as Run
}

describe('map day state', () => {
  const today = '2026-10-24'
  const yesterday = '2026-10-23'

  it('prefers today’s sealed day over the next active day', () => {
    const sealed = makeDay({
      id: 'day_0',
      index: 0,
      date: today,
      status: 'completed',
      map,
    })
    const next = makeDay({
      id: 'day_1',
      index: 1,
      date: '2026-10-25',
      status: 'locked',
    })
    const state = deriveMapDayState(makeRun([sealed, next]), today)

    expect(state.day?.id).toBe('day_0')
    expect(state.sealedDay).toBe(true)
    expect(state.hasMap).toBe(false)
    expect(state.canOpen).toBe(false)
    expect(state.resolvedCount).toBe(0)
  })

  it('uses the active in-progress day and exposes its map', () => {
    const done = makeDay({ id: 'day_0', index: 0, date: yesterday, status: 'completed', map })
    const active = makeDay({ id: 'day_1', index: 1, date: today, status: 'in_progress', map })
    const state = deriveMapDayState(makeRun([done, active]), today)

    expect(state.day?.id).toBe('day_1')
    expect(state.sealedDay).toBe(false)
    expect(state.hasMap).toBe(true)
    expect(state.canOpen).toBe(false)
  })

  it('marks a closed run as closed and offers no playable day', () => {
    const closed = makeDay({ id: 'day_0', index: 0, date: today, status: 'completed', map })
    const state = deriveMapDayState(makeRun([closed], 'closed'), today)

    expect(state.day?.id).toBe('day_0')
    expect(state.closedRun).toBe(true)
    expect(state.hasMap).toBe(false)
    expect(state.canOpen).toBe(false)
  })

  it('marks a day without map as openable when it is available', () => {
    const day = makeDay({ id: 'day_0', index: 0, date: today, status: 'available' })
    const state = deriveMapDayState(makeRun([day]), today)

    expect(state.canOpen).toBe(true)
    expect(state.hasMap).toBe(false)
    expect(state.closedRun).toBe(false)
  })
})
