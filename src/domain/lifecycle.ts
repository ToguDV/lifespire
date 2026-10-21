import { GENERATOR_VERSION, RUN_DAYS } from './balance'
import { addDays, dayKey } from './dates'
import { generateMap } from './generator'
import { availableNodeIds, currentDay, resolveNodeById } from './selectors'
import type { Day, GameDocument, Run, RunObjective, RunSetup, RunTotals } from './types'

/** A rejected lifecycle transition with a message that can be shown to the player. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DomainError'
  }
}

export interface OpenDayOptions {
  dayId?: string
  now: Date
}

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

/**
 * Opens the current day exactly once. Only the first day that is neither
 * completed nor missed can be opened, and only when its local date is today.
 * Existing maps are never regenerated; repeated calls return the same document.
 */
export function openDay(document: GameDocument, options: OpenDayOptions): GameDocument {
  const run = document.run
  if (!run || run.status !== 'active') {
    throw new DomainError('There is no active run to open.')
  }

  const today = dayKey(options.now)
  const day = currentDay(run)
  if (!day) {
    throw new DomainError('Every day in this run is already closed.')
  }
  if (day.date > today) {
    throw new DomainError('That day has not arrived yet.')
  }
  if (day.date < today) {
    throw new DomainError('That day has already passed.')
  }

  if (options.dayId !== undefined && options.dayId !== day.id) {
    const requested = run.days.find((candidate) => candidate.id === options.dayId)
    if (!requested) throw new DomainError('That day does not belong to this run.')
    throw new DomainError('Only today can be opened.')
  }

  if (day.map) return document

  const map = generateMap({
    runId: run.id,
    runSeed: run.seed,
    dayIndex: day.index,
    generatorVersion: run.generatorVersion,
    goals: document.goals,
    tasks: document.tasks,
    objectives: run.objectives,
    now: options.now.toISOString(),
  })

  const days = run.days.map((candidate): Day =>
    candidate.id === day.id
      ? {
          ...candidate,
          map,
          status: 'in_progress',
          openedAt: options.now.toISOString(),
        }
      : candidate,
  )

  return { ...document, run: { ...run, days } }
}

/**
 * Selects the current node. Before a selection only layer 0 is available; once
 * a node is current it is the only node that can be picked again (as a no-op).
 * The selection cannot be cancelled or swapped for another node.
 */
export function selectNode(document: GameDocument, nodeId: string): GameDocument {
  const run = document.run
  if (!run || run.status !== 'active') {
    throw new DomainError('There is no active run.')
  }

  const day = currentDay(run)
  if (!day) throw new DomainError('Every day in this run is already closed.')
  if (day.status !== 'in_progress' || !day.map) {
    throw new DomainError('Open the day before choosing a node.')
  }

  const map = day.map
  if (!resolveNodeById(map, nodeId)) {
    throw new DomainError('That node is not part of today’s map.')
  }

  const available = availableNodeIds(map, day)
  if (!available.includes(nodeId)) {
    if (map.currentNodeId !== null && map.currentNodeId !== nodeId) {
      throw new DomainError('A node is already chosen for this day.')
    }
    throw new DomainError('That node is not available from the current path.')
  }

  if (map.currentNodeId === nodeId) return document

  const nextMap = { ...map, currentNodeId: nodeId }
  const days = run.days.map((candidate): Day =>
    candidate.id === day.id ? { ...candidate, map: nextMap } : candidate,
  )

  return { ...document, run: { ...run, days } }
}
