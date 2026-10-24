import { validateSetup } from '@lifespire/core'
import {
  MAX_WEEKLY_OBJECTIVE,
  MIN_WEEKLY_OBJECTIVE,
} from '@lifespire/core'
import type { Goal, Task } from '@lifespire/core'

export type WeeklyTargets = Record<string, string>

export interface NewRunValidation {
  ok: boolean
  errors: string[]
  fieldErrors: Record<string, string>
  /** Goals with the reviewed targets applied; inactive goals are untouched. */
  goals: Goal[]
  activeGoals: Goal[]
  activeRoutines: number
}

/**
 * Target maps are keyed by user-controlled goal ids, including `__proto__`.
 * A null prototype keeps those keys as plain own properties instead of
 * resolving inherited members of `Object.prototype`.
 */
function createTargetMap(): WeeklyTargets {
  return Object.create(null) as WeeklyTargets
}

/** Editable draft used by the new-run dialog: current targets as strings. */
export function initialWeeklyTargets(goals: readonly Goal[]): WeeklyTargets {
  const targets = createTargetMap()
  for (const goal of goals) {
    if (goal.active) targets[goal.id] = String(goal.weeklyObjective)
  }
  return targets
}

function parseTarget(raw: unknown): number {
  if (typeof raw !== 'string') return Number.NaN
  const trimmed = raw.trim()
  if (!trimmed) return Number.NaN
  return Number(trimmed)
}

function weeklyTargetError(goal: Goal): string {
  const name = goal.title.trim() || 'this goal'
  return `Set ${name} between ${MIN_WEEKLY_OBJECTIVE} and ${MAX_WEEKLY_OBJECTIVE}.`
}

/**
 * Validates the reviewed weekly targets before a new run starts. The dialog
 * never mutates content: it only hands the adjusted goals to `startNewRun`,
 * which writes the goals and the fresh run in one atomic transition.
 */
export function validateNewRunSetup(
  goals: readonly Goal[],
  tasks: readonly Task[],
  targets: WeeklyTargets,
): NewRunValidation {
  const activeGoals = goals.filter((goal) => goal.active)
  const activeGoalIds = new Set(activeGoals.map((goal) => goal.id))
  const activeRoutines = tasks.filter(
    (task) => task.active && activeGoalIds.has(task.goalId),
  ).length

  const fieldErrors = createTargetMap()
  const adjusted = goals.map((goal) => {
    if (!goal.active) return goal
    const raw = Object.hasOwn(targets, goal.id) ? targets[goal.id] : undefined
    const value = parseTarget(raw)
    if (
      !Number.isInteger(value) ||
      value < MIN_WEEKLY_OBJECTIVE ||
      value > MAX_WEEKLY_OBJECTIVE
    ) {
      fieldErrors[goal.id] = weeklyTargetError(goal)
      return goal
    }
    return { ...goal, weeklyObjective: value }
  })

  const setup = validateSetup(adjusted, tasks)
  const errors = [...new Set([...Object.values(fieldErrors), ...setup.errors])]

  return {
    ok: errors.length === 0,
    errors,
    fieldErrors,
    goals: adjusted,
    activeGoals,
    activeRoutines,
  }
}
