import { describe, expect, it } from 'vitest'
import { GENERATOR_VERSION } from './balance.js'
import { generateMap } from './generator.js'
import { createEmptyDocument } from './schema.js'
import { tryAutoMerge } from './merge.js'
import type {
  GameDocument,
  Goal,
  ResolvedNode,
  RewardEvent,
  Run,
  Task,
} from './types.js'

const NOW = '2026-10-20T09:00:00.000Z'

function makeGoal(id: string, title: string, weeklyObjective = 3): Goal {
  return {
    id,
    title,
    category: 'Test',
    icon: 'banner',
    weeklyObjective,
    active: true,
    createdAt: NOW,
  }
}

function makeTask(id: string, goalId: string, title: string): Task {
  return { id, goalId, title, effort: 'light', active: true, createdAt: NOW }
}

function baseDocument(): GameDocument {
  const doc = createEmptyDocument()
  doc.profile = {
    id: 'profile_1',
    name: 'Wren',
    xp: 100,
    level: 2,
    gold: 50,
    loot: [],
    createdAt: NOW,
  }
  doc.goals = [makeGoal('goal-a', 'Alpha'), makeGoal('goal-b', 'Beta')]
  doc.tasks = [makeTask('task-a', 'goal-a', 'Walk'), makeTask('task-b', 'goal-b', 'Write')]
  doc.run = makeRun('run_1', doc.goals)
  return doc
}

function makeRun(runId: string, goals: Goal[]): Run {
  return {
    id: runId,
    seed: `run:${runId}`,
    generatorVersion: GENERATOR_VERSION,
    startDate: '2026-10-20',
    timeZone: null,
    status: 'active',
    objectives: goals
      .filter((goal) => goal.active)
      .map((goal) => ({
        goalId: goal.id,
        goalTitle: goal.title,
        target: goal.weeklyObjective,
        progress: 0,
      })),
    days: Array.from({ length: 7 }, (_, index) => ({
      id: `${runId}:day:${index}`,
      index,
      date: `2026-10-${String(20 + index).padStart(2, '0')}`,
      status: index === 0 ? ('available' as const) : ('locked' as const),
      map: null,
      path: [],
      rewards: [],
      openedAt: null,
      closedAt: null,
      summary: null,
    })),
    totals: {
      xp: 0,
      gold: 0,
      lootCount: 0,
      nodesCompleted: 0,
      nodesSkipped: 0,
      daysPlayed: 0,
      daysMissed: 0,
    },
    createdAt: NOW,
    closedAt: null,
    summary: null,
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function pathEntry(nodeId: string, action: 'complete' | 'skip' = 'complete'): ResolvedNode {
  return { nodeId, action, at: NOW }
}

function rewardFor(nodeId: string, xp = 10, gold = 10, dayIndex = 0): RewardEvent {
  return {
    id: `run_1:day:${dayIndex}:reward:${nodeId}`,
    dayIndex,
    nodeId,
    nodeType: 'task',
    action: 'complete',
    taskId: 'task-a',
    taskTitle: 'Walk',
    goalId: 'goal-a',
    goalTitle: 'Alpha',
    xp,
    gold,
    progress: 1,
    lootItem: null,
    duplicateCatalogId: null,
    duplicateGold: 0,
    closingBonus: false,
    wheelOutcome: null,
    at: NOW,
  }
}

function openedDay(runId: string, dayIndex: number, goals: Goal[], tasks: Task[]) {
  const map = generateMap({
    runId,
    runSeed: `run:${runId}`,
    dayIndex,
    generatorVersion: GENERATOR_VERSION,
    goals,
    tasks,
    objectives: goals.map((goal) => ({
      goalId: goal.id,
      goalTitle: goal.title,
      target: goal.weeklyObjective,
      progress: 0,
    })),
    now: NOW,
  })
  return {
    id: `${runId}:day:${dayIndex}`,
    index: dayIndex,
    date: `2026-10-${String(20 + dayIndex).padStart(2, '0')}`,
    status: 'in_progress' as const,
    map,
    path: [],
    rewards: [],
    openedAt: NOW,
    closedAt: null,
    summary: null,
  }
}

function richSetup(): { goals: Goal[]; tasks: Task[] } {
  return {
    goals: [makeGoal('goal-a', 'Alpha'), makeGoal('goal-b', 'Beta')],
    tasks: [
      makeTask('task-a', 'goal-a', 'Walk'),
      makeTask('task-b', 'goal-b', 'Write'),
      makeTask('task-c', 'goal-a', 'Run'),
      makeTask('task-d', 'goal-b', 'Read'),
    ],
  }
}

describe('tryAutoMerge', () => {
  it('merges identical documents without conflict', () => {
    const base = baseDocument()
    const result = tryAutoMerge(base, clone(base), clone(base))
    expect(result.ok).toBe(true)
  })

  it('takes the remote copy when only the cloud moved', () => {
    const base = baseDocument()
    const local = clone(base)
    const remote = clone(base)
    remote.goals[0] = { ...remote.goals[0]!, title: 'Alpha remote' }
    const result = tryAutoMerge(base, local, remote)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.document.goals[0]?.title).toBe('Alpha remote')
  })

  it('takes the local copy when only this device moved', () => {
    const base = baseDocument()
    const local = clone(base)
    const remote = clone(base)
    local.goals[0] = { ...local.goals[0]!, title: 'Alpha local' }
    const result = tryAutoMerge(base, local, remote)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.document.goals[0]?.title).toBe('Alpha local')
  })

  it('merges disjoint goal edits from both sides', () => {
    const base = baseDocument()
    const local = clone(base)
    const remote = clone(base)
    local.goals[0] = { ...local.goals[0]!, title: 'Alpha local' }
    remote.goals[1] = { ...remote.goals[1]!, title: 'Beta remote' }
    const result = tryAutoMerge(base, local, remote)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.document.goals[0]?.title).toBe('Alpha local')
      expect(result.document.goals[1]?.title).toBe('Beta remote')
    }
  })

  it('conflicts when both sides edit the same goal differently', () => {
    const base = baseDocument()
    const local = clone(base)
    const remote = clone(base)
    local.goals[0] = { ...local.goals[0]!, title: 'Alpha local' }
    remote.goals[0] = { ...remote.goals[0]!, title: 'Alpha remote' }
    const result = tryAutoMerge(base, local, remote)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.conflicts.length).toBeGreaterThan(0)
  })

  it('unions goals added on different devices', () => {
    const base = baseDocument()
    const local = clone(base)
    const remote = clone(base)
    local.goals.push(makeGoal('goal-c', 'Gamma'))
    remote.goals.push(makeGoal('goal-d', 'Delta'))
    const result = tryAutoMerge(base, local, remote)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const ids = result.document.goals.map((goal) => goal.id).sort()
      expect(ids).toEqual(['goal-a', 'goal-b', 'goal-c', 'goal-d'])
    }
  })

  it('conflicts when both sides add the same goal id with different content', () => {
    const base = baseDocument()
    const local = clone(base)
    const remote = clone(base)
    local.goals.push(makeGoal('goal-c', 'Gamma local'))
    remote.goals.push(makeGoal('goal-c', 'Gamma remote'))
    const result = tryAutoMerge(base, local, remote)
    expect(result.ok).toBe(false)
  })

  it('merges disjoint task edits from both sides', () => {
    const base = baseDocument()
    const local = clone(base)
    const remote = clone(base)
    local.tasks[0] = { ...local.tasks[0]!, title: 'Walk far' }
    remote.tasks[1] = { ...remote.tasks[1]!, title: 'Write more' }
    const result = tryAutoMerge(base, local, remote)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.document.tasks[0]?.title).toBe('Walk far')
      expect(result.document.tasks[1]?.title).toBe('Write more')
    }
  })

  it('merges a local node resolution with a remote goal edit', () => {
    const { goals, tasks } = richSetup()
    const base = baseDocument()
    base.goals = goals
    base.tasks = tasks
    base.run = makeRun('run_1', goals)
    const day = openedDay('run_1', 0, goals, tasks)
    base.run.days[0] = day
    const nodeId = day.map!.layers[0]![0]!.id
    const local = clone(base)
    const remote = clone(base)
    local.run!.days[0] = {
      ...local.run!.days[0]!,
      path: [pathEntry(nodeId)],
      rewards: [rewardFor(nodeId)],
    }
    local.run!.totals = {
      xp: 10,
      gold: 10,
      lootCount: 0,
      nodesCompleted: 1,
      nodesSkipped: 0,
      daysPlayed: 0,
      daysMissed: 0,
    }
    local.run!.objectives = local.run!.objectives.map((objective) =>
      objective.goalId === 'goal-a' ? { ...objective, progress: 1 } : objective,
    )
    local.profile = { ...local.profile!, xp: 110, gold: 60 }
    remote.goals[1] = { ...remote.goals[1]!, title: 'Beta remote' }
    const result = tryAutoMerge(base, local, remote)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.document.goals[1]?.title).toBe('Beta remote')
      expect(result.document.run?.days[0]?.path).toHaveLength(1)
      expect(result.document.profile?.xp).toBe(110)
    }
  })

  it('conflicts when both sides resolve different nodes in the same layer', () => {
    const goals = [makeGoal('goal-a', 'Alpha'), makeGoal('goal-b', 'Beta')]
    const tasks = [
      makeTask('task-a', 'goal-a', 'Walk'),
      makeTask('task-b', 'goal-b', 'Write'),
      makeTask('task-c', 'goal-a', 'Run'),
      makeTask('task-d', 'goal-b', 'Read'),
    ]
    const map = generateMap({
      runId: 'run_1',
      runSeed: 'run:run_1',
      dayIndex: 0,
      generatorVersion: GENERATOR_VERSION,
      goals,
      tasks,
      objectives: goals.map((goal) => ({
        goalId: goal.id,
        goalTitle: goal.title,
        target: goal.weeklyObjective,
        progress: 0,
      })),
      now: NOW,
    })
    const layer0 = map.layers[0]!
    expect(layer0.length).toBeGreaterThanOrEqual(2)
    const nodeA = layer0[0]!.id
    const nodeB = layer0[1]!.id
    expect(nodeA).not.toBe(nodeB)

    const base = baseDocument()
    base.goals = goals
    base.tasks = tasks
    base.run = makeRun('run_1', goals)
    base.run.days[0] = {
      ...base.run.days[0]!,
      status: 'in_progress',
      map: clone(map),
      openedAt: NOW,
    }
    const local = clone(base)
    const remote = clone(base)
    local.run!.days[0] = {
      ...local.run!.days[0]!,
      map: { ...clone(map), currentNodeId: null },
      path: [pathEntry(nodeA)],
      rewards: [rewardFor(nodeA)],
    }
    remote.run!.days[0] = {
      ...remote.run!.days[0]!,
      map: { ...clone(map), currentNodeId: null },
      path: [pathEntry(nodeB)],
      rewards: [rewardFor(nodeB)],
    }
    const result = tryAutoMerge(base, local, remote)
    expect(result.ok).toBe(false)
  })

  it('conflicts when both sides start different new runs', () => {
    const base = baseDocument()
    const local = clone(base)
    const remote = clone(base)
    local.run = makeRun('run_local', local.goals)
    remote.run = makeRun('run_remote', remote.goals)
    const result = tryAutoMerge(base, local, remote)
    expect(result.ok).toBe(false)
  })

  it('conflicts when profile names diverge on both sides', () => {
    const base = baseDocument()
    const local = clone(base)
    const remote = clone(base)
    local.profile = { ...local.profile!, name: 'Local name' }
    remote.profile = { ...remote.profile!, name: 'Remote name' }
    const result = tryAutoMerge(base, local, remote)
    expect(result.ok).toBe(false)
  })

  it('conflicts when settings diverge on both sides', () => {
    const base = baseDocument()
    const local = clone(base)
    const remote = clone(base)
    local.settings = { theme: 'light' }
    remote.settings = { theme: 'dark' }
    const result = tryAutoMerge(base, local, remote)
    expect(result.ok).toBe(false)
  })

  it('sums profile counters when both sides resolve different days', () => {
    const { goals, tasks } = richSetup()
    const base = baseDocument()
    base.goals = goals
    base.tasks = tasks
    base.run = makeRun('run_1', goals)
    base.run.days[0] = openedDay('run_1', 0, goals, tasks)
    base.run.days[1] = openedDay('run_1', 1, goals, tasks)
    const nodeA = base.run.days[0].map!.layers[0]![0]!.id
    const nodeB = base.run.days[1].map!.layers[0]![0]!.id
    const local = clone(base)
    const remote = clone(base)
    local.profile = { ...local.profile!, xp: 115, level: 2, gold: 65 }
    local.run!.days[0] = {
      ...local.run!.days[0]!,
      path: [pathEntry(nodeA)],
      rewards: [rewardFor(nodeA, 15, 15, 0)],
    }
    local.run!.totals = {
      xp: 15,
      gold: 15,
      lootCount: 0,
      nodesCompleted: 1,
      nodesSkipped: 0,
      daysPlayed: 0,
      daysMissed: 0,
    }
    local.run!.objectives = local.run!.objectives.map((objective) =>
      objective.goalId === 'goal-a' ? { ...objective, progress: 1 } : objective,
    )
    remote.profile = { ...remote.profile!, xp: 110, level: 2, gold: 60 }
    remote.run!.days[1] = {
      ...remote.run!.days[1]!,
      path: [pathEntry(nodeB)],
      rewards: [rewardFor(nodeB, 10, 10, 1)],
    }
    remote.run!.totals = {
      xp: 10,
      gold: 10,
      lootCount: 0,
      nodesCompleted: 1,
      nodesSkipped: 0,
      daysPlayed: 0,
      daysMissed: 0,
    }
    remote.run!.objectives = remote.run!.objectives.map((objective) =>
      objective.goalId === 'goal-a' ? { ...objective, progress: 1 } : objective,
    )
    const result = tryAutoMerge(base, local, remote)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.document.profile?.xp).toBe(125)
      expect(result.document.profile?.gold).toBe(75)
      expect(result.document.run?.days[0]?.path).toHaveLength(1)
      expect(result.document.run?.days[1]?.path).toHaveLength(1)
      expect(result.document.run?.totals.xp).toBe(25)
      expect(result.document.run?.totals.nodesCompleted).toBe(2)
    }
  })

  it('dedupes the same node completed on both devices', () => {
    const { goals, tasks } = richSetup()
    const base = baseDocument()
    base.goals = goals
    base.tasks = tasks
    base.run = makeRun('run_1', goals)
    base.run.days[0] = openedDay('run_1', 0, goals, tasks)
    const nodeId = base.run.days[0].map!.layers[0]![0]!.id
    const local = clone(base)
    const remote = clone(base)
    const entry = pathEntry(nodeId)
    const event = rewardFor(nodeId, 10, 10, 0)
    for (const doc of [local, remote]) {
      doc.run!.days[0] = { ...doc.run!.days[0]!, path: [clone(entry)], rewards: [clone(event)] }
      doc.run!.totals = {
        xp: 10,
        gold: 10,
        lootCount: 0,
        nodesCompleted: 1,
        nodesSkipped: 0,
        daysPlayed: 0,
        daysMissed: 0,
      }
      doc.run!.objectives = doc.run!.objectives.map((objective) =>
        objective.goalId === 'goal-a' ? { ...objective, progress: 1 } : objective,
      )
      doc.profile = { ...doc.profile!, xp: 110, gold: 60 }
    }
    const result = tryAutoMerge(base, local, remote)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.document.run?.days[0]?.path).toHaveLength(1)
      expect(result.document.profile?.xp).toBe(110)
    }
  })
})
