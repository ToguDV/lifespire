import { XP_PER_LEVEL } from './balance'
import type { Day, Goal, Run, RunObjective, Task } from './types'

/** Normalizes any counter to a finite, non-negative integer. */
export function safeCount(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.trunc(value))
}

export function levelForXp(xp: number): number {
  return Math.floor(safeCount(xp) / XP_PER_LEVEL) + 1
}

export function xpIntoLevel(xp: number): number {
  return safeCount(xp) % XP_PER_LEVEL
}

export function xpToNextLevel(xp: number): number {
  return XP_PER_LEVEL - xpIntoLevel(xp)
}

/** First day that is neither completed nor missed, or null for a closed run. */
export function currentDay(run: Run | null): Day | null {
  if (!run || run.status === 'closed') return null
  return run.days.find((day) => day.status !== 'completed' && day.status !== 'missed') ?? null
}

export function objectiveProgress(run: Run | null, goalId: string): RunObjective | null {
  if (!run) return null
  return run.objectives.find((objective) => objective.goalId === goalId) ?? null
}

export function countActiveGoals(goals: readonly Goal[]): number {
  let total = 0
  for (const goal of goals) {
    if (goal.active) total += 1
  }
  return total
}

export function countActiveTasks(tasks: readonly Task[], goals?: readonly Goal[]): number {
  const activeGoalIds = goals
    ? new Set(goals.filter((goal) => goal.active).map((goal) => goal.id))
    : null
  let total = 0
  for (const task of tasks) {
    if (task.active && (!activeGoalIds || activeGoalIds.has(task.goalId))) {
      total += 1
    }
  }
  return total
}
