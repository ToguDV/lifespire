import { describe, expect, it } from 'vitest'
import { createDemoSetup } from '../content/demo'
import { SCHEMA_VERSION } from './balance'
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
  MapNode,
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

function node(id: string, layer: number, type: MapNode['type']): MapNode {
  return {
    id,
    layer,
    type,
    task: type === 'rest' || type === 'treasure' ? null : snapshot,
    rewards: { xp: 10, gold: 10, lootRolls: 0, progress: type === 'rest' ? 0 : 1 },
    connections: [],
  }
}

function mapFor(dayIndex: number): GameMap {
  return {
    id: `map_${dayIndex}`,
    seed: `seed_${dayIndex}`,
    dayIndex,
    generatorVersion: 1,
    layers: [
      [node('n0_0', 0, 'task')],
      [node('n1_0', 1, 'elite')],
      [node('n2_0', 2, 'treasure')],
      [node('n3_0', 3, 'rest')],
    ],
    boss: node('boss', 4, 'boss'),
    currentNodeId: 'n1_0',
    createdAt: now.toISOString(),
  }
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
    map: mapFor(0),
    path: [{ nodeId: 'n0_0', action: 'complete', at: now.toISOString() }],
    rewards: [reward],
    openedAt: now.toISOString(),
  }
  const dayOne: Day = {
    ...baseRun.days[1]!,
    status: 'completed',
    map: mapFor(1),
    path: [{ nodeId: 'n0_0', action: 'complete', at: now.toISOString() }],
    rewards: [reward],
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
