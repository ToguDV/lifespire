import { MAX_WEEKLY_OBJECTIVE, MIN_WEEKLY_OBJECTIVE } from '../domain/balance.js'
import type { Goal, OnboardingDraft, OnboardingSetup, Task } from '../domain/types.js'

export const DEFAULT_TRAVELLER = 'Wayfarer'
export const ONBOARDING_STEPS = 3

export function createEmptyDraft(): OnboardingDraft {
  return {
    step: 0,
    mode: null,
    name: '',
    goals: [],
    tasks: [],
  }
}

/** Prepares a draft for the atomic run transition. */
export function draftToSetup(draft: OnboardingDraft): OnboardingSetup {
  return {
    name: draft.name.trim() || DEFAULT_TRAVELLER,
    goals: draft.goals,
    tasks: draft.tasks,
  }
}

function clampObjective(value: number): number {
  return Math.min(MAX_WEEKLY_OBJECTIVE, Math.max(MIN_WEEKLY_OBJECTIVE, Math.trunc(value)))
}

/**
 * Suggested weekly target derived from the active trials under a goal. Keeping
 * one spare slot leaves room for a missed day without making the goal trivial.
 */
export function suggestedWeeklyObjective(goalId: string, tasks: readonly Task[]): number {
  const trials = tasks.filter((task) => task.active && task.goalId === goalId).length
  return clampObjective(trials + 1)
}

/** Applies the routine-based suggestion to every goal in the draft. */
export function withSuggestedObjectives(
  goals: readonly Goal[],
  tasks: readonly Task[],
): Goal[] {
  return goals.map((goal) => ({
    ...goal,
    weeklyObjective: suggestedWeeklyObjective(goal.id, tasks),
  }))
}
