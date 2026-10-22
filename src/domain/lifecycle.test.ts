import { describe, expect, it } from 'vitest'
import { createDemoSetup } from '../content/demo'
import { BOSS_CLOSING_BONUS, DUPLICATE_GOLD, RUN_DAYS } from './balance'
import { dayKey, daysBetween } from './dates'
import { validateMap } from './generator'
import {
  computeDaySummary,
  computeRunTotals,
  createRun,
  DomainError,
  openDay,
  reconcileDays,
  resolveNode,
  selectNode,
} from './lifecycle'
import { rollLootItem, rewardsForNode } from './rewards'
import { createEmptyDocument, parseDocument, serializeDocument } from './schema'
import {
  availableNodeIds,
  currentDay,
  nodeStatus,
  resolveNodeById,
} from './selectors'
import type {
  Day,
  Effort,
  GameDocument,
  GameMap,
  LootItem,
  MapNode,
  NodeType,
  Profile,
  ResolutionAction,
  Run,
  TaskSnapshot,
} from './types'

const now = new Date(2026, 9, 20, 8, 30, 0)

function makeRun(runId = 'run_seed') {
  const setup = createDemoSetup(now)
  return createRun({ setup, now, runId })
}

function mapFixture(dayIndex: number): GameMap {
  const node: MapNode = {
    id: `n${dayIndex}_0`,
    layer: 0,
    type: 'task',
    task: {
      taskId: 'demo-task-walk-north-trail',
      title: 'Walk the north trail',
      goalId: 'demo-goal-wayfarer',
      goalTitle: 'Wayfarer',
      effort: 'light',
    },
    rewards: { xp: 10, gold: 10, lootRolls: 0, progress: 1 },
    connections: [],
  }
  return {
    id: `map_${dayIndex}`,
    seed: `seed_${dayIndex}`,
    dayIndex,
    generatorVersion: 1,
    layers: [[node], [], [], []],
    boss: { ...node, id: `boss_${dayIndex}`, layer: 4, type: 'boss' },
    currentNodeId: null,
    createdAt: now.toISOString(),
  }
}

describe('createRun', () => {
  it('creates seven consecutive local days', () => {
    const run = makeRun()
    expect(run.days).toHaveLength(RUN_DAYS)
    expect(run.startDate).toBe(dayKey(now))
    expect(run.days[0]?.date).toBe(dayKey(now))
    expect(daysBetween(run.days[0]!.date, run.days[6]!.date)).toBe(6)

    expect(run.days[0]?.status).toBe('available')
    expect(run.days.slice(1).every((day) => day.status === 'locked')).toBe(true)
    expect(run.days.every((day) => day.map === null && day.path.length === 0)).toBe(true)
    expect(run.days.every((day) => day.rewards.length === 0 && day.summary === null)).toBe(true)
  })

  it('snapshots only active goals as weekly objectives', () => {
    const setup = createDemoSetup(now)
    setup.goals[1] = { ...setup.goals[1]!, active: false }
    const run = createRun({ setup, now, runId: 'run_objectives' })
    expect(run.objectives).toEqual([
      {
        goalId: 'demo-goal-wayfarer',
        goalTitle: 'Wayfarer',
        target: 4,
        progress: 0,
      },
    ])
  })

  it('starts with zero totals and active status', () => {
    const run = makeRun()
    expect(run.status).toBe('active')
    expect(run.closedAt).toBeNull()
    expect(run.summary).toBeNull()
    expect(run.totals).toEqual({
      xp: 0,
      gold: 0,
      lootCount: 0,
      nodesCompleted: 0,
      nodesSkipped: 0,
      daysPlayed: 0,
      daysMissed: 0,
    })
    expect(run.createdAt).toBe(now.toISOString())
  })

  it('derives a deterministic seed from the run id', () => {
    expect(makeRun('same').seed).toBe(makeRun('same').seed)
    expect(makeRun('same').seed).not.toBe(makeRun('other').seed)
  })

  it('crosses month boundaries without drift', () => {
    const lateNow = new Date(2026, 0, 28, 23, 59, 0)
    const setup = createDemoSetup(lateNow)
    const run = createRun({ setup, now: lateNow, runId: 'run_month' })
    expect(run.days.map((day) => day.date)).toEqual([
      '2026-01-28',
      '2026-01-29',
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
      '2026-02-02',
      '2026-02-03',
    ])
    expect(new Set(run.days.map((day) => day.id)).size).toBe(RUN_DAYS)
  })
})

describe('reconcileDays', () => {
  it('marks three absent days as missed and leaves today available', () => {
    const run = makeRun()
    const reconciled = reconcileDays(run, '2026-10-23')

    expect(reconciled.days.map((day) => day.status)).toEqual([
      'missed',
      'missed',
      'missed',
      'available',
      'locked',
      'locked',
      'locked',
    ])
  })

  it('is idempotent and returns the same run when nothing changes', () => {
    const first = reconcileDays(makeRun(), '2026-10-23')
    const second = reconcileDays(first, '2026-10-23')
    expect(second).toBe(first)
    expect(reconcileDays(second, '2026-10-23')).toEqual(first)
  })

  it('keeps completed and missed days untouched', () => {
    const run = makeRun()
    const withHistory: Run = {
      ...run,
      days: run.days.map((day, index) => {
        if (index === 0) return { ...day, status: 'completed' as const }
        if (index === 1) return { ...day, status: 'missed' as const }
        return day
      }),
    }
    const reconciled = reconcileDays(withHistory, '2026-10-22')
    expect(reconciled.days[0]?.status).toBe('completed')
    expect(reconciled.days[1]?.status).toBe('missed')
    expect(reconciled.days[2]?.status).toBe('available')
  })

  it('keeps an opened day in progress and marks a past opened day missed', () => {
    const run = makeRun()
    const dayA = { ...run.days[0]!, map: mapFixture(0), status: 'in_progress' as const }
    const dayB = { ...run.days[1]!, map: mapFixture(1), status: 'in_progress' as const }
    const opened: Run = { ...run, days: [dayA, dayB, ...run.days.slice(2)] }

    expect(reconcileDays(opened, '2026-10-20').days[0]?.status).toBe('in_progress')
    const later = reconcileDays(opened, '2026-10-22')
    expect(later.days[0]?.status).toBe('missed')
    expect(later.days[1]?.status).toBe('missed')
    expect(later.days[2]?.status).toBe('available')
  })

  it('locks every future day when today is before the run', () => {
    const run = makeRun()
    const reconciled = reconcileDays(run, '2026-10-01')
    expect(reconciled.days.every((day) => day.status === 'locked')).toBe(true)
  })

  it('misses every unresolved day after a long absence', () => {
    const run = makeRun()
    const reconciled = reconcileDays(run, '2027-01-01')
    expect(reconciled.days.every((day) => day.status === 'missed')).toBe(true)
  })

  it('works across month boundaries', () => {
    const lateNow = new Date(2026, 0, 29, 12)
    const run = createRun({ setup: createDemoSetup(lateNow), now: lateNow, runId: 'run_month' })
    const reconciled = reconcileDays(run, '2026-02-01')
    expect(reconciled.days.map((day) => day.status)).toEqual([
      'missed',
      'missed',
      'missed',
      'available',
      'locked',
      'locked',
      'locked',
    ])
  })
})

function makeDocument(at = now, runId = 'run_day'): GameDocument {
  const setup = createDemoSetup(at)
  const run = createRun({ setup, now: at, runId })
  const empty = createEmptyDocument()
  return {
    ...empty,
    profile: {
      id: 'profile_day',
      name: 'Wren',
      xp: 0,
      level: 1,
      gold: 0,
      loot: [],
      createdAt: at.toISOString(),
    },
    goals: setup.goals,
    tasks: setup.tasks,
    run,
  }
}

function openedDocument(at = now): GameDocument {
  return openDay(makeDocument(at), { now: at })
}

describe('openDay', () => {
  it('generates and stores a valid map for the current day', () => {
    const before = makeDocument()
    const after = openDay(before, { now })

    const day = after.run?.days[0]
    expect(day?.status).toBe('in_progress')
    expect(day?.openedAt).toBe(now.toISOString())
    expect(day?.map).not.toBeNull()
    expect(day?.map && validateMap(day.map)).toEqual({ ok: true })
    expect(day?.map?.seed).toBe('run:run_day:day:0:g1')
    expect(day?.map?.currentNodeId).toBeNull()
    expect(day?.map?.createdAt).toBe(now.toISOString())

    // Only the current day changed.
    expect(after.run?.days.slice(1)).toEqual(before.run?.days.slice(1))
    expect(before.run?.days[0]?.map).toBeNull()
  })

  it('is idempotent and never regenerates an existing map', () => {
    const first = openedDocument()
    const later = new Date(2026, 9, 20, 22, 15, 0)
    const second = openDay(first, { now: later })

    expect(second).toBe(first)
    expect(second.run?.days[0]?.map).toBe(first.run?.days[0]?.map)
    expect(second.run?.days[0]?.openedAt).toBe(now.toISOString())
  })

  it('opens the explicitly requested current day', () => {
    const document = makeDocument()
    const dayId = document.run?.days[0]?.id
    expect(dayId).toBeTruthy()
    const opened = openDay(document, { dayId, now })
    expect(opened.run?.days[0]?.map).not.toBeNull()
  })

  it('refuses future and past days', () => {
    const document = makeDocument()

    expect(() => openDay(document, { now: new Date(2026, 9, 19, 9, 0, 0) })).toThrow(
      DomainError,
    )
    expect(() => openDay(document, { now: new Date(2026, 9, 19, 9, 0, 0) })).toThrow(
      /not arrived/i,
    )
    expect(() => openDay(document, { now: new Date(2026, 9, 21, 9, 0, 0) })).toThrow(
      /already passed/i,
    )

    const futureDayId = document.run?.days[1]?.id
    expect(() => openDay(document, { dayId: futureDayId, now })).toThrow(
      /only today/i,
    )
    expect(() => openDay(document, { dayId: 'missing-day', now })).toThrow(
      /does not belong/i,
    )
  })

  it('refuses to open a day without an active run or active routines', () => {
    const empty = createEmptyDocument()
    expect(() => openDay(empty, { now })).toThrow(/no active run/i)

    const closed = makeDocument()
    if (closed.run) closed.run = { ...closed.run, status: 'closed' }
    expect(() => openDay(closed, { now })).toThrow(/no active run/i)

    const routineLess = makeDocument()
    routineLess.tasks = []
    expect(() => openDay(routineLess, { now })).toThrow(/active routine/i)
  })

  it('produces a document that round-trips through the schema', () => {
    const document = openedDocument()
    const parsed = parseDocument(serializeDocument(document))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.value).toEqual(document)
  })
})

describe('selectNode', () => {
  it('selects a layer-0 node and persists it in the map', () => {
    const document = openedDocument()
    const map = document.run?.days[0]?.map
    const firstNode = map?.layers[0]?.[0]
    if (!map || !firstNode) throw new Error('expected a generated map')

    const selected = selectNode(document, firstNode.id)
    expect(selected.run?.days[0]?.map?.currentNodeId).toBe(firstNode.id)
    expect(document.run?.days[0]?.map?.currentNodeId).toBeNull()
  })

  it('keeps the current node as the only choice and refuses to swap it', () => {
    const document = openedDocument()
    const map = document.run?.days[0]?.map
    const layerZero = map?.layers[0] ?? []
    const firstNode = layerZero[0]
    const otherNode = layerZero[1]
    if (!map || !firstNode || !otherNode) throw new Error('expected two layer-0 nodes')

    const selected = selectNode(document, firstNode.id)
    expect(selectNode(selected, firstNode.id)).toBe(selected)
    expect(() => selectNode(selected, otherNode.id)).toThrow(/already chosen/i)

    const day = selected.run?.days[0] as Day
    const selectedMap = day.map as GameMap
    expect(availableNodeIds(selectedMap, day)).toEqual([firstNode.id])
    expect(nodeStatus(selectedMap, day, firstNode.id)).toBe('current')
    expect(nodeStatus(selectedMap, day, otherNode.id)).toBe('locked')
  })

  it('rejects locked, unknown and premature selections', () => {
    const document = makeDocument()
    expect(() => selectNode(document, 'n0_0')).toThrow(/open the day/i)

    const opened = openedDocument()
    const map = opened.run?.days[0]?.map
    const locked = map?.layers[1]?.[0]
    const boss = map?.boss
    if (!map || !locked || !boss) throw new Error('expected a generated map')

    expect(() => selectNode(opened, locked.id)).toThrow(/not available/i)
    expect(() => selectNode(opened, boss.id)).toThrow(/not available/i)
    expect(() => selectNode(opened, 'nope')).toThrow(/not part of today/i)
  })

  it('reports completed, skipped, current, available and locked statuses', () => {
    const document = openedDocument()
    const map = document.run?.days[0]?.map
    const first = map?.layers[0]?.[0]
    if (!map || !first) throw new Error('expected a generated map')
    const nextId = first.connections[0]
    if (!nextId) throw new Error('expected a connection')

    const baseDay = document.run?.days[0] as Day
    const resolvedDay: Day = {
      ...baseDay,
      path: [
        { nodeId: first.id, action: 'complete', at: now.toISOString() },
        { nodeId: nextId, action: 'skip', at: now.toISOString() },
      ],
    }

    expect(nodeStatus(map, resolvedDay, first.id)).toBe('completed')
    expect(nodeStatus(map, resolvedDay, nextId)).toBe('skipped')
    expect(nodeStatus(map, resolvedDay, 'n3_0')).toBe('locked')

    const availableDay: Day = { ...baseDay, path: resolvedDay.path.slice(0, 1) }
    const available = availableNodeIds(map, availableDay)
    expect(available).toEqual(first.connections)
    for (const nodeId of available) {
      expect(nodeStatus(map, availableDay, nodeId)).toBe('available')
    }

    const currentMap: GameMap = { ...map, currentNodeId: nextId }
    expect(nodeStatus(currentMap, baseDay, nextId)).toBe('current')
  })

  it('resolves boss nodes and returns null for unknown ids', () => {
    const document = openedDocument()
    const map = document.run?.days[0]?.map
    if (!map) throw new Error('expected a generated map')
    expect(resolveNodeById(map, map.boss.id)).toEqual(map.boss)
    expect(resolveNodeById(map, 'missing')).toBeNull()
  })
})

function fixtureSnapshot(effort: Effort = 'light'): TaskSnapshot {
  return {
    taskId: 'fixture-task',
    title: 'Fixture step',
    goalId: 'demo-goal-wayfarer',
    goalTitle: 'Wayfarer',
    effort,
  }
}

function fixtureNode(
  type: NodeType,
  id = 'n0_0',
  effort: Effort = 'light',
  layer = 0,
  connections: string[] = [],
): MapNode {
  return {
    id,
    layer,
    type,
    task: type === 'rest' || type === 'treasure' ? null : fixtureSnapshot(effort),
    rewards: rewardsForNode(type, effort),
    connections: type === 'boss' ? [] : connections,
  }
}

function fixtureBoss(effort: Effort = 'light'): MapNode {
  return fixtureNode('boss', 'n4_0', effort, 4)
}

interface FixtureOptions {
  node: MapNode
  boss: MapNode
  runId?: string
  profile?: Partial<Profile>
}

function fixtureDocument(options: FixtureOptions): GameDocument {
  const setup = createDemoSetup(now)
  const run = createRun({
    setup,
    now,
    runId: options.runId ?? 'run_fixture',
  })
  const map: GameMap = {
    id: `${run.id}:map:0`,
    seed: `${run.seed}:day:0:g1`,
    dayIndex: 0,
    generatorVersion: run.generatorVersion,
    layers: [[options.node], [], [], []],
    boss: options.boss,
    currentNodeId: options.node.id,
    createdAt: now.toISOString(),
  }
  const days = run.days.map((day): Day =>
    day.index === 0
      ? { ...day, status: 'in_progress', map, openedAt: now.toISOString() }
      : day,
  )
  const base = createEmptyDocument()
  return {
    ...base,
    profile: {
      id: 'profile_fixture',
      name: 'Wren',
      xp: 0,
      level: 1,
      gold: 0,
      loot: [],
      createdAt: now.toISOString(),
      ...options.profile,
    },
    goals: setup.goals,
    tasks: setup.tasks,
    run: { ...run, days },
  }
}

function firstTaskNode(document: GameDocument): MapNode {
  const map = document.run?.days[0]?.map
  const node = map?.layers[0]?.find((candidate) => candidate.type === 'task')
  if (!node) throw new Error('expected a layer-0 task node')
  return node
}

/** Plays every available decision, then resolves the boss with `bossAction`. */
function playThrough(
  document: GameDocument,
  at: Date,
  bossAction: ResolutionAction = 'complete',
): GameDocument {
  let current = document

  for (let step = 0; step < 10; step += 1) {
    const day = currentDay(current.run)
    const map = day?.map
    if (!day || !map) break

    const nodeId = map.currentNodeId ?? availableNodeIds(map, day)[0]
    if (!nodeId) break

    const action = nodeId === map.boss.id ? bossAction : 'complete'
    const selected = map.currentNodeId ? current : selectNode(current, nodeId)
    current = resolveNode(selected, { nodeId, action, now: at })
  }

  return current
}

function objectivesWithProgress(base: Run, progress: number[]): Run {
  return {
    ...base,
    objectives: base.objectives.map((objective, index) => ({
      ...objective,
      progress: progress[index] ?? 0,
    })),
  }
}

describe('resolveNode complete and skip', () => {
  it('grants a task total, weekly progress and a persisted event', () => {
    const document = openedDocument()
    const node = firstTaskNode(document)
    const selected = selectNode(document, node.id)
    const after = resolveNode(selected, {
      nodeId: node.id,
      action: 'complete',
      now,
    })

    const day = after.run?.days[0] as Day
    const event = day.rewards[0]
    expect(event).toBeDefined()
    expect(event).toMatchObject({
      dayIndex: 0,
      nodeId: node.id,
      nodeType: 'task',
      taskId: node.task?.taskId,
      taskTitle: node.task?.title,
      goalId: node.task?.goalId,
      goalTitle: node.task?.goalTitle,
      action: 'complete',
      xp: node.rewards.xp,
      gold: node.rewards.gold,
      progress: 1,
      lootItem: null,
      duplicateCatalogId: null,
      duplicateGold: 0,
      closingBonus: false,
      at: now.toISOString(),
    })
    expect(day.path).toEqual([
      { nodeId: node.id, action: 'complete', at: now.toISOString() },
    ])
    expect(day.map?.currentNodeId).toBeNull()
    expect(day.status).toBe('in_progress')

    expect(after.profile?.xp).toBe(node.rewards.xp)
    expect(after.profile?.level).toBe(1)
    expect(after.profile?.gold).toBe(node.rewards.gold)
    const objective = after.run?.objectives.find(
      (candidate) => candidate.goalId === node.task?.goalId,
    )
    expect(objective?.progress).toBe(1)

    expect(after.run?.totals).toEqual({
      xp: node.rewards.xp,
      gold: node.rewards.gold,
      lootCount: 0,
      nodesCompleted: 1,
      nodesSkipped: 0,
      daysPlayed: 0,
      daysMissed: 0,
    })
  })

  it('skip grants nothing but still advances the path', () => {
    const document = openedDocument()
    const node = firstTaskNode(document)
    const beforeObjective = document.run?.objectives.find(
      (objective) => objective.goalId === node.task?.goalId,
    )
    const after = resolveNode(selectNode(document, node.id), {
      nodeId: node.id,
      action: 'skip',
      now,
    })

    const day = after.run?.days[0] as Day
    const event = day.rewards[0]
    expect(event).toMatchObject({
      nodeId: node.id,
      action: 'skip',
      xp: 0,
      gold: 0,
      progress: 0,
      lootItem: null,
      duplicateGold: 0,
      closingBonus: false,
    })
    expect(day.path).toEqual([
      { nodeId: node.id, action: 'skip', at: now.toISOString() },
    ])
    expect(after.profile).toBe(document.profile)
    expect(after.run?.totals.nodesSkipped).toBe(1)
    expect(after.run?.totals.nodesCompleted).toBe(0)
    expect(after.run?.totals.xp).toBe(0)
    expect(after.run?.totals.gold).toBe(0)
    expect(
      after.run?.objectives.find(
        (objective) => objective.goalId === node.task?.goalId,
      )?.progress,
    ).toBe(beforeObjective?.progress)

    const nextDay = currentDay(after.run) as Day
    const nextMap = nextDay.map as GameMap
    expect(availableNodeIds(nextMap, nextDay)).toEqual(node.connections)
    expect(nodeStatus(nextMap, nextDay, node.id)).toBe('skipped')
  })

  it('rejects locked, unknown, unconnected and wrongly chosen nodes', () => {
    const closed = makeDocument()
    expect(() =>
      resolveNode(closed, { nodeId: 'n0_0', action: 'complete', now }),
    ).toThrow(/open the day/i)

    const document = openedDocument()
    const map = document.run?.days[0]?.map
    if (!map) throw new Error('expected a generated map')
    const first = firstTaskNode(document)
    const other = map.layers[0]?.find((node) => node.id !== first.id)
    const locked = map.layers[1]?.[0]
    if (!other || !locked) throw new Error('expected more nodes')

    expect(() =>
      resolveNode(document, { nodeId: locked.id, action: 'complete', now }),
    ).toThrow(/not available from the current path/i)
    expect(() =>
      resolveNode(document, { nodeId: 'missing', action: 'complete', now }),
    ).toThrow(/not part of today/i)

    const selected = selectNode(document, first.id)
    expect(() =>
      resolveNode(selected, { nodeId: other.id, action: 'complete', now }),
    ).toThrow(/already chosen/i)
    expect(() =>
      resolveNode(selected, { nodeId: first.id, action: 'complete', now: new Date(2026, 9, 21, 0, 0, 0) }),
    ).toThrow(/already passed/i)
  })

  it('rejects a foreign day id and a future day', () => {
    const document = openedDocument()
    const node = firstTaskNode(document)
    const futureDayId = document.run?.days[1]?.id

    expect(() =>
      resolveNode(document, {
        dayId: futureDayId,
        nodeId: node.id,
        action: 'complete',
        now,
      }),
    ).toThrow(/only today/i)
    expect(() =>
      resolveNode(document, {
        dayId: 'missing-day',
        nodeId: node.id,
        action: 'complete',
        now,
      }),
    ).toThrow(/does not belong/i)
    expect(() =>
      resolveNode(document, {
        nodeId: node.id,
        action: 'complete',
        now: new Date(2026, 9, 19, 9, 0, 0),
      }),
    ).toThrow(/not arrived/i)
  })

  it('rejects a second resolution without duplicating rewards', () => {
    const document = openedDocument()
    const node = firstTaskNode(document)
    const first = resolveNode(selectNode(document, node.id), {
      nodeId: node.id,
      action: 'complete',
      now,
    })
    const profile = first.profile
    const day = first.run?.days[0] as Day

    expect(() =>
      resolveNode(first, { nodeId: node.id, action: 'complete', now }),
    ).toThrow(/already been resolved/i)
    expect(first.profile).toBe(profile)
    expect(first.run?.days[0]).toBe(day)
    expect(day.path).toHaveLength(1)
    expect(day.rewards).toHaveLength(1)
  })

  it('keeps the path and rewards stable across a reload between resolutions', () => {
    const document = openedDocument()
    const node = firstTaskNode(document)
    const first = resolveNode(selectNode(document, node.id), {
      nodeId: node.id,
      action: 'complete',
      now,
    })
    const firstEvent = first.run?.days[0]?.rewards[0]
    const firstProfile = first.profile

    const parsed = parseDocument(serializeDocument(first))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.error)
    const reloaded = parsed.value

    const day = currentDay(reloaded.run) as Day
    const map = day.map as GameMap
    const nextId = availableNodeIds(map, day)[0]
    if (!nextId) throw new Error('expected a connected node')

    const second = resolveNode(reloaded, {
      nodeId: nextId,
      action: 'skip',
      now,
    })
    expect(second.run?.days[0]?.path).toHaveLength(2)
    expect(second.run?.days[0]?.rewards).toHaveLength(2)
    expect(second.run?.days[0]?.rewards[0]).toEqual(firstEvent)
    expect(second.profile).toEqual(firstProfile)
  })
})

describe('boss resolution and day summary', () => {
  it('completes the boss, seals the day and shows the closing bonus separately', () => {
    const opened = openedDocument()
    const finished = playThrough(opened, now, 'complete')
    const day = finished.run?.days[0] as Day
    const summary = day.summary
    if (!summary) throw new Error('expected a day summary')

    expect(day.status).toBe('completed')
    expect(day.closedAt).toBe(now.toISOString())
    expect(day.path).toHaveLength(5)
    expect(
      day.path.map((entry) => resolveNodeById(day.map as GameMap, entry.nodeId)?.layer),
    ).toEqual([0, 1, 2, 3, 4])

    const bossEvent = day.rewards.find((event) => event.nodeType === 'boss')
    const boss = day.map?.boss
    if (!bossEvent || !boss) throw new Error('expected a boss event')
    expect(bossEvent.action).toBe('complete')
    expect(bossEvent.closingBonus).toBe(true)
    expect(bossEvent.xp).toBe(boss.rewards.xp)
    expect(bossEvent.gold).toBe(boss.rewards.gold + bossEvent.duplicateGold)

    const eventXp = day.rewards.reduce((total, event) => total + event.xp, 0)
    const eventGold = day.rewards.reduce((total, event) => total + event.gold, 0)
    expect(summary.xp).toBe(eventXp)
    expect(summary.gold).toBe(eventGold)
    expect(summary.bossCompleted).toBe(true)
    expect(summary.closingBonusXp).toBe(BOSS_CLOSING_BONUS.xp)
    expect(summary.closingBonusGold).toBe(BOSS_CLOSING_BONUS.gold)
    expect(summary.completed).toBe(5)
    expect(summary.skipped).toBe(0)
    expect(summary.loot).toEqual(
      day.rewards.flatMap((event) => (event.lootItem ? [event.lootItem] : [])),
    )
    expect(summary.duplicateGold).toBe(
      day.rewards.reduce((total, event) => total + event.duplicateGold, 0),
    )
    expect(summary.objectives).toHaveLength(finished.run?.objectives.length ?? 0)

    for (const objective of summary.objectives) {
      const runObjective = finished.run?.objectives.find(
        (candidate) => candidate.goalId === objective.goalId,
      )
      const gained = day.rewards
        .filter((event) => event.goalId === objective.goalId)
        .reduce((total, event) => total + event.progress, 0)
      expect(objective.after).toBe(runObjective?.progress)
      expect(objective.before).toBe((runObjective?.progress ?? 0) - gained)
    }
    expect(summary.objectives.some((objective) => objective.after > objective.before)).toBe(
      true,
    )

    expect(finished.profile?.xp).toBe(eventXp)
    expect(finished.profile?.gold).toBe(eventGold)
    expect(finished.run?.status).toBe('active')
    expect(finished.run?.totals).toEqual(computeRunTotals(finished.run as Run))
    expect(computeDaySummary(finished.run as Run, day)).toEqual(summary)
  })

  it('skips the boss, seals the day and grants no closing bonus', () => {
    const finished = playThrough(openedDocument(), now, 'skip')
    const day = finished.run?.days[0] as Day
    const summary = day.summary
    if (!summary) throw new Error('expected a day summary')

    const bossEvent = day.rewards.find((event) => event.nodeType === 'boss')
    if (!bossEvent) throw new Error('expected a boss event')
    expect(day.status).toBe('completed')
    expect(day.closedAt).toBe(now.toISOString())
    expect(bossEvent.action).toBe('skip')
    expect(bossEvent.xp).toBe(0)
    expect(bossEvent.gold).toBe(0)
    expect(bossEvent.lootItem).toBeNull()
    expect(bossEvent.closingBonus).toBe(false)

    expect(summary.bossCompleted).toBe(false)
    expect(summary.closingBonusXp).toBe(0)
    expect(summary.closingBonusGold).toBe(0)
    expect(summary.skipped).toBe(1)
    expect(summary.completed).toBe(4)
    expect(summary.xp).toBe(
      day.rewards.reduce((total, event) => total + event.xp, 0),
    )
    expect(summary.gold).toBe(
      day.rewards.reduce((total, event) => total + event.gold, 0),
    )
    expect(finished.profile?.xp).toBe(summary.xp)
    expect(finished.profile?.gold).toBe(summary.gold)
  })
})

describe('loot resolution', () => {
  it('adds the first copy to the collection with a stable instance id', () => {
    const boss = fixtureBoss()
    const node = fixtureNode('treasure', 'n0_0', 'light', 0, [boss.id])
    const document = fixtureDocument({ node, boss, runId: 'run_loot' })
    const after = resolveNode(document, {
      nodeId: node.id,
      action: 'complete',
      now,
    })

    const event = after.run?.days[0]?.rewards[0]
    const expected = rollLootItem({
      runId: 'run_loot',
      dayIndex: 0,
      nodeId: node.id,
      obtainedAt: now.toISOString(),
    })
    expect(event?.lootItem).toEqual(expected)
    expect(event?.lootItem?.id).toBe(
      `run_loot:0:${node.id}:${expected.catalogId}`,
    )
    expect(event?.duplicateGold).toBe(0)
    expect(after.profile?.loot).toEqual([expected])
    expect(after.profile?.gold).toBe(node.rewards.gold)
  })

  it('converts a duplicate into gold and records the conversion', () => {
    const runId = 'run_duplicate'
    const boss = fixtureBoss()
    const node = fixtureNode('elite', 'n0_0', 'light', 0, [boss.id])
    const rolled = rollLootItem({
      runId,
      dayIndex: 0,
      nodeId: node.id,
      obtainedAt: now.toISOString(),
    })
    const owned: LootItem = { ...rolled, id: 'owned_duplicate' }
    const document = fixtureDocument({
      node,
      boss,
      runId,
      profile: { gold: 100, loot: [owned] },
    })

    const afterElite = resolveNode(document, {
      nodeId: node.id,
      action: 'complete',
      now,
    })
    const eliteEvent = afterElite.run?.days[0]?.rewards[0]
    if (!eliteEvent) throw new Error('expected an elite event')
    expect(eliteEvent.lootItem).toBeNull()
    expect(eliteEvent.duplicateCatalogId).toBe(rolled.catalogId)
    expect(eliteEvent.duplicateGold).toBe(DUPLICATE_GOLD[rolled.rarity])
    expect(eliteEvent.gold).toBe(node.rewards.gold + DUPLICATE_GOLD[rolled.rarity])
    expect(afterElite.profile?.gold).toBe(100 + eliteEvent.gold)
    expect(afterElite.profile?.loot).toEqual([owned])

    const afterBoss = resolveNode(afterElite, {
      nodeId: boss.id,
      action: 'complete',
      now,
    })
    const day = afterBoss.run?.days[0] as Day
    const summary = day.summary
    if (!summary) throw new Error('expected a day summary')
    expect(summary.duplicateGold).toBe(
      day.rewards.reduce((total, event) => total + event.duplicateGold, 0),
    )
    expect(summary.gold).toBe(
      day.rewards.reduce((total, event) => total + event.gold, 0),
    )
    expect(summary.xp).toBe(
      day.rewards.reduce((total, event) => total + event.xp, 0),
    )
    expect(summary.closingBonusXp).toBe(BOSS_CLOSING_BONUS.xp)
    expect(afterBoss.profile?.gold).toBe(100 + summary.gold)
  })
})

describe('day lifecycle boundaries', () => {
  it('handles 23:59 and 00:00 around local midnight', () => {
    const late = new Date(2026, 9, 20, 23, 59, 59)
    const document = openDay(makeDocument(late, 'run_midnight'), { now: late })
    const stillToday = reconcileDays(document.run as Run, dayKey(late), late)
    expect(stillToday).toBe(document.run)

    const midnight = new Date(2026, 9, 21, 0, 0, 0)
    const next = reconcileDays(document.run as Run, dayKey(midnight), midnight)
    expect(next.days[0]?.status).toBe('missed')
    expect(next.days[0]?.closedAt).toBe(midnight.toISOString())
    expect(next.days[1]?.status).toBe('available')
    expect(next.status).toBe('active')
    expect(next.totals.daysMissed).toBe(1)
    expect(next.totals.daysPlayed).toBe(0)
  })

  it('marks an opened day as missed after a three-day absence', () => {
    const document = openedDocument()
    const later = new Date(2026, 9, 23, 9, 0, 0)
    const reconciled = reconcileDays(document.run as Run, dayKey(later), later)

    expect(reconciled.days.slice(0, 3).map((day) => day.status)).toEqual([
      'missed',
      'missed',
      'missed',
    ])
    for (const day of reconciled.days.slice(0, 3)) {
      expect(day.closedAt).toBe(later.toISOString())
      expect(day.summary).toBeNull()
    }
    expect(reconciled.days[3]?.status).toBe('available')
    expect(reconciled.status).toBe('active')
    expect(reconciled.totals.daysMissed).toBe(3)
    expect(reconciled.totals.daysPlayed).toBe(0)
  })

  it('closes the run after day 7 is completed', () => {
    const start = new Date(2026, 9, 20, 9, 0, 0)
    const day7 = new Date(2026, 9, 26, 9, 0, 0)
    const base = makeDocument(start, 'run_day_seven')
    const firstSix: Run = {
      ...(base.run as Run),
      days: (base.run as Run).days.map((day, index) =>
        index < 6
          ? { ...day, status: 'completed' as const, closedAt: start.toISOString() }
          : day,
      ),
    }
    const ready = reconcileDays(firstSix, dayKey(day7), day7)
    const opened = openDay({ ...base, run: ready }, { now: day7 })
    expect(opened.run?.days[6]?.status).toBe('in_progress')

    const finished = playThrough(opened, day7, 'complete')
    const run = finished.run as Run
    const day = run.days[6] as Day

    expect(run.status).toBe('closed')
    expect(run.closedAt).toBe(day7.toISOString())
    expect(run.summary).toBeNull()
    expect(day.status).toBe('completed')
    expect(day.summary?.bossCompleted).toBe(true)
    expect(day.summary?.closingBonusXp).toBe(BOSS_CLOSING_BONUS.xp)
    expect(run.totals.daysPlayed).toBe(7)
    expect(run.totals.daysMissed).toBe(0)
    expect(run.totals.nodesCompleted).toBe(5)

    const eventXp = day.rewards.reduce((total, event) => total + event.xp, 0)
    const eventGold = day.rewards.reduce((total, event) => total + event.gold, 0)
    expect(finished.profile?.xp).toBe(eventXp)
    expect(finished.profile?.gold).toBe(eventGold)
    expect(run.totals.xp).toBe(eventXp)
    expect(run.totals.gold).toBe(eventGold)
    expect(reconcileDays(run, dayKey(day7), day7)).toBe(run)
    expect(() =>
      resolveNode(
        { ...finished, run },
        { nodeId: day.map?.boss.id ?? 'n4_0', action: 'complete', now: day7 },
      ),
    ).toThrow(/no active run/i)
  })

  it('closes the run after day 7 is missed and stays idempotent', () => {
    const base = makeDocument(now, 'run_day_missed')
    const after = new Date(2026, 9, 27, 9, 0, 0)
    const missed = reconcileDays(base.run as Run, dayKey(after), after)

    expect(missed.days.every((day) => day.status === 'missed')).toBe(true)
    expect(missed.days.every((day) => day.closedAt === after.toISOString())).toBe(
      true,
    )
    expect(missed.days.every((day) => day.summary === null)).toBe(true)
    expect(missed.status).toBe('closed')
    expect(missed.closedAt).toBe(after.toISOString())
    expect(missed.summary).toBeNull()
    expect(missed.totals.daysPlayed).toBe(0)
    expect(missed.totals.daysMissed).toBe(7)
    expect(missed.totals.xp).toBe(0)
    expect(missed.totals.gold).toBe(0)
    expect(reconcileDays(missed, dayKey(after), after)).toBe(missed)
  })

  it('closes with no weekly bonus for empty, partial and complete objectives', () => {
    const base = makeDocument(now, 'run_objectives_close').run as Run
    const after = new Date(2026, 9, 27, 9, 0, 0)
    const scenarios: Array<{ label: string; progress: number[] }> = [
      { label: 'none', progress: [0, 0] },
      { label: 'partial', progress: [2, 1] },
      {
        label: 'all',
        progress: base.objectives.map((objective) => objective.target),
      },
    ]

    for (const scenario of scenarios) {
      const closed = reconcileDays(
        objectivesWithProgress(base, scenario.progress),
        dayKey(after),
        after,
      )
      expect(closed.status, scenario.label).toBe('closed')
      expect(closed.summary, scenario.label).toBeNull()
      expect(closed.totals.xp, scenario.label).toBe(0)
      expect(closed.totals.gold, scenario.label).toBe(0)
      expect(closed.objectives.map((objective) => objective.progress)).toEqual(
        scenario.progress,
      )
    }
  })
})
