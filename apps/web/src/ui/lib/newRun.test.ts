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
  it('prefills only active goals with their current targets', () => {
    const goals = [
      ...setup.goals,
      { ...setup.goals[0]!, id: 'archived', title: 'Old goal', active: false },
    ]
    expect(initialWeeklyTargets(goals)).toEqual({
      'demo-goal-wayfarer': '4',
      'demo-goal-craft': '3',
    })
  })
})

describe('validateNewRunSetup', () => {
  it('accepts the active goals and trials with adjusted 1–7 targets', () => {
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

  it('requires at least one active goal and four active trials', () => {
    const targets = initialWeeklyTargets(setup.goals)
    const noGoals = validateNewRunSetup(
      setup.goals.map((goal) => ({ ...goal, active: false })),
      setup.tasks,
      targets,
    )
    expect(noGoals.ok).toBe(false)
    expect(noGoals.errors).toContain('Choose at least one goal to begin.')

    const fewRoutines = validateNewRunSetup(setup.goals, setup.tasks.slice(0, 3), targets)
    expect(fewRoutines.ok).toBe(false)
    expect(fewRoutines.errors).toContain('Add at least 4 trials to light the week.')
    expect(fewRoutines.activeRoutines).toBe(3)

    const missingTarget = initialWeeklyTargets(setup.goals)
    delete missingTarget['demo-goal-craft']
    const missing = validateNewRunSetup(setup.goals, setup.tasks, missingTarget)
    expect(missing.ok).toBe(false)
    expect(missing.fieldErrors['demo-goal-craft']).toBeTruthy()
  })

  it('requires a trial under every active goal', () => {
    const targets = initialWeeklyTargets(setup.goals)
    const allInOneAim = setup.tasks.map((task) => ({
      ...task,
      goalId: 'demo-goal-wayfarer',
    }))
    const result = validateNewRunSetup(setup.goals, allInOneAim, targets)
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('Every active goal needs at least one active trial.')
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

describe('prototype-safe weekly targets', () => {
  it('handles a goal id that collides with Object.prototype', () => {
    const goal = {
      ...setup.goals[0]!,
      id: '__proto__',
      title: 'Proto goal',
    }
    const tasks = setup.tasks.map((task) => ({ ...task, goalId: goal.id }))
    const targets = initialWeeklyTargets([goal])

    expect(Object.getPrototypeOf(targets)).toBeNull()
    expect(Object.hasOwn(targets, '__proto__')).toBe(true)
    expect(targets['__proto__']).toBe(String(goal.weeklyObjective))

    expect(() => validateNewRunSetup([goal], tasks, targets)).not.toThrow()
    const result = validateNewRunSetup([goal], tasks, targets)
    expect(Object.getPrototypeOf(result.fieldErrors)).toBeNull()
  })

  it('rejects an empty plain targets object without throwing', () => {
    const result = validateNewRunSetup(setup.goals, setup.tasks, {})
    expect(result.ok).toBe(false)
    expect(result.fieldErrors['demo-goal-wayfarer']).toBeTruthy()

    const goal = { ...setup.goals[0]!, id: '__proto__', title: 'Proto goal' }
    const tasks = setup.tasks.map((task) => ({ ...task, goalId: goal.id }))
    expect(() => validateNewRunSetup([goal], tasks, {})).not.toThrow()
    const protoResult = validateNewRunSetup([goal], tasks, {})
    expect(protoResult.ok).toBe(false)
    expect(protoResult.fieldErrors['__proto__']).toBeTruthy()
  })

  it('stays safe after the dialog spreads a target update', () => {
    const goal = { ...setup.goals[0]!, id: '__proto__', title: 'Proto goal' }
    const tasks = setup.tasks.map((task) => ({ ...task, goalId: goal.id }))
    const targets = { ...initialWeeklyTargets([goal]), [goal.id]: '5' }

    // The spread loses the null prototype, so the validator must ignore
    // inherited keys instead of trusting bracket access alone.
    expect(Object.getPrototypeOf(targets)).toBe(Object.prototype)
    expect(() => validateNewRunSetup([goal], tasks, targets)).not.toThrow()
    const result = validateNewRunSetup([goal], tasks, targets)
    expect(result.fieldErrors['__proto__']).toBeUndefined()
  })
})
