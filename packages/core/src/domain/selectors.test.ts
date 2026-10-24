import { describe, expect, it } from 'vitest'
import { createRun } from './lifecycle.js'
import {
  countActiveGoals,
  countActiveTasks,
  currentDay,
  levelForXp,
  nodeProgress,
  objectiveProgress,
  safeCount,
  xpIntoLevel,
  xpToNextLevel,
} from './selectors.js'
import type { Goal, MapNode, Run, Task } from './types.js'

const now = new Date(2026, 9, 20, 9, 0, 0)

const goal: Goal = {
  id: 'goal_1',
  title: 'Wayfarer',
  category: 'Movement',
  icon: 'compass',
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

describe('node progress selector', () => {
  const run = makeRun()

  function node(patch: Partial<MapNode> = {}): MapNode {
    return {
      id: 'node_1',
      layer: 0,
      type: 'task',
      task: {
        taskId: 'task_1',
        title: 'Walk',
        goalId: 'goal_1',
        goalTitle: 'Wayfarer',
        effort: 'light',
      },
      rewards: { xp: 10, gold: 10, lootRolls: 0, progress: 1 },
      connections: [],
      ...patch,
    }
  }

  it('grants progress when the goal belongs to the run objectives', () => {
    expect(nodeProgress(run, node())).toBe(1)
  })

  it('grants nothing when the goal was added after the run started', () => {
    const addedGoal = node({
      task: {
        taskId: 'task_3',
        title: 'Stretch',
        goalId: 'goal_added',
        goalTitle: 'Later',
        effort: 'light',
      },
    })
    expect(nodeProgress(run, addedGoal)).toBe(0)
  })

  it('grants nothing without a task or without a progress reward', () => {
    expect(nodeProgress(run, node({ type: 'rest', task: null }))).toBe(0)
    expect(
      nodeProgress(run, node({ rewards: { xp: 5, gold: 0, lootRolls: 0, progress: 0 } })),
    ).toBe(0)
  })

  it('grants nothing without an active run', () => {
    expect(nodeProgress(null, node())).toBe(0)
  })
})
