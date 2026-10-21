import {
  MAX_GOALS,
  MAX_WEEKLY_OBJECTIVE,
  MIN_ACTIVE_TASKS,
  MIN_GOALS,
  MIN_WEEKLY_OBJECTIVE,
} from './balance'
import type { Effort, GameDocument, Goal, Task } from './types'

/** Field-level messages shown next to a control (keyed by form field). */
export interface FieldErrors {
  [field: string]: string | undefined
}

export interface ContentActionResult {
  ok: boolean
  errors: string[]
  fieldErrors: FieldErrors
}

const EFFORTS: readonly Effort[] = ['light', 'medium', 'high']

export const CONTENT_MESSAGES = {
  goalTitle: 'Give this aim a title.',
  weeklyObjective: `Set the weekly aim between ${MIN_WEEKLY_OBJECTIVE} and ${MAX_WEEKLY_OBJECTIVE}.`,
  tooManyGoals: `A run can hold at most ${MAX_GOALS} active aims. Archive one before adding another.`,
  lastGoal: 'Keep at least one active aim while the run is underway.',
  fewRoutines: `Keep at least ${MIN_ACTIVE_TASKS} active routines while the run is underway.`,
  aimWithoutRoutine:
    'Keep at least one active routine under every active aim while the run is underway.',
  taskTitle: 'Give this routine a title.',
  taskGoal: 'Choose an active aim for this routine.',
  taskEffort: 'Choose light, medium or heavy effort.',
  orphanTask: 'Every routine needs an active aim.',
  missingGoal: 'That aim no longer exists. Refresh and try again.',
  missingTask: 'That routine no longer exists. Refresh and try again.',
} as const

export function contentSuccess(): ContentActionResult {
  return { ok: true, errors: [], fieldErrors: {} }
}

export function contentFailure(fieldErrors: FieldErrors): ContentActionResult {
  const errors = [...new Set(Object.values(fieldErrors).filter((value): value is string => Boolean(value)))]
  return { ok: false, errors, fieldErrors }
}

/** Validates the editable fields of a goal, independent of the rest of the setup. */
export function validateGoalInput(goal: Pick<Goal, 'title' | 'weeklyObjective'>): FieldErrors {
  const errors: FieldErrors = {}
  if (!goal.title.trim()) errors.title = CONTENT_MESSAGES.goalTitle
  if (
    !Number.isInteger(goal.weeklyObjective) ||
    goal.weeklyObjective < MIN_WEEKLY_OBJECTIVE ||
    goal.weeklyObjective > MAX_WEEKLY_OBJECTIVE
  ) {
    errors.weeklyObjective = CONTENT_MESSAGES.weeklyObjective
  }
  return errors
}

/** Validates a routine, including that its aim exists and is active. */
export function validateTaskInput(
  task: Pick<Task, 'title' | 'goalId' | 'effort'>,
  goals: readonly Goal[],
): FieldErrors {
  const errors: FieldErrors = {}
  if (!task.title.trim()) errors.title = CONTENT_MESSAGES.taskTitle
  if (!EFFORTS.includes(task.effort)) errors.effort = CONTENT_MESSAGES.taskEffort

  const goal = goals.find((candidate) => candidate.id === task.goalId)
  if (!goal || !goal.active) errors.goalId = CONTENT_MESSAGES.taskGoal
  return errors
}

export function activeGoalsOf(goals: readonly Goal[]): Goal[] {
  return goals.filter((goal) => goal.active)
}

export function activeTasksUnderActiveGoals(goals: readonly Goal[], tasks: readonly Task[]): Task[] {
  const goalIds = new Set(activeGoalsOf(goals).map((goal) => goal.id))
  return tasks.filter((task) => task.active && goalIds.has(task.goalId))
}

/** Whether an active aim still has at least one active routine in `tasks`. */
export function goalHasActiveRoutine(
  goals: readonly Goal[],
  tasks: readonly Task[],
  goalId: string,
): boolean {
  const goal = goals.find((candidate) => candidate.id === goalId)
  if (!goal?.active) return true
  return tasks.some((task) => task.active && task.goalId === goalId)
}

/**
 * Setup constraints that depend on whether a run is underway. Without a run,
 * content may be incomplete (the player is still editing); an active run must
 * always keep a playable setup.
 */
export function validateContentConstraints(
  document: GameDocument,
  goals: readonly Goal[],
  tasks: readonly Task[],
): ContentActionResult {
  const activeGoals = activeGoalsOf(goals)
  if (activeGoals.length > MAX_GOALS) return contentFailure({ goals: CONTENT_MESSAGES.tooManyGoals })

  if (document.run?.status !== 'active') return contentSuccess()

  if (activeGoals.length < MIN_GOALS) return contentFailure({ goals: CONTENT_MESSAGES.lastGoal })

  const activeGoalIds = new Set(activeGoals.map((goal) => goal.id))
  const activeTasks = tasks.filter((task) => task.active)
  if (activeTasks.some((task) => !activeGoalIds.has(task.goalId))) {
    return contentFailure({ tasks: CONTENT_MESSAGES.orphanTask })
  }
  if (activeTasks.length < MIN_ACTIVE_TASKS) {
    return contentFailure({ tasks: CONTENT_MESSAGES.fewRoutines })
  }
  return contentSuccess()
}
