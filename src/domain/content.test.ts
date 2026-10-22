import { describe, expect, it } from 'vitest'
import { createDemoSetup } from '../content/demo'
import { MAX_GOALS } from './balance'
import { createRun } from './lifecycle'
import { createEmptyDocument } from './schema'
import {
  CONTENT_MESSAGES,
  activeTasksUnderActiveGoals,
  validateContentConstraints,
  validateGoalInput,
  validateTaskInput,
} from './content'
import type { Effort, GameDocument, Goal, Task } from './types'

const now = new Date(2026, 9, 20, 9, 0, 0)

function demoDocument(): GameDocument {
  const setup = createDemoSetup(now)
  return {
    ...createEmptyDocument(),
    goals: setup.goals,
    tasks: setup.tasks,
    run: createRun({ setup, now, runId: 'run_content' }),
  }
}

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal_1',
    title: 'Wayfarer',
    category: 'Movement',
    weeklyObjective: 4,
    active: true,
    createdAt: now.toISOString(),
    ...overrides,
  }
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task_1',
    goalId: 'goal_1',
    title: 'Walk the north trail',
    effort: 'light',
    active: true,
    createdAt: now.toISOString(),
    ...overrides,
  }
}

function fourTasks(goalId = 'goal_1'): Task[] {
  return [1, 2, 3, 4].map((index) =>
    makeTask({ id: `task_${index}`, goalId, title: `Routine ${index}` }),
  )
}

describe('validateGoalInput', () => {
  it('accepts a titled goal inside the weekly range', () => {
    expect(validateGoalInput(makeGoal())).toEqual({})
  })

  it('rejects empty titles and weekly objectives outside 1..7', () => {
    expect(validateGoalInput(makeGoal({ title: '  ' })).title).toBe(
      CONTENT_MESSAGES.goalTitle,
    )
    expect(validateGoalInput(makeGoal({ weeklyObjective: 0 })).weeklyObjective).toBe(
      CONTENT_MESSAGES.weeklyObjective,
    )
    expect(validateGoalInput(makeGoal({ weeklyObjective: 8 })).weeklyObjective).toBe(
      CONTENT_MESSAGES.weeklyObjective,
    )
    expect(validateGoalInput(makeGoal({ weeklyObjective: 2.5 })).weeklyObjective).toBe(
      CONTENT_MESSAGES.weeklyObjective,
    )
  })
})

describe('validateTaskInput', () => {
  it('accepts a titled routine under an active goal', () => {
    expect(validateTaskInput(makeTask(), [makeGoal()])).toEqual({})
  })

  it('rejects empty titles, unknown/inactive goals and unknown effort', () => {
    expect(validateTaskInput(makeTask({ title: ' ' }), [makeGoal()]).title).toBe(
      CONTENT_MESSAGES.taskTitle,
    )
    expect(validateTaskInput(makeTask({ goalId: 'missing' }), [makeGoal()]).goalId).toBe(
      CONTENT_MESSAGES.taskGoal,
    )
    expect(
      validateTaskInput(makeTask(), [makeGoal({ active: false })]).goalId,
    ).toBe(CONTENT_MESSAGES.taskGoal)
    expect(
      validateTaskInput(makeTask({ effort: 'extreme' as Effort }), [makeGoal()]).effort,
    ).toBe(CONTENT_MESSAGES.taskEffort)
  })
})

describe('validateContentConstraints', () => {
  it('allows incomplete content while no run is active', () => {
    const document = { ...createEmptyDocument(), goals: [makeGoal()], tasks: [] }
    expect(validateContentConstraints(document, document.goals, document.tasks).ok).toBe(true)
  })

  it('allows ten active goals and rejects an eleventh even without a run', () => {
    const document = createEmptyDocument()
    const tenGoals = Array.from({ length: MAX_GOALS }, (_, index) =>
      makeGoal({ id: `goal_${index}` }),
    )
    expect(validateContentConstraints(document, tenGoals, []).ok).toBe(true)

    const elevenGoals = [
      ...tenGoals,
      makeGoal({ id: `goal_${MAX_GOALS}` }),
    ]
    const result = validateContentConstraints(document, elevenGoals, [])
    expect(result.ok).toBe(false)
    expect(result.errors).toContain(CONTENT_MESSAGES.tooManyGoals)
    expect(CONTENT_MESSAGES.tooManyGoals).toContain(String(MAX_GOALS))
  })

  it('keeps a playable setup during an active run', () => {
    const document = demoDocument()
    expect(validateContentConstraints(document, document.goals, document.tasks).ok).toBe(true)

    const goal = document.goals[0]
    if (!goal) throw new Error('expected a demo goal')
    const withoutActiveGoals = document.goals.map((candidate) => ({
      ...candidate,
      active: false,
    }))
    expect(
      validateContentConstraints(document, withoutActiveGoals, document.tasks).errors,
    ).toContain(CONTENT_MESSAGES.lastGoal)

    const onlyGoal = makeGoal()
    const oneGoalDocument = {
      ...createEmptyDocument(),
      goals: [onlyGoal],
      tasks: fourTasks().slice(0, 3),
      run: createRun({
        setup: { goals: [onlyGoal], tasks: fourTasks() },
        now,
        runId: 'run_content_one',
      }),
    }
    expect(
      validateContentConstraints(oneGoalDocument, oneGoalDocument.goals, oneGoalDocument.tasks)
        .errors,
    ).toContain(CONTENT_MESSAGES.fewRoutines)
  })

  it('rejects active routines pointing at an inactive goal', () => {
    const document = demoDocument()
    const goal = document.goals[0]
    if (!goal) throw new Error('expected a demo goal')
    const orphan = makeTask({ id: 'task_orphan', goalId: goal.id })
    const goals = document.goals.map((candidate) =>
      candidate.id === goal.id ? { ...candidate, active: false } : candidate,
    )
    expect(validateContentConstraints(document, goals, [...document.tasks, orphan]).errors).toContain(
      CONTENT_MESSAGES.orphanTask,
    )
  })

  it('counts only active routines under active goals', () => {
    const goals = [makeGoal(), makeGoal({ id: 'goal_2' })]
    const tasks = [
      ...fourTasks(),
      makeTask({ id: 'task_archived', active: false }),
      makeTask({ id: 'task_orphan', goalId: 'goal_archived' }),
    ]
    expect(activeTasksUnderActiveGoals(goals, tasks).map((task) => task.id)).toEqual([
      'task_1',
      'task_2',
      'task_3',
      'task_4',
    ])
  })
})
