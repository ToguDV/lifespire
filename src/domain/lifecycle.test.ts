import { describe, expect, it } from 'vitest'
import { createDemoSetup } from '../content/demo'
import { RUN_DAYS } from './balance'
import { dayKey, daysBetween } from './dates'
import { createRun, reconcileDays } from './lifecycle'
import type { GameMap, MapNode, Run } from './types'

const now = new Date(2026, 9, 20, 8, 30, 0)

function makeRun(runId = 'run_seed') {
  const setup = createDemoSetup(now)
  return createRun({ setup, now, runId })
}

function mapFixture(dayIndex: number): GameMap {
  const node: MapNode = {
    id: `n${dayIndex}_0`,
    layer: 0,
    type: 'task',
    task: {
      taskId: 'demo-task-walk-north-trail',
      title: 'Walk the north trail',
      goalId: 'demo-goal-wayfarer',
      goalTitle: 'Wayfarer',
      effort: 'light',
    },
    rewards: { xp: 10, gold: 10, lootRolls: 0, progress: 1 },
    connections: [],
  }
  return {
    id: `map_${dayIndex}`,
    seed: `seed_${dayIndex}`,
    dayIndex,
    generatorVersion: 1,
    layers: [[node], [], [], []],
    boss: { ...node, id: `boss_${dayIndex}`, layer: 4, type: 'boss' },
    currentNodeId: null,
    createdAt: now.toISOString(),
  }
}

describe('createRun', () => {
  it('creates seven consecutive local days', () => {
    const run = makeRun()
    expect(run.days).toHaveLength(RUN_DAYS)
    expect(run.startDate).toBe(dayKey(now))
    expect(run.days[0]?.date).toBe(dayKey(now))
    expect(daysBetween(run.days[0]!.date, run.days[6]!.date)).toBe(6)

    expect(run.days[0]?.status).toBe('available')
    expect(run.days.slice(1).every((day) => day.status === 'locked')).toBe(true)
    expect(run.days.every((day) => day.map === null && day.path.length === 0)).toBe(true)
    expect(run.days.every((day) => day.rewards.length === 0 && day.summary === null)).toBe(true)
  })

  it('snapshots only active goals as weekly objectives', () => {
    const setup = createDemoSetup(now)
    setup.goals[1] = { ...setup.goals[1]!, active: false }
    const run = createRun({ setup, now, runId: 'run_objectives' })
    expect(run.objectives).toEqual([
      {
        goalId: 'demo-goal-wayfarer',
        goalTitle: 'Wayfarer',
        target: 4,
        progress: 0,
      },
    ])
  })

  it('starts with zero totals and active status', () => {
    const run = makeRun()
    expect(run.status).toBe('active')
    expect(run.closedAt).toBeNull()
    expect(run.summary).toBeNull()
    expect(run.totals).toEqual({
      xp: 0,
      gold: 0,
      lootCount: 0,
      nodesCompleted: 0,
      nodesSkipped: 0,
      daysPlayed: 0,
      daysMissed: 0,
    })
    expect(run.createdAt).toBe(now.toISOString())
  })

  it('derives a deterministic seed from the run id', () => {
    expect(makeRun('same').seed).toBe(makeRun('same').seed)
    expect(makeRun('same').seed).not.toBe(makeRun('other').seed)
  })

  it('crosses month boundaries without drift', () => {
    const lateNow = new Date(2026, 0, 28, 23, 59, 0)
    const setup = createDemoSetup(lateNow)
    const run = createRun({ setup, now: lateNow, runId: 'run_month' })
    expect(run.days.map((day) => day.date)).toEqual([
      '2026-01-28',
      '2026-01-29',
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
      '2026-02-02',
      '2026-02-03',
    ])
    expect(new Set(run.days.map((day) => day.id)).size).toBe(RUN_DAYS)
  })
})

describe('reconcileDays', () => {
  it('marks three absent days as missed and leaves today available', () => {
    const run = makeRun()
    const reconciled = reconcileDays(run, '2026-10-23')

    expect(reconciled.days.map((day) => day.status)).toEqual([
      'missed',
      'missed',
      'missed',
      'available',
      'locked',
      'locked',
      'locked',
    ])
  })

  it('is idempotent and returns the same run when nothing changes', () => {
    const first = reconcileDays(makeRun(), '2026-10-23')
    const second = reconcileDays(first, '2026-10-23')
    expect(second).toBe(first)
    expect(reconcileDays(second, '2026-10-23')).toEqual(first)
  })

  it('keeps completed and missed days untouched', () => {
    const run = makeRun()
    const withHistory: Run = {
      ...run,
      days: run.days.map((day, index) => {
        if (index === 0) return { ...day, status: 'completed' as const }
        if (index === 1) return { ...day, status: 'missed' as const }
        return day
      }),
    }
    const reconciled = reconcileDays(withHistory, '2026-10-22')
    expect(reconciled.days[0]?.status).toBe('completed')
    expect(reconciled.days[1]?.status).toBe('missed')
    expect(reconciled.days[2]?.status).toBe('available')
  })

  it('keeps an opened day in progress and marks a past opened day missed', () => {
    const run = makeRun()
    const dayA = { ...run.days[0]!, map: mapFixture(0), status: 'in_progress' as const }
    const dayB = { ...run.days[1]!, map: mapFixture(1), status: 'in_progress' as const }
    const opened: Run = { ...run, days: [dayA, dayB, ...run.days.slice(2)] }

    expect(reconcileDays(opened, '2026-10-20').days[0]?.status).toBe('in_progress')
    const later = reconcileDays(opened, '2026-10-22')
    expect(later.days[0]?.status).toBe('missed')
    expect(later.days[1]?.status).toBe('missed')
    expect(later.days[2]?.status).toBe('available')
  })

  it('locks every future day when today is before the run', () => {
    const run = makeRun()
    const reconciled = reconcileDays(run, '2026-10-01')
    expect(reconciled.days.every((day) => day.status === 'locked')).toBe(true)
  })

  it('misses every unresolved day after a long absence', () => {
    const run = makeRun()
    const reconciled = reconcileDays(run, '2027-01-01')
    expect(reconciled.days.every((day) => day.status === 'missed')).toBe(true)
  })

  it('works across month boundaries', () => {
    const lateNow = new Date(2026, 0, 29, 12)
    const run = createRun({ setup: createDemoSetup(lateNow), now: lateNow, runId: 'run_month' })
    const reconciled = reconcileDays(run, '2026-02-01')
    expect(reconciled.days.map((day) => day.status)).toEqual([
      'missed',
      'missed',
      'missed',
      'available',
      'locked',
      'locked',
      'locked',
    ])
  })
})
