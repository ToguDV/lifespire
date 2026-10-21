import { describe, expect, it } from 'vitest'
import { createRun } from './lifecycle'
import {
  countActiveGoals,
  countActiveTasks,
  currentDay,
  levelForXp,
  objectiveProgress,
  safeCount,
  xpIntoLevel,
  xpToNextLevel,
} from './selectors'
import type { Goal, Run, Task } from './types'

const now = new Date(2026, 9, 20, 9, 0, 0)

const goal: Goal = {
  id: 'goal_1',
  title: 'Wayfarer',
  category: 'Movement',
  weeklyObjective: 4,
  active: true,
  createdAt: now.toISOString(),
}

const tasks: Task[] = [
  {
    id: 'task_1',
    goalId: 'goal_1',
    title: 'Walk',
    effort: 'light',
    active: true,
    createdAt: now.toISOString(),
  },
  {
    id: 'task_2',
    goalId: 'goal_1',
    title: 'Ride',
    effort: 'medium',
    active: false,
    createdAt: now.toISOString(),
  },
]

function makeRun(): Run {
  return createRun({
    setup: { goals: [goal], tasks },
    now,
    runId: 'run_test',
  })
}

describe('level selectors', () => {
  it('maps XP to levels at boundaries', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(99)).toBe(1)
    expect(levelForXp(100)).toBe(2)
    expect(levelForXp(199)).toBe(2)
    expect(levelForXp(200)).toBe(3)
    expect(levelForXp(-50)).toBe(1)
  })

  it('reports progress inside the current level', () => {
    expect(xpIntoLevel(0)).toBe(0)
    expect(xpIntoLevel(99)).toBe(99)
    expect(xpIntoLevel(100)).toBe(0)
    expect(xpIntoLevel(250)).toBe(50)
    expect(xpToNextLevel(0)).toBe(100)
    expect(xpToNextLevel(99)).toBe(1)
    expect(xpToNextLevel(100)).toBe(100)
    expect(xpToNextLevel(250)).toBe(50)
  })

  it('normalizes unsafe counters', () => {
    expect(safeCount(Number.NaN)).toBe(0)
    expect(safeCount(Number.POSITIVE_INFINITY)).toBe(0)
    expect(safeCount(-5)).toBe(0)
    expect(safeCount(3.9)).toBe(3)
  })
})

describe('run selectors', () => {
  it('returns the first day that is not closed', () => {
    const run = makeRun()
    expect(currentDay(run)?.index).toBe(0)

    const next: Run = {
      ...run,
      days: run.days.map((day, index) =>
        index === 0 ? { ...day, status: 'completed' as const } : day,
      ),
    }
    expect(currentDay(next)?.index).toBe(1)
    expect(currentDay(null)).toBeNull()
    expect(currentDay({ ...run, status: 'closed' })).toBeNull()

    const allClosed: Run = {
      ...run,
      days: run.days.map((day) => ({ ...day, status: 'completed' as const })),
    }
    expect(currentDay(allClosed)).toBeNull()
  })

  it('finds weekly objective progress', () => {
    const run = makeRun()
    expect(objectiveProgress(run, 'goal_1')).toMatchObject({
      goalTitle: 'Wayfarer',
      target: 4,
      progress: 0,
    })
    expect(objectiveProgress(run, 'missing')).toBeNull()
    expect(objectiveProgress(null, 'goal_1')).toBeNull()
  })

  it('counts active goals and tasks safely', () => {
    expect(countActiveGoals([goal, { ...goal, id: 'goal_2', active: false }])).toBe(1)
    expect(countActiveTasks(tasks)).toBe(1)
    expect(countActiveTasks(tasks, [goal])).toBe(1)
    expect(countActiveTasks(tasks, [{ ...goal, active: false }])).toBe(0)
  })
})
