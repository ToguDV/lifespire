import { nextGoalIcon } from '@lifespire/core'
import type { Goal, GoalInput, Task, TaskInput } from '@lifespire/core'

export interface DraftIdDeps {
  newId: (prefix: string) => string
  now: () => Date
}

/**
 * Draft twin of the store's `saveGoal` construction: same trimming and
 * defaults, but no validation — the onboarding draft keeps intermediate
 * values (e.g. a weekly target of 8) and `validateSetup` runs on confirm.
 */
export function upsertDraftGoal(
  goals: Goal[],
  input: GoalInput,
  deps: DraftIdDeps,
): Goal[] {
  const existing = input.id ? goals.find((goal) => goal.id === input.id) : undefined
  if (existing) {
    return goals.map((goal) =>
      goal.id === existing.id
        ? {
            ...goal,
            title: input.title,
            category: input.category ?? goal.category,
            description: (input.description ?? goal.description ?? '').trim(),
            icon: input.icon ?? goal.icon,
            weeklyObjective: input.weeklyObjective,
            active: input.active,
          }
        : goal,
    )
  }
  return [
    ...goals,
    {
      id: deps.newId('goal'),
      title: input.title.trim(),
      category: (input.category ?? '').trim() || 'General',
      description: (input.description ?? '').trim(),
      icon: input.icon ?? nextGoalIcon(goals),
      weeklyObjective: input.weeklyObjective,
      active: input.active,
      createdAt: deps.now().toISOString(),
    },
  ]
}

/** Draft twin of the store's `saveTask` construction (no validation). */
export function upsertDraftTask(
  tasks: Task[],
  input: TaskInput,
  deps: DraftIdDeps,
): Task[] {
  const existing = input.id ? tasks.find((task) => task.id === input.id) : undefined
  if (existing) {
    return tasks.map((task) =>
      task.id === existing.id
        ? {
            ...task,
            goalId: input.goalId,
            title: input.title,
            effort: input.effort,
            active: input.active,
          }
        : task,
    )
  }
  return [
    ...tasks,
    {
      id: deps.newId('task'),
      goalId: input.goalId,
      title: input.title.trim(),
      effort: input.effort,
      active: input.active,
      createdAt: deps.now().toISOString(),
    },
  ]
}
