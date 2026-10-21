import {
  MAX_GOALS,
  MAX_WEEKLY_OBJECTIVE,
  MIN_ACTIVE_TASKS,
  MIN_WEEKLY_OBJECTIVE,
} from '../domain/balance'
import type { Goal, OnboardingSetup, Task } from '../domain/types'

export const DEMO_NAME = 'Wren'

export interface SetupValidation {
  ok: boolean
  errors: string[]
}

/**
 * Reusable onboarding/run validation. Messages are written for the English UI,
 * not for developers.
 */
export function validateSetup(
  goals: readonly Goal[],
  tasks: readonly Task[],
): SetupValidation {
  const errors: string[] = []
  const activeGoals = goals.filter((goal) => goal.active)
  const activeGoalIds = new Set(activeGoals.map((goal) => goal.id))
  const activeTasks = tasks.filter((task) => task.active)

  if (activeGoals.length < 1) {
    errors.push('Choose at least one aim to begin.')
  }
  if (activeGoals.length > MAX_GOALS) {
    errors.push(`A run can hold at most ${MAX_GOALS} aims.`)
  }
  if (activeTasks.length < MIN_ACTIVE_TASKS) {
    errors.push(`Add at least ${MIN_ACTIVE_TASKS} routines to light the week.`)
  }

  for (const goal of activeGoals) {
    if (!goal.title.trim()) {
      errors.push('Give every aim a name.')
    }
    if (
      !Number.isInteger(goal.weeklyObjective) ||
      goal.weeklyObjective < MIN_WEEKLY_OBJECTIVE ||
      goal.weeklyObjective > MAX_WEEKLY_OBJECTIVE
    ) {
      errors.push(
        `Set each weekly aim between ${MIN_WEEKLY_OBJECTIVE} and ${MAX_WEEKLY_OBJECTIVE}.`,
      )
    }
  }

  for (const task of activeTasks) {
    if (!task.title.trim()) {
      errors.push('Give every routine a name.')
    }
    if (!activeGoalIds.has(task.goalId)) {
      errors.push('Every routine needs an aim in this run.')
    }
  }

  const ids = [...goals, ...tasks].map((item) => item.id)
  if (new Set(ids).size !== ids.length) {
    errors.push('Something in this list was repeated. Please try again.')
  }

  const uniqueErrors = [...new Set(errors)]
  return { ok: uniqueErrors.length === 0, errors: uniqueErrors }
}

/** Deterministic demo onboarding payload: 2 aims, 5 active routines. */
export function createDemoSetup(now: Date): OnboardingSetup {
  const createdAt = now.toISOString()

  const goals: Goal[] = [
    {
      id: 'demo-goal-wayfarer',
      title: 'Wayfarer',
      category: 'Movement',
      weeklyObjective: 4,
      active: true,
      createdAt,
    },
    {
      id: 'demo-goal-craft',
      title: 'Craft',
      category: 'Making',
      weeklyObjective: 3,
      active: true,
      createdAt,
    },
  ]

  const tasks: Task[] = [
    {
      id: 'demo-task-walk-north-trail',
      goalId: 'demo-goal-wayfarer',
      title: 'Walk the north trail',
      effort: 'light',
      active: true,
      createdAt,
    },
    {
      id: 'demo-task-ride-before-dawn',
      goalId: 'demo-goal-wayfarer',
      title: 'Ride before dawn',
      effort: 'medium',
      active: true,
      createdAt,
    },
    {
      id: 'demo-task-climb-old-stair',
      goalId: 'demo-goal-wayfarer',
      title: 'Climb the old stair',
      effort: 'high',
      active: true,
      createdAt,
    },
    {
      id: 'demo-task-write-one-page',
      goalId: 'demo-goal-craft',
      title: 'Write one page',
      effort: 'medium',
      active: true,
      createdAt,
    },
    {
      id: 'demo-task-mend-old-chair',
      goalId: 'demo-goal-craft',
      title: 'Mend the old chair',
      effort: 'high',
      active: true,
      createdAt,
    },
  ]

  return { name: DEMO_NAME, goals, tasks }
}
