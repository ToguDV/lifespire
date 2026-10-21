import { describe, expect, it } from 'vitest'
import { createDemoSetup, validateSetup } from '../../content/demo'
import { MAX_WEEKLY_OBJECTIVE, MIN_WEEKLY_OBJECTIVE } from '../../domain/balance'
import {
  initialWeeklyTargets,
  validateNewRunSetup,
} from './newRun'

const now = new Date(2026, 9, 26, 9, 0, 0)
const setup = createDemoSetup(now)

describe('initialWeeklyTargets', () => {
  it('prefills only active aims with their current targets', () => {
    const goals = [
      ...setup.goals,
      { ...setup.goals[0]!, id: 'archived', title: 'Old aim', active: false },
    ]
    expect(initialWeeklyTargets(goals)).toEqual({
      'demo-goal-wayfarer': '4',
      'demo-goal-craft': '3',
    })
  })
})

describe('validateNewRunSetup', () => {
  it('accepts the active aims and routines with adjusted 1–7 targets', () => {
    const targets = initialWeeklyTargets(setup.goals)
    targets['demo-goal-wayfarer'] = '1'
    targets['demo-goal-craft'] = String(MAX_WEEKLY_OBJECTIVE)

    const result = validateNewRunSetup(setup.goals, setup.tasks, targets)
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.activeGoals).toHaveLength(2)
    expect(result.activeRoutines).toBe(5)
    expect(result.goals.map((goal) => goal.weeklyObjective)).toEqual([1, 7])
    // The editable content is not mutated.
    expect(setup.goals.map((goal) => goal.weeklyObjective)).toEqual([4, 3])
  })

  it('rejects targets outside the 1–7 range with a field error', () => {
    for (const value of ['0', '8', '2.5', '', 'seven']) {
      const targets = initialWeeklyTargets(setup.goals)
      targets['demo-goal-wayfarer'] = value
      const result = validateNewRunSetup(setup.goals, setup.tasks, targets)
      expect(result.ok).toBe(false)
      expect(result.fieldErrors['demo-goal-wayfarer']).toContain(
        `${MIN_WEEKLY_OBJECTIVE}`,
      )
      expect(result.errors).toContain(result.fieldErrors['demo-goal-wayfarer'])
    }
  })

  it('requires at least one active aim and four active routines', () => {
    const targets = initialWeeklyTargets(setup.goals)
    const noGoals = validateNewRunSetup(
      setup.goals.map((goal) => ({ ...goal, active: false })),
      setup.tasks,
      targets,
    )
    expect(noGoals.ok).toBe(false)
    expect(noGoals.errors).toContain('Choose at least one aim to begin.')

    const fewRoutines = validateNewRunSetup(setup.goals, setup.tasks.slice(0, 3), targets)
    expect(fewRoutines.ok).toBe(false)
    expect(fewRoutines.errors).toContain('Add at least 4 routines to light the week.')
    expect(fewRoutines.activeRoutines).toBe(3)

    const missingTarget = initialWeeklyTargets(setup.goals)
    delete missingTarget['demo-goal-craft']
    const missing = validateNewRunSetup(setup.goals, setup.tasks, missingTarget)
    expect(missing.ok).toBe(false)
    expect(missing.fieldErrors['demo-goal-craft']).toBeTruthy()
  })

  it('reuses the same setup rules as onboarding', () => {
    const targets = initialWeeklyTargets(setup.goals)
    const adjusted = setup.goals.map((goal) => ({
      ...goal,
      weeklyObjective: Number(targets[goal.id]),
    }))
    const expected = validateSetup(adjusted, setup.tasks)
    const result = validateNewRunSetup(setup.goals, setup.tasks, targets)
    expect(result.errors).toEqual(expected.errors)
  })
})
