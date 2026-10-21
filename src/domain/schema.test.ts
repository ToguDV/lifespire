import { describe, expect, it } from 'vitest'
import { createDemoSetup } from '../content/demo'
import { SCHEMA_VERSION } from './balance'
import { generateMap } from './generator'
import { createRun } from './lifecycle'
import {
  createEmptyDocument,
  migrateDocument,
  parseDocument,
  serializeDocument,
} from './schema'
import type {
  Day,
  DaySummary,
  GameDocument,
  GameMap,
  LootItem,
  RewardEvent,
  Run,
  TaskSnapshot,
} from './types'

const now = new Date(2026, 9, 20, 8, 0, 0)

const loot: LootItem = {
  id: 'loot_1',
  catalogId: 'lantern-of-the-long-road',
  name: 'Lantern of the Long Road',
  rarity: 'rare',
  description: 'Its small flame never hurries.',
  obtainedAt: now.toISOString(),
}

const snapshot: TaskSnapshot = {
  taskId: 'demo-task-walk-north-trail',
  title: 'Walk the north trail',
  goalId: 'demo-goal-wayfarer',
  goalTitle: 'Wayfarer',
  effort: 'light',
}

function mapFor(dayIndex: number, run: Run): GameMap {
  const setup = createDemoSetup(now)
  const map = generateMap({
    runId: run.id,
    runSeed: run.seed,
    dayIndex,
    generatorVersion: run.generatorVersion,
    goals: setup.goals,
    tasks: setup.tasks,
    objectives: run.objectives,
    now: now.toISOString(),
  })
  return dayIndex === 0 ? { ...map, currentNodeId: 'n1_0' } : map
}

const reward: RewardEvent = {
  id: 'reward_1',
  dayIndex: 0,
  nodeId: 'n0_0',
  nodeType: 'task',
  action: 'complete',
  taskId: snapshot.taskId,
  taskTitle: snapshot.title,
  goalId: snapshot.goalId,
  goalTitle: snapshot.goalTitle,
  xp: 10,
  gold: 10,
  progress: 1,
  lootItem: loot,
  duplicateCatalogId: null,
  duplicateGold: 0,
  closingBonus: false,
  at: now.toISOString(),
}

const summary: DaySummary = {
  xp: 10,
  gold: 10,
  loot: [loot],
  duplicateGold: 0,
  bossCompleted: false,
  closingBonusXp: 0,
  closingBonusGold: 0,
  completed: 1,
  skipped: 0,
  objectives: [
    { goalId: 'demo-goal-wayfarer', title: 'Wayfarer', before: 0, after: 1, target: 4 },
  ],
}

function fullDocument(): GameDocument {
  const setup = createDemoSetup(now)
  const baseRun = createRun({
    setup: { goals: setup.goals, tasks: setup.tasks },
    now,
    runId: 'run_fixture',
  })

  const dayZero: Day = {
    ...baseRun.days[0]!,
    status: 'in_progress',
    map: mapFor(0, baseRun),
    path: [{ nodeId: 'n0_0', action: 'complete', at: now.toISOString() }],
    rewards: [{ ...reward }],
    openedAt: now.toISOString(),
  }
  const dayOne: Day = {
    ...baseRun.days[1]!,
    status: 'completed',
    map: mapFor(1, baseRun),
    path: [{ nodeId: 'n0_0', action: 'complete', at: now.toISOString() }],
    rewards: [{ ...reward }],
    openedAt: now.toISOString(),
    closedAt: now.toISOString(),
    summary,
  }

  const run: Run = {
    ...baseRun,
    objectives: baseRun.objectives.map((objective) => ({ ...objective, progress: 2 })),
    totals: {
      xp: 20,
      gold: 20,
      lootCount: 1,
      nodesCompleted: 2,
      nodesSkipped: 0,
      daysPlayed: 1,
      daysMissed: 0,
    },
    days: [dayZero, dayOne, ...baseRun.days.slice(2)],
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    profile: {
      id: 'profile_1',
      name: 'Wren',
      xp: 250,
      level: 3,
      gold: 120,
      loot: [loot],
      createdAt: now.toISOString(),
    },
    goals: setup.goals,
    tasks: setup.tasks,
    run,
    onboardingDraft: null,
    settings: { theme: 'dark' },
  }
}

describe('createEmptyDocument', () => {
  it('starts with schema v1 and safe defaults', () => {
    expect(createEmptyDocument()).toEqual({
      schemaVersion: 1,
      profile: null,
      goals: [],
      tasks: [],
      run: null,
      onboardingDraft: null,
      settings: { theme: 'system' },
    })
  })
})

describe('serializeDocument and parseDocument', () => {
  it('round-trips a complete document', () => {
    const document = fullDocument()
    const serialized = serializeDocument(document)
    const parsed = parseDocument(serialized)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.value).toEqual(document)
    }
  })

  it('accepts a parsed object as well as JSON text', () => {
    const document = fullDocument()
    const parsed = parseDocument(document)
    expect(parsed.ok).toBe(true)
  })

  it('writes readable JSON with two-space indentation', () => {
    const serialized = serializeDocument(createEmptyDocument())
    expect(serialized).toContain('\n  "schemaVersion": 1')
    expect(serialized).not.toContain('hydrated')
    expect(serialized).not.toContain('toast')
  })

  it('round-trips an in-progress draft with an out-of-range weekly aim', () => {
    const document = createEmptyDocument()
    document.onboardingDraft = {
      step: 2,
      mode: 'custom',
      name: 'Ari',
      goals: [
        {
          id: 'goal_draft',
          title: '',
          category: '',
          weeklyObjective: 8,
          active: true,
          createdAt: now.toISOString(),
        },
      ],
      tasks: [],
    }
    const parsed = parseDocument(serializeDocument(document))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.value.onboardingDraft).toEqual(document.onboardingDraft)
  })

  it('rejects malformed JSON', () => {
    const parsed = parseDocument('{not json')
    expect(parsed).toMatchObject({ ok: false, reason: 'invalid' })
  })

  it('rejects missing required fields', () => {
    const parsed = parseDocument(JSON.stringify({ schemaVersion: 1 }))
    expect(parsed).toMatchObject({ ok: false, reason: 'invalid' })
  })

  it('rejects an unknown enum', () => {
    const document = fullDocument()
    document.tasks[0] = { ...document.tasks[0]!, effort: 'extreme' as never }
    const parsed = parseDocument(document)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.error).toContain('effort')
    }
  })

  it('rejects a future schema version before validating the rest', () => {
    const parsed = parseDocument(JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1 }))
    expect(parsed).toMatchObject({ ok: false, reason: 'future-version' })
  })

  it('rejects an invalid schema version', () => {
    expect(parseDocument({ schemaVersion: 0 })).toMatchObject({ ok: false, reason: 'invalid' })
    expect(parseDocument({ schemaVersion: 'one' })).toMatchObject({
      ok: false,
      reason: 'invalid',
    })
  })

  it('rejects invalid nested dates, loot and run lengths', () => {
    const badDate = fullDocument()
    badDate.run!.days[0] = { ...badDate.run!.days[0]!, date: '2026-02-30' }
    expect(parseDocument(badDate).ok).toBe(false)

    const badLoot = fullDocument()
    badLoot.profile!.loot[0] = { ...badLoot.profile!.loot[0]!, rarity: 'mythic' as never }
    expect(parseDocument(badLoot).ok).toBe(false)

    const shortRun = fullDocument()
    shortRun.run = { ...shortRun.run!, days: shortRun.run!.days.slice(0, 3) }
    expect(parseDocument(shortRun).ok).toBe(false)
  })

  it('rejects maps that are structurally valid but unplayable', () => {
    const wrongBoss = fullDocument()
    wrongBoss.run!.days[0]!.map!.boss.type = 'task'
    const bossResult = parseDocument(wrongBoss)
    expect(bossResult.ok).toBe(false)
    if (!bossResult.ok) expect(bossResult.error).toContain('boss.type')

    const emptyLayer = fullDocument()
    emptyLayer.run!.days[0]!.map!.layers[0] = []
    expect(parseDocument(emptyLayer).ok).toBe(false)

    const missingTarget = fullDocument()
    missingTarget.run!.days[0]!.map!.layers[0]![0]!.connections = ['n9_9']
    const targetResult = parseDocument(missingTarget)
    expect(targetResult.ok).toBe(false)
    if (!targetResult.ok) expect(targetResult.error).toContain('n9_9')

    const missingCurrent = fullDocument()
    missingCurrent.run!.days[0]!.map!.currentNodeId = 'n9_9'
    expect(parseDocument(missingCurrent).ok).toBe(false)
  })

  it('rejects maps, days and paths that do not belong together', () => {
    const wrongDayIndex = fullDocument()
    const dayZero = wrongDayIndex.run!.days[0]!
    dayZero.map = {
      ...dayZero.map!,
      dayIndex: 1,
      seed: `${wrongDayIndex.run!.seed}:day:1:g1`,
    }
    const dayIndexResult = parseDocument(wrongDayIndex)
    expect(dayIndexResult.ok).toBe(false)
    if (!dayIndexResult.ok) expect(dayIndexResult.error).toContain('dayIndex')

    const foreignDay = fullDocument()
    foreignDay.run!.days[0]!.id = 'other_run:day:0'
    const foreignResult = parseDocument(foreignDay)
    expect(foreignResult.ok).toBe(false)
    if (!foreignResult.ok) expect(foreignResult.error).toContain('belong to this run')

    const missingPathNode = fullDocument()
    missingPathNode.run!.days[0]!.path.push({
      nodeId: 'n9_9',
      action: 'complete',
      at: now.toISOString(),
    })
    const pathResult = parseDocument(missingPathNode)
    expect(pathResult.ok).toBe(false)
    if (!pathResult.ok) expect(pathResult.error).toContain('path[1]')

    const missingRewardNode = fullDocument()
    missingRewardNode.run!.days[0]!.rewards[0]!.nodeId = 'n9_9'
    const rewardResult = parseDocument(missingRewardNode)
    expect(rewardResult.ok).toBe(false)
    if (!rewardResult.ok) expect(rewardResult.error).toContain('rewards[0]')
  })

  it('rejects unknown themes and missing settings', () => {
    const document = fullDocument()
    document.settings = { theme: 'sepia' as never }
    expect(parseDocument(document).ok).toBe(false)
    expect(parseDocument({ ...document, settings: undefined }).ok).toBe(false)
  })

  it('drops unknown top-level development keys on parse', () => {
    const document = { ...fullDocument(), devOffset: 3, view: { name: 'home' } }
    const parsed = parseDocument(document)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect('devOffset' in parsed.value).toBe(false)
      expect('view' in parsed.value).toBe(false)
    }
  })
})

describe('migrateDocument', () => {
  it('is the entry point for the current version', () => {
    const parsed = migrateDocument(fullDocument())
    expect(parsed.ok).toBe(true)
  })

  it('reports invalid JSON through the migration entry point', () => {
    expect(migrateDocument('')).toMatchObject({ ok: false, reason: 'invalid' })
  })
})
