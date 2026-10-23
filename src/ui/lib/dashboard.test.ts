import { describe, expect, it } from 'vitest'
import { createDemoSetup } from '../../content/demo'
import { createRun, openDay, selectNode } from '../../domain/lifecycle'
import type { Day, GameDocument, Run } from '../../domain/types'
import { homeState, weekMarker } from './dashboard'

const now = new Date(2026, 9, 21, 9, 0, 0)
const todayKey = '2026-10-21'
const setup = createDemoSetup(now)

function makeRun(): Run {
  return createRun({
    setup,
    now,
    runId: 'run_dashboard',
  })
}

function makeDocument(run: Run): GameDocument {
  return {
    schemaVersion: 2,
    profile: {
      id: 'profile_1',
      name: 'Wren',
      xp: 0,
      level: 1,
      gold: 0,
      loot: [],
      createdAt: now.toISOString(),
    },
    goals: setup.goals,
    tasks: setup.tasks,
    run,
    onboardingDraft: null,
    settings: { theme: 'system' },
  }
}

function setDay(run: Run, index: number, patch: Partial<Day>): Run {
  return {
    ...run,
    days: run.days.map((day) => (day.index === index ? { ...day, ...patch } : day)),
  }
}

describe('homeState', () => {
  it('offers a beginning when there is no run', () => {
    expect(homeState(null, todayKey)).toMatchObject({
      phase: 'no-run',
      cta: 'begin-run',
      today: null,
    })
  })

  it('offers to open an available day and to continue one in progress', () => {
    const run = makeRun()
    expect(homeState(run, todayKey)).toMatchObject({
      phase: 'day-available',
      cta: 'open-day',
      today: { index: 0 },
      isWaitingForMidnight: false,
    })

    const opened = openDay(makeDocument(run), { now })
    const openedRun = opened.run
    expect(homeState(openedRun, todayKey)).toMatchObject({
      phase: 'day-in-progress',
      cta: 'continue-day',
      hasSelection: false,
    })

    const map = openedRun?.days[0]?.map
    const node = map?.layers[0]?.[0]
    if (!openedRun || !node) throw new Error('fixture day must have a map')
    const selected = selectNode(opened, node.id)
    expect(homeState(selected.run, todayKey)).toMatchObject({
      phase: 'day-in-progress',
      cta: 'continue-day',
      hasSelection: true,
      availableChoices: 1,
    })
  })

  it('reviews a sealed day and explains the wait for midnight', () => {
    const sealed = setDay(makeRun(), 0, { status: 'completed' })
    expect(homeState(sealed, todayKey)).toMatchObject({
      phase: 'day-completed',
      cta: 'review-day',
      isWaitingForMidnight: true,
      daysAhead: 6,
    })
  })

  it('reviews the week after a missed day', () => {
    const missed = setDay(makeRun(), 0, { status: 'missed' })
    expect(homeState(missed, todayKey)).toMatchObject({
      phase: 'day-missed',
      cta: 'review-week',
      isWaitingForMidnight: true,
    })
  })

  it('reads the week when the run is closed', () => {
    const closed: Run = { ...makeRun(), status: 'closed', summary: null }
    expect(homeState(closed, todayKey)).toMatchObject({
      phase: 'run-closed',
      cta: 'review-week',
      daysAhead: 0,
    })
  })

  it('does not offer a playable action on a locked day', () => {
    const locked = setDay(makeRun(), 0, { status: 'locked' })
    expect(homeState(locked, todayKey)).toMatchObject({
      phase: 'day-locked',
      cta: 'none',
    })
  })
})

describe('weekMarker', () => {
  it('marks completed, missed, today and ahead without relying on status colour', () => {
    const run = makeRun()
    const days = run.days
    expect(weekMarker(days[0]!, todayKey)).toBe('today')
    expect(weekMarker({ ...days[0]!, status: 'completed' }, todayKey)).toBe('completed')
    expect(weekMarker({ ...days[0]!, status: 'missed' }, todayKey)).toBe('missed')
    expect(weekMarker(days[1]!, todayKey)).toBe('locked')
  })
})
