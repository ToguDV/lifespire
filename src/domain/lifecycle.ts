import { GENERATOR_VERSION, RUN_DAYS } from './balance'
import { addDays, dayKey } from './dates'
import type { Day, Run, RunObjective, RunSetup, RunTotals } from './types'

export interface CreateRunInput {
  setup: RunSetup
  now: Date
  runId: string
}

const EMPTY_TOTALS: RunTotals = {
  xp: 0,
  gold: 0,
  lootCount: 0,
  nodesCompleted: 0,
  nodesSkipped: 0,
  daysPlayed: 0,
  daysMissed: 0,
}

function objectivesFromGoals(setup: RunSetup): RunObjective[] {
  return setup.goals
    .filter((goal) => goal.active)
    .map((goal) => ({
      goalId: goal.id,
      goalTitle: goal.title,
      target: goal.weeklyObjective,
      progress: 0,
    }))
}

function createDays(runId: string, startDate: string): Day[] {
  return Array.from({ length: RUN_DAYS }, (_, index) => ({
    id: `${runId}:day:${index}`,
    index,
    date: addDays(startDate, index),
    status: index === 0 ? 'available' : 'locked',
    map: null,
    path: [],
    rewards: [],
    openedAt: null,
    closedAt: null,
    summary: null,
  }))
}

/** Creates a fresh 7-day run. All dates and ids are injected for determinism. */
export function createRun({ setup, now, runId }: CreateRunInput): Run {
  const startDate = dayKey(now)
  return {
    id: runId,
    seed: `run:${runId}`,
    generatorVersion: GENERATOR_VERSION,
    startDate,
    status: 'active',
    objectives: objectivesFromGoals(setup),
    days: createDays(runId, startDate),
    totals: { ...EMPTY_TOTALS },
    createdAt: now.toISOString(),
    closedAt: null,
    summary: null,
  }
}

/**
 * Marks elapsed days as missed, keeps today available or in progress, and locks
 * the future. Completed days are never rewritten. Returns the same run when no
 * day changes, which makes repeated calls idempotent.
 */
export function reconcileDays(run: Run, todayKey: string): Run {
  let changed = false

  const days = run.days.map((day): Day => {
    if (day.status === 'completed' || day.status === 'missed') {
      return day
    }

    if (day.date < todayKey) {
      changed = true
      return { ...day, status: 'missed' }
    }

    if (day.date === todayKey) {
      const status = day.map ? 'in_progress' : 'available'
      if (day.status === status) return day
      changed = true
      return { ...day, status }
    }

    if (day.status === 'locked') return day
    changed = true
    return { ...day, status: 'locked' }
  })

  return changed ? { ...run, days } : run
}
