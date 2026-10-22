import { describe, expect, it } from 'vitest'
import { createDemoSetup } from '../../content/demo'
import { SCHEMA_VERSION } from '../../domain/balance'
import { createRun, openDay } from '../../domain/lifecycle'
import { createEmptyDocument, serializeDocument } from '../../domain/schema'
import type { GameDocument, GameMap, Goal, Task } from '../../domain/types'
import {
  readSaveFile,
  runPreviewLabel,
  saveFileName,
  summarizeDocument,
} from './importSave'

const now = new Date(2026, 9, 20, 9, 0, 0)

function documentWithRun(closed = false): GameDocument {
  const setup = createDemoSetup(now)
  return documentFromSetup(setup, closed)
}

function documentFromSetup(
  setup: ReturnType<typeof createDemoSetup>,
  closed = false,
): GameDocument {
  const run = createRun({ setup, now, runId: 'run_import_preview' })
  return {
    ...createEmptyDocument(),
    profile: {
      id: 'profile_import_preview',
      name: 'Wren',
      xp: 240,
      level: 3,
      gold: 75,
      loot: [],
      createdAt: now.toISOString(),
    },
    goals: setup.goals,
    tasks: setup.tasks,
    run: {
      ...run,
      status: closed ? 'closed' : 'active',
      days: run.days.map((day, index) =>
        closed && index < 2
          ? { ...day, status: 'completed' as const, closedAt: now.toISOString() }
          : day,
      ),
      closedAt: closed ? now.toISOString() : null,
    },
  }
}

function v1Save(): GameDocument {
  const base = documentWithRun()
  const run = base.run
  if (!run) throw new Error('expected a run')
  const task = {
    taskId: 'demo-task-walk-north-trail',
    title: 'Walk the north trail',
    goalId: 'demo-goal-wayfarer',
    goalTitle: 'Wayfarer',
    effort: 'light' as const,
  }
  const v1Map: GameMap = {
    id: 'map_v1_day_0',
    seed: 'run:run_import_preview:day:0:g1',
    dayIndex: 0,
    generatorVersion: 1,
    layers: [
      [
        {
          id: 'n0_0',
          layer: 0,
          type: 'task',
          task: { ...task },
          rewards: { xp: 10, gold: 10, lootRolls: 0, progress: 1 },
          connections: ['n1_0', 'n1_1'],
        },
        {
          id: 'n0_1',
          layer: 0,
          type: 'task',
          task: { ...task },
          rewards: { xp: 10, gold: 10, lootRolls: 0, progress: 1 },
          connections: ['n1_1'],
        },
      ],
      [
        {
          id: 'n1_0',
          layer: 1,
          type: 'task',
          task: { ...task },
          rewards: { xp: 10, gold: 10, lootRolls: 0, progress: 1 },
          connections: ['n2_0', 'n2_1'],
        },
        {
          id: 'n1_1',
          layer: 1,
          type: 'elite',
          task: { ...task },
          rewards: { xp: 20, gold: 20, lootRolls: 1, progress: 1 },
          connections: ['n2_1'],
        },
      ],
      [
        {
          id: 'n2_0',
          layer: 2,
          type: 'task',
          task: { ...task },
          rewards: { xp: 10, gold: 10, lootRolls: 0, progress: 1 },
          connections: ['n3_0', 'n3_1'],
        },
        {
          id: 'n2_1',
          layer: 2,
          type: 'task',
          task: { ...task },
          rewards: { xp: 10, gold: 10, lootRolls: 0, progress: 1 },
          connections: ['n3_1'],
        },
      ],
      [
        {
          id: 'n3_0',
          layer: 3,
          type: 'task',
          task: { ...task },
          rewards: { xp: 10, gold: 10, lootRolls: 0, progress: 1 },
          connections: ['n4_0'],
        },
        {
          id: 'n3_1',
          layer: 3,
          type: 'task',
          task: { ...task },
          rewards: { xp: 10, gold: 10, lootRolls: 0, progress: 1 },
          connections: ['n4_0'],
        },
      ],
    ],
    boss: {
      id: 'n4_0',
      layer: 4,
      type: 'boss',
      task: { ...task },
      rewards: { xp: 40, gold: 40, lootRolls: 1, progress: 1 },
      connections: [],
    },
    currentNodeId: null,
    createdAt: now.toISOString(),
  }

  return {
    ...base,
    run: {
      ...run,
      generatorVersion: 1,
      days: run.days.map((day) =>
        day.index === 0
          ? { ...day, status: 'in_progress' as const, map: v1Map, openedAt: now.toISOString() }
          : day,
      ),
    },
  }
}

function documentWithThreeGoals(): GameDocument {
  const base = documentWithRun()
  const createdAt = now.toISOString()
  const goals: Goal[] = [
    ...base.goals,
    {
      id: 'goal_import_focus',
      title: 'Focus',
      category: 'Practice',
      weeklyObjective: 2,
      active: true,
      createdAt,
    },
  ]
  const tasks: Task[] = [
    ...base.tasks,
    {
      id: 'task_import_focus',
      goalId: 'goal_import_focus',
      title: 'Practice for twenty minutes',
      effort: 'medium',
      active: true,
      createdAt,
    },
  ]
  const setup = { name: 'Wren', goals, tasks }
  return documentFromSetup(setup)
}

describe('import preview', () => {
  it('summarizes profile, level, gold, run day, collection and schema', () => {
    const document = documentWithRun()
    const summary = summarizeDocument(document)

    expect(summary).toMatchObject({
      schemaVersion: SCHEMA_VERSION,
      profileName: 'Wren',
      level: 3,
      gold: 75,
      relics: 0,
      goals: document.goals.length,
      routines: document.tasks.length,
      runStatus: 'active',
      runDay: 1,
      daysPlayed: 0,
    })
    expect(runPreviewLabel(summary)).toBe('Active · day 1 of 7')

    const staleLevel = structuredClone(document)
    if (!staleLevel.profile) throw new Error('expected a profile')
    staleLevel.profile.level = 1
    expect(summarizeDocument(staleLevel).level).toBe(3)
  })

  it('summarizes a closed run, an absent run and an absent profile honestly', () => {
    const closed = summarizeDocument(documentWithRun(true))
    expect(closed.runStatus).toBe('closed')
    expect(closed.daysPlayed).toBe(2)
    expect(runPreviewLabel(closed)).toBe('Closed · 2 of 7 days played')

    const empty = summarizeDocument(createEmptyDocument())
    expect(empty).toMatchObject({
      profileName: null,
      level: null,
      gold: null,
      relics: 0,
      runStatus: null,
      runDay: null,
    })
    expect(runPreviewLabel(empty)).toBe('No run')
  })

  it('reads a valid exported document without changing it', () => {
    const document = documentWithRun()
    const result = readSaveFile(serializeDocument(document))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.document).toEqual(document)
    expect(result.summary).toEqual(summarizeDocument(document))
  })

  it('accepts a save with a generated day map and rejects an unplayable one', () => {
    const opened = openDay(documentWithRun(), { now })
    const valid = readSaveFile(serializeDocument(opened))
    expect(valid.ok).toBe(true)
    if (valid.ok) {
      expect(valid.document.run?.days[0]?.map).not.toBeNull()
      expect(valid.document.run?.days[0]?.map?.layers).toHaveLength(5)
      expect(valid.document.run?.days[0]?.map?.boss).toMatchObject({ id: 'n5_0', layer: 5 })
    }

    const broken = structuredClone(opened)
    broken.run!.days[0]!.map!.layers[0] = []
    const invalid = readSaveFile(serializeDocument(broken))
    expect(invalid.ok).toBe(false)
    if (invalid.ok) return
    expect(invalid.reason).toBe('invalid')
    expect(invalid.message).toContain('not a valid LifeSpire save')
    expect(invalid.message).toContain('layers[0]')
  })

  it('loads a literal v1 save without migrating or regenerating its map', () => {
    const document = v1Save()
    const result = readSaveFile(serializeDocument(document))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.document.schemaVersion).toBe(SCHEMA_VERSION)
    expect(result.document.run?.generatorVersion).toBe(1)
    const map = result.document.run?.days[0]?.map
    expect(map?.generatorVersion).toBe(1)
    expect(map?.seed).toBe('run:run_import_preview:day:0:g1')
    expect(map?.layers).toHaveLength(4)
    expect(map?.boss).toMatchObject({ id: 'n4_0', layer: 4 })
    expect(map).toEqual(document.run?.days[0]?.map)
  })

  it('round-trips a six-layer map generated from three active goals', () => {
    const opened = openDay(documentWithThreeGoals(), { now })
    const map = opened.run?.days[0]?.map
    expect(map?.layers).toHaveLength(6)
    expect(map?.boss).toMatchObject({ id: 'n6_0', layer: 6 })

    const result = readSaveFile(serializeDocument(opened))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const parsedMap = result.document.run?.days[0]?.map
    expect(parsedMap?.layers).toHaveLength(6)
    expect(parsedMap?.boss).toMatchObject({ id: 'n6_0', layer: 6 })
  })

  it('rejects malformed JSON, missing fields and future versions clearly', () => {
    const malformed = readSaveFile('{broken')
    expect(malformed.ok).toBe(false)
    if (malformed.ok) return
    expect(malformed.reason).toBe('invalid')
    expect(malformed.message).toContain('not a valid LifeSpire save')
    expect(malformed.message).toContain('valid JSON')

    const missing = readSaveFile(JSON.stringify({ schemaVersion: 1 }))
    expect(missing.ok).toBe(false)
    if (missing.ok) return
    expect(missing.reason).toBe('invalid')
    expect(missing.message).toContain('profile')

    const future = readSaveFile(JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1 }))
    expect(future.ok).toBe(false)
    if (future.ok) return
    expect(future.reason).toBe('future-version')
    expect(future.message).toContain(`version ${SCHEMA_VERSION + 1}`)
    expect(future.message).toContain('Update LifeSpire')
  })

  it('builds a dated local filename', () => {
    expect(saveFileName('2026-10-21')).toBe('lifespire-2026-10-21.json')
  })
})
