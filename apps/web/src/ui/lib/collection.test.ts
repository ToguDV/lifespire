import { describe, expect, it } from 'vitest'
import { LOOT_CATALOG, createLootItem, findLootById } from '../../content/loot'
import { createDemoSetup } from '../../content/demo'
import { createRun } from '../../domain/lifecycle'
import type { LootItem, RewardEvent, Run } from '../../domain/types'
import {
  buildCollection,
  collectionFilterOptions,
  collectionOwnedCount,
  duplicateConversions,
  duplicateGoldTotal,
  filterCollection,
} from './collection'

const now = new Date(2026, 9, 20, 9, 0, 0)

function owned(catalogId: string, obtainedAt = now.toISOString()): LootItem {
  const entry = findLootById(catalogId)
  if (!entry) throw new Error(`missing test relic ${catalogId}`)
  return createLootItem(entry, `loot_${catalogId}`, obtainedAt)
}

function runWith(events: RewardEvent[]): Run {
  const setup = createDemoSetup(now)
  const run = createRun({ setup, now, runId: 'run_collection' })
  return {
    ...run,
    days: run.days.map((day, index) =>
      index === 0
        ? { ...day, rewards: events }
        : day,
    ),
  }
}

function conversion({ id, ...patch }: Partial<RewardEvent> & Pick<RewardEvent, 'id'>): RewardEvent {
  return {
    id,
    dayIndex: 0,
    nodeId: 'n0_0',
    nodeType: 'elite',
    action: 'complete',
    taskId: 'task_1',
    taskTitle: 'Walk',
    goalId: 'goal_1',
    goalTitle: 'Wayfarer',
    xp: 20,
    gold: 45,
    progress: 1,
    lootItem: null,
    duplicateCatalogId: 'ember-flask',
    duplicateGold: 25,
    closingBonus: false,
    at: now.toISOString(),
    ...patch,
  }
}

describe('collection catalogue', () => {
  it('always exposes all twelve relics, owned or undiscovered', () => {
    const empty = buildCollection([])
    expect(empty).toHaveLength(12)
    expect(empty.map((entry) => entry.catalog.id)).toEqual(
      LOOT_CATALOG.map((entry) => entry.id),
    )
    expect(empty.every((entry) => entry.owned === null)).toBe(true)

    const complete = buildCollection(LOOT_CATALOG.map((entry) => owned(entry.id)))
    expect(collectionOwnedCount(complete)).toBe(12)
    expect(complete.every((entry) => entry.owned !== null)).toBe(true)
  })

  it('matches owned instances by catalogId and ignores unknown copies', () => {
    const flask = owned('ember-flask')
    const duplicate = { ...flask, id: 'loot_second_flask' }
    const entries = buildCollection([flask, duplicate])
    const flaskEntry = entries.find((entry) => entry.catalog.id === 'ember-flask')

    expect(collectionOwnedCount(entries)).toBe(1)
    expect(flaskEntry?.owned).toBe(flask)
  })

  it('counts and filters each rarity with the full catalogue total', () => {
    const entries = buildCollection([
      owned('wayfarers-compass'),
      owned('ember-flask'),
      owned('silverbark-ring'),
      owned('crown-of-the-quiet-spire'),
    ])

    expect(collectionFilterOptions(entries)).toEqual([
      { filter: 'all', label: 'All', owned: 4, total: 12 },
      { filter: 'common', label: 'Common', owned: 2, total: 5 },
      { filter: 'rare', label: 'Rare', owned: 1, total: 4 },
      { filter: 'epic', label: 'Epic', owned: 1, total: 3 },
    ])
    expect(filterCollection(entries, 'all')).toHaveLength(12)
    expect(filterCollection(entries, 'common')).toHaveLength(5)
    expect(filterCollection(entries, 'rare')).toHaveLength(4)
    expect(filterCollection(entries, 'epic')).toHaveLength(3)
    expect(filterCollection(entries, 'epic').every((entry) => entry.catalog.rarity === 'epic')).toBe(true)
  })
})

describe('duplicate conversion history', () => {
  it('reads conversions from the current run reward events', () => {
    const run = runWith([
      conversion({ id: 'reward_1', dayIndex: 0, duplicateCatalogId: 'ember-flask', duplicateGold: 10 }),
      conversion({
        id: 'reward_2',
        dayIndex: 0,
        duplicateCatalogId: 'silverbark-ring',
        duplicateGold: 25,
        at: '2026-10-20T18:00:00.000Z',
      }),
      conversion({ id: 'reward_new', duplicateCatalogId: null, duplicateGold: 0 }),
    ])

    const conversions = duplicateConversions(run)
    expect(conversions).toEqual([
      {
        eventId: 'reward_1',
        catalogId: 'ember-flask',
        name: 'Ember Flask',
        rarity: 'common',
        gold: 10,
        dayNumber: 1,
        date: run.days[0]?.date,
        at: now.toISOString(),
      },
      {
        eventId: 'reward_2',
        catalogId: 'silverbark-ring',
        name: 'Silverbark Ring',
        rarity: 'rare',
        gold: 25,
        dayNumber: 1,
        date: run.days[0]?.date,
        at: '2026-10-20T18:00:00.000Z',
      },
    ])
    expect(duplicateGoldTotal(conversions)).toBe(35)
  })

  it('is honestly empty without a run or without conversion events', () => {
    expect(duplicateConversions(null)).toEqual([])
    expect(duplicateConversions(runWith([]))).toEqual([])
    expect(duplicateGoldTotal([])).toBe(0)
  })
})
