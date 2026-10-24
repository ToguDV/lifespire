import { describe, expect, it } from 'vitest'
import type { Day, LootItem, MapNode, RewardEvent } from '../../domain/types'
import {
  buildDayPath,
  closingBonusCopy,
  dayPathReward,
  rewardFeedback,
} from './daySummary'

const at = '2026-10-21T09:00:00.000Z'

const loot: LootItem = {
  id: 'loot_1',
  catalogId: 'brass-lantern',
  name: 'Brass Lantern',
  rarity: 'rare',
  description: 'A small light.',
  obtainedAt: at,
}

function taskNode(id: string, title = 'Walk the north trail'): MapNode {
  return {
    id,
    layer: 0,
    type: 'task',
    task: {
      taskId: 'task_1',
      title,
      goalId: 'goal_1',
      goalTitle: 'Wayfarer',
      effort: 'light',
    },
    rewards: { xp: 10, gold: 10, lootRolls: 0, progress: 1 },
    connections: [],
  }
}

function bossNode(layer: number): MapNode {
  return {
    id: 'boss_1',
    layer,
    type: 'boss',
    task: {
      taskId: 'task_2',
      title: 'Climb the old stair',
      goalId: 'goal_1',
      goalTitle: 'Wayfarer',
      effort: 'high',
    },
    rewards: { xp: 60, gold: 60, lootRolls: 1, progress: 1 },
    connections: [],
  }
}

function event(patch: Partial<RewardEvent> & Pick<RewardEvent, 'nodeId' | 'action'>): RewardEvent {
  return {
    id: `event_${patch.nodeId}`,
    dayIndex: 0,
    nodeType: 'task',
    taskId: 'task_1',
    taskTitle: 'Walk the north trail',
    goalId: 'goal_1',
    goalTitle: 'Wayfarer',
    xp: 0,
    gold: 0,
    progress: 0,
    lootItem: null,
    duplicateCatalogId: null,
    duplicateGold: 0,
    closingBonus: false,
    at,
    ...patch,
  }
}

function dayFixture(): Day {
  const layers: MapNode[][] = [
    [taskNode('n0_0'), taskNode('n0_1', 'Ride before dawn')],
    [],
    [],
    [],
  ]
  return {
    id: 'run_1:day:0',
    index: 0,
    date: '2026-10-21',
    status: 'completed',
    map: {
      id: 'map_1',
      seed: 'seed',
      dayIndex: 0,
      generatorVersion: 1,
      layers,
      boss: bossNode(layers.length),
      currentNodeId: null,
      createdAt: at,
    },
    path: [
      { nodeId: 'n0_0', action: 'complete', at },
      { nodeId: 'n0_1', action: 'skip', at },
      { nodeId: 'boss_1', action: 'complete', at },
    ],
    rewards: [
      event({ nodeId: 'n0_0', action: 'complete', xp: 10, gold: 10, progress: 1 }),
      event({ nodeId: 'n0_1', action: 'skip', taskTitle: 'Ride before dawn' }),
      event({
        nodeId: 'boss_1',
        action: 'complete',
        nodeType: 'boss',
        taskTitle: 'Climb the old stair',
        xp: 60,
        gold: 60,
        progress: 1,
        closingBonus: true,
        lootItem: loot,
      }),
    ],
    openedAt: at,
    closedAt: at,
    summary: null,
  }
}

describe('buildDayPath', () => {
  it('joins path order with persisted actions and rewards', () => {
    const rows = buildDayPath(dayFixture())
    expect(rows.map((row) => [row.title, row.action, row.xp, row.gold])).toEqual([
      ['Walk the north trail', 'complete', 10, 10],
      ['Ride before dawn', 'skip', 0, 0],
      ['Climb the old stair', 'complete', 60, 60],
    ])
    expect(rows[2]?.loot?.name).toBe('Brass Lantern')
    expect(rows[2]?.closingBonus).toBe(true)
  })

  it('falls back to zero rewards when an event is missing', () => {
    const day = dayFixture()
    const rows = buildDayPath({ ...day, rewards: [] })
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ action: 'complete', xp: 0, gold: 0, loot: null })
  })
})

describe('reward feedback', () => {
  it('makes a skip explicitly rewardless', () => {
    const text = rewardFeedback({
      action: 'skip',
      xp: 0,
      gold: 0,
      lootItem: null,
      duplicateGold: 0,
      duplicateCatalogId: null,
      progress: 0,
    })
    expect(text).toContain('no XP, gold, loot or weekly progress')
  })

  it('reports XP, gold, loot, duplicate conversion and progress', () => {
    const text = rewardFeedback({
      action: 'complete',
      xp: 40,
      gold: 50,
      lootItem: null,
      duplicateGold: 10,
      duplicateCatalogId: 'brass-lantern',
      progress: 1,
    })
    expect(text).toContain('+40 XP')
    expect(text).toContain('+50 gold')
    expect(text).toContain('incl. +10 gold duplicate')
    expect(text).toContain('+1 toward weekly target')
  })

  it('does not promise weekly progress for a wheel task outside the run goals', () => {
    const text = rewardFeedback({
      action: 'complete',
      nodeType: 'wheel',
      wheelOutcome: 'task',
      taskTitle: 'Walk the north trail',
      xp: 10,
      gold: 10,
      lootItem: null,
      duplicateGold: 0,
      duplicateCatalogId: null,
      progress: 0,
    })
    expect(text).toContain('Wheel: Walk the north trail')
    expect(text).toContain('+10 XP')
    expect(text).toContain('+10 gold')
    expect(text).not.toContain('+1 toward weekly target')
  })

  it('reports weekly progress for a wheel task that advances a goal', () => {
    const text = rewardFeedback({
      action: 'complete',
      nodeType: 'wheel',
      wheelOutcome: 'task',
      taskTitle: 'Walk the north trail',
      xp: 10,
      gold: 10,
      lootItem: null,
      duplicateGold: 0,
      duplicateCatalogId: null,
      progress: 1,
    })
    expect(text).toContain('+1 toward weekly target')
  })
})

describe('summary reward copy', () => {
  it('shows a skipped node as rewardless and the boss bonus as forfeited', () => {
    expect(dayPathReward({ action: 'skip', xp: 0, gold: 0, loot: null, duplicateGold: 0 })).toBe(
      'No reward',
    )
    expect(
      dayPathReward({ action: 'complete', xp: 20, gold: 35, loot: null, duplicateGold: 15 }),
    ).toBe('+20 XP · +35 g')
    expect(closingBonusCopy(false, 0, 0)).toBe('Forfeited')
    expect(closingBonusCopy(true, 20, 20)).toBe('+20 XP · +20 gold')
  })
})
