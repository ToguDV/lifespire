import { describe, expect, it } from 'vitest'
import { createDemoSetup } from './demo.js'
import {
  createEmptyDraft,
  draftToSetup,
  suggestedWeeklyObjective,
  withSuggestedObjectives,
} from './onboarding.js'
import type { Task } from '../domain/types.js'

const now = new Date(2026, 9, 20, 8, 0, 0)

function task(overrides: Partial<Task>): Task {
  return {
    id: 'task_1',
    goalId: 'goal_1',
    title: 'Walk',
    effort: 'light',
    active: true,
    createdAt: now.toISOString(),
    ...overrides,
  }
}

describe('onboarding draft helpers', () => {
  it('creates an empty draft at the welcome step', () => {
    expect(createEmptyDraft()).toEqual({
      step: 0,
      mode: null,
      name: '',
      goals: [],
      tasks: [],
    })
  })

  it('falls back to Wayfarer and trims the optional name', () => {
    expect(draftToSetup({ ...createEmptyDraft(), name: '   ' }).name).toBe('Wayfarer')
    expect(draftToSetup({ ...createEmptyDraft(), name: '  Ari  ' }).name).toBe('Ari')
  })

  it('suggests one weekly target above the active routine count, capped at 7', () => {
    expect(suggestedWeeklyObjective('goal_1', [])).toBe(1)
    expect(suggestedWeeklyObjective('goal_1', [task({ id: 'a' })])).toBe(2)
    expect(
      suggestedWeeklyObjective('goal_1', [
        task({ id: 'a' }),
        task({ id: 'b' }),
        task({ id: 'c', active: false }),
        task({ id: 'd', goalId: 'other' }),
      ]),
    ).toBe(3)
    expect(
      suggestedWeeklyObjective(
        'goal_1',
        Array.from({ length: 9 }, (_, index) => task({ id: `task_${index}` })),
      ),
    ).toBe(7)
  })

  it('applies suggestions without mutating the draft goals', () => {
    const setup = createDemoSetup(now)
    const craft = setup.goals[1]
    if (!craft) throw new Error('expected the demo craft goal')
    const extra = [
      task({ id: 'extra_1', goalId: craft.id }),
      task({ id: 'extra_2', goalId: craft.id }),
    ]
    const suggested = withSuggestedObjectives(setup.goals, [...setup.tasks, ...extra])
    expect(suggested.map((goal) => goal.weeklyObjective)).toEqual([4, 5])
    expect(setup.goals.map((goal) => goal.weeklyObjective)).toEqual([4, 3])
    expect(suggested[0]).not.toBe(setup.goals[0])
    expect(suggested[1]?.id).toBe(setup.goals[1]?.id)
  })
})
