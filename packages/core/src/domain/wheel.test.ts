import { describe, expect, it } from 'vitest'
import { createDemoSetup } from '../content/demo.js'
import {
  WHEEL_GOLD,
  WHEEL_REST_XP,
  WHEEL_SECTORS,
  WHEEL_XP,
} from './balance.js'
import {
  computeDaySummary,
  computeRunTotals,
  createRun,
  resolveNode,
  rollWheelOutcome,
} from './lifecycle.js'
import { rewardsForNode } from './rewards.js'
import { createEmptyDocument } from './schema.js'
import { availableNodeIds, currentDay } from './selectors.js'
import type { GameDocument, MapNode, WheelOutcome } from './types.js'

const now = new Date(2026, 9, 20, 8, 30, 0)

function baseInput(overrides: Partial<Parameters<typeof rollWheelOutcome>[0]> = {}) {
  const setup = createDemoSetup(now)
  const run = createRun({ setup, now, runId: 'run_wheel' })
  return {
    runId: 'run_wheel',
    dayIndex: 0,
    nodeId: 'n0_0',
    goals: setup.goals,
    tasks: setup.tasks,
    objectives: run.objectives,
    ...overrides,
  }
}

function wheelDocument(nodeId = 'n0_0', runId = 'run_wheel_complete'): GameDocument {
  const setup = createDemoSetup(now)
  const run = createRun({ setup, now, runId })
  const node: MapNode = {
    id: nodeId,
    layer: 0,
    type: 'wheel',
    task: null,
    rewards: rewardsForNode('wheel', 'light'),
    connections: [],
  }
  const boss: MapNode = {
    id: 'n1_0',
    layer: 1,
    type: 'boss',
    task: {
      taskId: setup.tasks[0]!.id,
      title: setup.tasks[0]!.title,
      goalId: setup.tasks[0]!.goalId,
      goalTitle: setup.goals[0]!.title,
      effort: setup.tasks[0]!.effort,
    },
    rewards: rewardsForNode('boss', setup.tasks[0]!.effort),
    connections: [],
  }
  const map = {
    id: `${runId}:map:0`,
    seed: `${run.seed}:day:0:g${run.generatorVersion}`,
    dayIndex: 0,
    generatorVersion: run.generatorVersion,
    layers: [[node]],
    boss,
    currentNodeId: node.id,
    createdAt: now.toISOString(),
  }
  const days = run.days.map((day) =>
    day.index === 0
      ? { ...day, status: 'in_progress' as const, map, openedAt: now.toISOString() }
      : day,
  )
  const base = createEmptyDocument()
  return {
    ...base,
    profile: {
      id: 'profile_wheel',
      name: 'Wren',
      xp: 0,
      level: 1,
      gold: 0,
      loot: [],
      createdAt: now.toISOString(),
    },
    goals: setup.goals,
    tasks: setup.tasks,
    run: { ...run, days },
  }
}

describe('wheel sectors', () => {
  it('uses ten sectors proportional to the real outcome weights', () => {
    expect(WHEEL_SECTORS).toHaveLength(10)
    const counts = new Map<WheelOutcome, number>()
    for (const sector of WHEEL_SECTORS) {
      counts.set(sector, (counts.get(sector) ?? 0) + 1)
    }
    expect(counts.get('task')).toBe(5)
    expect(counts.get('gold')).toBe(2)
    expect(counts.get('xp')).toBe(2)
    expect(counts.get('rest')).toBe(1)
  })
})

describe('rollWheelOutcome', () => {
  it('is deterministic for the same inputs', () => {
    const first = rollWheelOutcome(baseInput())
    const second = rollWheelOutcome(baseInput())
    expect(second).toEqual(first)
  })

  it('keeps the segment index inside its outcome range', () => {
    for (let index = 0; index < 500; index += 1) {
      const rolled = rollWheelOutcome(
        baseInput({ runId: `run_wheel_${index}`, nodeId: `n0_${index % 7}` }),
      )
      if (rolled.outcome === 'task') {
        expect(rolled.segmentIndex).toBeGreaterThanOrEqual(0)
        expect(rolled.segmentIndex).toBeLessThanOrEqual(4)
      }
      if (rolled.outcome === 'gold') {
        expect(rolled.segmentIndex).toBeGreaterThanOrEqual(5)
        expect(rolled.segmentIndex).toBeLessThanOrEqual(6)
      }
      if (rolled.outcome === 'xp') {
        expect(rolled.segmentIndex).toBeGreaterThanOrEqual(7)
        expect(rolled.segmentIndex).toBeLessThanOrEqual(8)
      }
      if (rolled.outcome === 'rest') expect(rolled.segmentIndex).toBe(9)
    }
  })

  it('matches the documented payouts per outcome', () => {
    for (let index = 0; index < 500; index += 1) {
      const rolled = rollWheelOutcome(baseInput({ runId: `run_pay_${index}` }))
      if (rolled.outcome === 'gold') {
        expect(rolled.gold).toBe(WHEEL_GOLD)
        expect(rolled.xp).toBe(0)
        expect(rolled.progress).toBe(0)
        expect(rolled.task).toBeNull()
      }
      if (rolled.outcome === 'xp') {
        expect(rolled.xp).toBe(WHEEL_XP)
        expect(rolled.gold).toBe(0)
        expect(rolled.progress).toBe(0)
        expect(rolled.task).toBeNull()
      }
      if (rolled.outcome === 'rest') {
        expect(rolled.xp).toBe(WHEEL_REST_XP)
        expect(rolled.gold).toBe(0)
        expect(rolled.progress).toBe(0)
        expect(rolled.task).toBeNull()
      }
      if (rolled.outcome === 'task') {
        expect(rolled.task).not.toBeNull()
        expect(rolled.progress).toBe(1)
        const expected = rewardsForNode('task', rolled.task!.effort)
        expect(rolled.xp).toBe(expected.xp)
        expect(rolled.gold).toBe(expected.gold)
      }
    }
  })

  it('falls back to rest when the routine pool is empty', () => {
    const rolled = rollWheelOutcome(baseInput({ goals: [], tasks: [] }))
    expect(rolled.outcome).toBe('rest')
    expect(rolled.task).toBeNull()
    expect(rolled.xp).toBe(WHEEL_REST_XP)
    expect(rolled.progress).toBe(0)
    expect(rolled.segmentIndex).toBe(9)
  })
})

describe('resolveNode wheel', () => {
  it('grants exactly the previewed outcome and records it on the event', () => {
    const document = wheelDocument()
    const preview = rollWheelOutcome({
      runId: 'run_wheel_complete',
      dayIndex: 0,
      nodeId: 'n0_0',
      goals: document.goals,
      tasks: document.tasks,
      objectives: document.run!.objectives,
    })
    const after = resolveNode(document, { nodeId: 'n0_0', action: 'complete', now })
    const event = after.run?.days[0]?.rewards[0]

    expect(event).toMatchObject({
      nodeId: 'n0_0',
      nodeType: 'wheel',
      action: 'complete',
      xp: preview.xp,
      gold: preview.gold,
      progress: preview.progress,
      wheelOutcome: preview.outcome,
      taskId: preview.task?.taskId ?? null,
      taskTitle: preview.task?.title ?? null,
    })
    expect(after.profile?.xp).toBe(preview.xp)
    expect(after.profile?.gold).toBe(preview.gold)
    const day = currentDay(after.run)
    expect(availableNodeIds(day!.map!, day!)).toEqual([])
  })

  it('skip grants nothing but still advances the path', () => {
    const after = resolveNode(wheelDocument('n0_0', 'run_wheel_skip'), {
      nodeId: 'n0_0',
      action: 'skip',
      now,
    })
    const event = after.run?.days[0]?.rewards[0]
    expect(event).toMatchObject({
      nodeType: 'wheel',
      action: 'skip',
      xp: 0,
      gold: 0,
      progress: 0,
      wheelOutcome: null,
    })
    expect(after.run?.totals.nodesSkipped).toBe(1)
    expect(after.run?.totals.nodesCompleted).toBe(0)
  })

  it('rejects a second resolution without duplicating rewards', () => {
    const first = resolveNode(wheelDocument('n0_0', 'run_wheel_twice'), {
      nodeId: 'n0_0',
      action: 'complete',
      now,
    })
    expect(() =>
      resolveNode(first, { nodeId: 'n0_0', action: 'complete', now }),
    ).toThrow(/already been resolved/i)
    expect(first.run?.days[0]?.rewards).toHaveLength(1)
  })

  it('folds the wheel event into totals and the day summary', () => {
    const after = resolveNode(wheelDocument('n0_0', 'run_wheel_totals'), {
      nodeId: 'n0_0',
      action: 'complete',
      now,
    })
    const run = after.run!
    const day = run.days[0]!
    expect(computeRunTotals(run)).toEqual(run.totals)
    expect(run.totals.nodesCompleted).toBe(1)
    const summary = computeDaySummary(run, day)
    expect(summary.xp).toBe(day.rewards[0]?.xp)
    expect(summary.gold).toBe(day.rewards[0]?.gold)
    expect(summary.completed).toBe(1)
    expect(summary.skipped).toBe(0)
  })
})
