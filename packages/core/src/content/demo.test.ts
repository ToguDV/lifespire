import { describe, expect, it } from 'vitest'
import {
  AIM_WITHOUT_ROUTINE,
  createDemoSetup,
  validateSetup,
} from './demo'
import { MAX_GOALS } from '../domain/balance'
import type { Goal, Task } from '../domain/types'

const now = new Date(2026, 9, 20, 8, 0, 0)

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal_1',
    title: 'Wayfarer',
    category: 'Movement',
    icon: 'compass',
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

function fourTasks(): Task[] {
  return [
    makeTask({ id: 'task_1' }),
    makeTask({ id: 'task_2' }),
    makeTask({ id: 'task_3' }),
    makeTask({ id: 'task_4' }),
  ]
}

describe('createDemoSetup', () => {
  it('creates a valid demo with two goals and five routines', () => {
    const setup = createDemoSetup(now)
    expect(setup.name).toBe('Wren')
    expect(setup.goals).toHaveLength(2)
    expect(setup.tasks).toHaveLength(5)
    expect(validateSetup(setup.goals, setup.tasks)).toEqual({ ok: true, errors: [] })
  })

  it('uses weekly objectives 4 and 3', () => {
    const setup = createDemoSetup(now)
    expect(setup.goals.map((goal) => [goal.title, goal.weeklyObjective])).toEqual([
      ['Wayfarer', 4],
      ['Craft', 3],
    ])
  })

  it('varies effort across all three levels', () => {
    const setup = createDemoSetup(now)
    expect(new Set(setup.tasks.map((task) => task.effort))).toEqual(
      new Set(['light', 'medium', 'high']),
    )
    expect(setup.tasks.every((task) => task.active)).toBe(true)
    expect(setup.goals.every((goal) => goal.active)).toBe(true)
  })

  it('belongs every routine to an active goal with unique ids', () => {
    const setup = createDemoSetup(now)
    const goalIds = new Set(setup.goals.map((goal) => goal.id))
    expect(setup.tasks.every((task) => goalIds.has(task.goalId))).toBe(true)
    const allIds = [...setup.goals, ...setup.tasks].map((item) => item.id)
    expect(new Set(allIds).size).toBe(allIds.length)
  })

  it('is deterministic for the same injected time', () => {
    expect(createDemoSetup(now)).toEqual(createDemoSetup(now))
    expect(createDemoSetup(new Date(2026, 9, 21, 8))).not.toEqual(createDemoSetup(now))
  })
})

describe('validateSetup', () => {
  it('accepts a minimal valid setup', () => {
    expect(validateSetup([makeGoal()], fourTasks())).toEqual({ ok: true, errors: [] })
  })

  it('accepts ten active goals and rejects an eleventh', () => {
    expect(validateSetup([], fourTasks()).errors).toContain('Choose at least one goal to begin.')

    const goals = Array.from({ length: MAX_GOALS }, (_, index) =>
      makeGoal({ id: `goal_${index}`, weeklyObjective: 2 }),
    )
    const tasks = goals.map((goal, index) =>
      makeTask({ id: `task_${index}`, goalId: goal.id }),
    )
    expect(validateSetup(goals, tasks)).toEqual({ ok: true, errors: [] })

    const tooManyGoals = [
      ...goals,
      makeGoal({ id: `goal_${MAX_GOALS}`, weeklyObjective: 2 }),
    ]
    const tooManyTasks = [
      ...tasks,
      makeTask({ id: `task_${MAX_GOALS}`, goalId: `goal_${MAX_GOALS}` }),
    ]
    expect(validateSetup(tooManyGoals, tooManyTasks).errors).toContain(
      `A run can hold at most ${MAX_GOALS} goals.`,
    )
  })

  it('rejects fewer than four active routines', () => {
    const validation = validateSetup([makeGoal()], fourTasks().slice(0, 3))
    expect(validation.ok).toBe(false)
    expect(validation.errors).toContain('Add at least 4 routines to light the week.')
  })

  it('ignores archived routines when counting', () => {
    const tasks = [...fourTasks(), makeTask({ id: 'task_5', active: false })]
    expect(validateSetup([makeGoal()], tasks.slice(0, 3)).ok).toBe(false)
    expect(validateSetup([makeGoal()], tasks).ok).toBe(true)
  })

  it('requires at least one active routine per active goal', () => {
    const goals = [makeGoal(), makeGoal({ id: 'goal_2', title: 'Craft' })]
    const allInOneAim = fourTasks()
    const allInOne = validateSetup(goals, allInOneAim)
    expect(allInOne.ok).toBe(false)
    expect(allInOne.errors).toContain(AIM_WITHOUT_ROUTINE)

    const split = fourTasks().map((task, index) => ({
      ...task,
      goalId: index < 2 ? 'goal_1' : 'goal_2',
    }))
    expect(validateSetup(goals, split)).toEqual({ ok: true, errors: [] })

    const threeGoals = [
      makeGoal(),
      makeGoal({ id: 'goal_2', title: 'Craft' }),
      makeGoal({ id: 'goal_3', title: 'Hearth' }),
    ]
    const oneEach = [
      makeTask({ id: 'task_1', goalId: 'goal_1' }),
      makeTask({ id: 'task_2', goalId: 'goal_1' }),
      makeTask({ id: 'task_3', goalId: 'goal_2' }),
      makeTask({ id: 'task_4', goalId: 'goal_3' }),
    ]
    expect(validateSetup(threeGoals, oneEach)).toEqual({ ok: true, errors: [] })
  })

  it('rejects weekly objectives outside 1..7', () => {
    expect(validateSetup([makeGoal({ weeklyObjective: 0 })], fourTasks()).errors).toContain(
      'Set each weekly target between 1 and 7.',
    )
    expect(validateSetup([makeGoal({ weeklyObjective: 8 })], fourTasks()).errors).toContain(
      'Set each weekly target between 1 and 7.',
    )
  })

  it('rejects routines without an active goal', () => {
    const tasks = fourTasks()
    tasks[0] = { ...tasks[0]!, goalId: 'missing_goal' }
    expect(validateSetup([makeGoal()], tasks).errors).toContain(
      'Every routine needs a goal in this run.',
    )

    const archivedGoal = makeGoal({ id: 'goal_2', active: false })
    expect(validateSetup([makeGoal(), archivedGoal], fourTasks()).ok).toBe(true)
    const tasksOnArchived = fourTasks().map((task) => ({ ...task, goalId: archivedGoal.id }))
    expect(validateSetup([makeGoal(), archivedGoal], tasksOnArchived).ok).toBe(false)
  })

  it('rejects unnamed goals and routines', () => {
    expect(validateSetup([makeGoal({ title: ' ' })], fourTasks()).errors).toContain(
      'Give every goal a name.',
    )
    const tasks = fourTasks()
    tasks[0] = { ...tasks[0]!, title: '' }
    expect(validateSetup([makeGoal()], tasks).errors).toContain('Give every routine a name.')
  })

  it('rejects repeated ids', () => {
    const tasks = fourTasks()
    tasks[1] = { ...tasks[1]!, id: tasks[0]!.id }
    expect(validateSetup([makeGoal()], tasks).errors).toContain(
      'Something in this list was repeated. Please try again.',
    )
  })
})
