import { describe, expect, it } from 'vitest'
import { lootByRarity, findLootById, LOOT_CATALOG } from '../content/loot'
import type { LootCatalogEntry } from '../content/loot'
import {
  BOSS_CLOSING_BONUS,
  DUPLICATE_GOLD,
  EFFORT_MULTIPLIER,
  LOOT_RARITY_WEIGHTS,
  REWARDS,
} from './balance'
import {
  acquireLoot,
  applyXp,
  buildLootItem,
  lootItemId,
  lootRollSeed,
  rewardsForNode,
  rollLoot,
  rollLootItem,
  rollLootRarity,
} from './rewards'
import type { Effort, NodeRewards, NodeType, Profile, Rarity } from './types'

const EFFORTS: Effort[] = ['light', 'medium', 'high']

const EXPECTED: Record<NodeType, NodeRewards[]> = {
  task: [
    { xp: 10, gold: 10, lootRolls: 0, progress: 1 },
    { xp: 15, gold: 15, lootRolls: 0, progress: 1 },
    { xp: 20, gold: 20, lootRolls: 0, progress: 1 },
  ],
  elite: [
    { xp: 20, gold: 20, lootRolls: 1, progress: 1 },
    { xp: 30, gold: 30, lootRolls: 1, progress: 1 },
    { xp: 40, gold: 40, lootRolls: 1, progress: 1 },
  ],
  rest: [
    { xp: 5, gold: 0, lootRolls: 0, progress: 0 },
    { xp: 5, gold: 0, lootRolls: 0, progress: 0 },
    { xp: 5, gold: 0, lootRolls: 0, progress: 0 },
  ],
  treasure: [
    { xp: 0, gold: 15, lootRolls: 1, progress: 0 },
    { xp: 0, gold: 15, lootRolls: 1, progress: 0 },
    { xp: 0, gold: 15, lootRolls: 1, progress: 0 },
  ],
  boss: [
    { xp: 40, gold: 40, lootRolls: 1, progress: 1 },
    { xp: 50, gold: 50, lootRolls: 1, progress: 1 },
    { xp: 60, gold: 60, lootRolls: 1, progress: 1 },
  ],
}

const CASES = (Object.keys(EXPECTED) as NodeType[]).flatMap((type) =>
  EFFORTS.map((effort, index) => ({
    type,
    effort,
    expected: EXPECTED[type][index] as NodeRewards,
  })),
)

describe('rewardsForNode', () => {
  it.each(CASES)('$type at $effort effort returns the SPEC reward total', ({
    type,
    effort,
    expected,
  }) => {
    expect(rewardsForNode(type, effort)).toEqual(expected)
  })

  it('covers the full 5 × 3 table', () => {
    expect(CASES).toHaveLength(15)
  })

  it('only scales task, elite and boss XP and gold', () => {
    for (const type of ['task', 'elite', 'boss'] as const) {
      for (const effort of EFFORTS) {
        const base = REWARDS[type]
        const closing = type === 'boss' ? BOSS_CLOSING_BONUS : { xp: 0, gold: 0 }
        expect(rewardsForNode(type, effort).xp).toBe(
          Math.round(base.xp * EFFORT_MULTIPLIER[effort]) + closing.xp,
        )
        expect(rewardsForNode(type, effort).gold).toBe(
          Math.round(base.gold * EFFORT_MULTIPLIER[effort]) + closing.gold,
        )
      }
    }
  })

  it('adds the boss closing bonus once and keeps every value integral', () => {
    for (const type of Object.keys(EXPECTED) as NodeType[]) {
      for (const effort of EFFORTS) {
        const rewards = rewardsForNode(type, effort)
        expect(Number.isInteger(rewards.xp)).toBe(true)
        expect(Number.isInteger(rewards.gold)).toBe(true)
        expect(Number.isInteger(rewards.lootRolls)).toBe(true)
      }
    }

    expect(rewardsForNode('boss', 'high')).toEqual({
      xp: REWARDS.boss.xp * 2 + BOSS_CLOSING_BONUS.xp,
      gold: REWARDS.boss.gold * 2 + BOSS_CLOSING_BONUS.gold,
      lootRolls: 1,
      progress: 1,
    })
  })

  it('returns a fresh object that cannot mutate the balance table', () => {
    const rewards = rewardsForNode('task', 'light')
    rewards.xp = 999
    expect(REWARDS.task.xp).toBe(10)
    expect(rewardsForNode('task', 'light').xp).toBe(10)
  })
})

const OBTAINED_AT = '2026-10-20T10:00:00.000Z'

function catalogEntry(id: string): LootCatalogEntry {
  const entry = findLootById(id)
  if (!entry) throw new Error(`missing catalog entry: ${id}`)
  return entry
}

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'profile_rewards',
    name: 'Wren',
    xp: 0,
    level: 1,
    gold: 0,
    loot: [],
    createdAt: OBTAINED_AT,
    ...overrides,
  }
}

function lootInput(nodeId = 'n0_0', runId = 'run_rewards') {
  return { runId, dayIndex: 0, nodeId, obtainedAt: OBTAINED_AT }
}

describe('loot rolling', () => {
  it('builds stable seeds per run, day, node and roll', () => {
    expect(lootRollSeed('run_a', 0, 'n0_0')).toBe('run_a:day:0:node:n0_0:loot:0')
    expect(lootRollSeed('run_a', 2, 'n1_0', 1)).toBe(
      'run_a:day:2:node:n1_0:loot:1',
    )
    expect(lootRollSeed('run_a', 0, 'n0_0')).not.toBe(
      lootRollSeed('run_b', 0, 'n0_0'),
    )
    expect(lootRollSeed('run_a', 0, 'n0_0')).not.toBe(
      lootRollSeed('run_a', 1, 'n0_0'),
    )
  })

  it('is deterministic and always returns a valid catalog entry', () => {
    for (let index = 0; index < 250; index += 1) {
      const seed = `roll:${index}`
      const first = rollLoot(seed)
      const second = rollLoot(seed)

      expect(second).toEqual(first)
      expect(LOOT_CATALOG).toContainEqual(first)
      expect(first.rarity).toBe(rollLootRarity(seed))
      expect(lootByRarity(first.rarity).map((entry) => entry.id)).toContain(first.id)
    }
  })

  it('reaches common, rare and epic deterministically', () => {
    const seeds = new Map<Rarity, string>()
    for (let index = 0; index < 1000 && seeds.size < 3; index += 1) {
      const seed = `rarity:${index}`
      const rarity = rollLootRarity(seed)
      if (!seeds.has(rarity)) seeds.set(rarity, seed)
    }

    expect([...seeds.keys()].sort()).toEqual(['common', 'epic', 'rare'])
    for (const [rarity, seed] of seeds) {
      const entry = rollLoot(seed)
      expect(rollLoot(seed)).toEqual(entry)
      expect(entry.rarity).toBe(rarity)
      expect(rollLootRarity(seed)).toBe(rarity)
    }
  })

  it('respects the 60/30/10 rarity weights', () => {
    const total = 6000
    const counts: Record<Rarity, number> = { common: 0, rare: 0, epic: 0 }
    for (let index = 0; index < total; index += 1) {
      counts[rollLootRarity(`distribution:${index}`)] += 1
    }

    expect(counts.common / total).toBeGreaterThan(0.56)
    expect(counts.common / total).toBeLessThan(0.64)
    expect(counts.rare / total).toBeGreaterThan(0.26)
    expect(counts.rare / total).toBeLessThan(0.34)
    expect(counts.epic / total).toBeGreaterThan(0.07)
    expect(counts.epic / total).toBeLessThan(0.13)
    expect(
      LOOT_RARITY_WEIGHTS.common +
        LOOT_RARITY_WEIGHTS.rare +
        LOOT_RARITY_WEIGHTS.epic,
    ).toBe(100)
  })
})

describe('loot instances', () => {
  it('uses runId:dayIndex:nodeId:catalogId as the stable instance id', () => {
    const entry = catalogEntry('ember-flask')
    const item = buildLootItem(entry, lootInput())

    expect(lootItemId('run_rewards', 0, 'n0_0', entry.id)).toBe(
      'run_rewards:0:n0_0:ember-flask',
    )
    expect(item).toEqual({
      id: 'run_rewards:0:n0_0:ember-flask',
      catalogId: 'ember-flask',
      name: 'Ember Flask',
      rarity: 'common',
      description: entry.description,
      obtainedAt: OBTAINED_AT,
    })
    expect(buildLootItem(entry, lootInput())).toEqual(item)
    const rolled = rollLootItem({ ...lootInput(), rollIndex: 7 })
    expect(rolled.id).toBe(`run_rewards:0:n0_0:${rolled.catalogId}`)
  })

  it('builds the same item from the same roll input', () => {
    const first = rollLootItem({ ...lootInput('n1_0'), rollIndex: 0 })
    const second = rollLootItem({ ...lootInput('n1_0'), rollIndex: 0 })

    expect(second).toEqual(first)
    expect(first.id).toBe(`run_rewards:0:n1_0:${first.catalogId}`)
    expect(LOOT_CATALOG.map((entry) => entry.id)).toContain(first.catalogId)
  })
})

describe('loot acquisition', () => {
  it('collects the first copy without mutating the profile', () => {
    const before = profile()
    const item = buildLootItem(catalogEntry('silverbark-ring'), lootInput())
    const acquisition = acquireLoot(before, item)

    expect(acquisition.profile.loot).toEqual([item])
    expect(acquisition.lootItem).toEqual(item)
    expect(acquisition.duplicateCatalogId).toBeNull()
    expect(acquisition.duplicateGold).toBe(0)
    expect(acquisition.profile.gold).toBe(0)
    expect(before.loot).toEqual([])
  })

  it.each(['common', 'rare', 'epic'] as const)(
    'converts a duplicate %s item into its documented gold value',
    (rarity) => {
      const entry = lootByRarity(rarity)[0]
      if (!entry) throw new Error(`missing ${rarity} loot`)
      const owned = buildLootItem(entry, lootInput())
      const duplicate = buildLootItem(entry, lootInput('n2_0'))
      const acquisition = acquireLoot(profile({ gold: 7, loot: [owned] }), duplicate)

      expect(acquisition.profile.loot).toEqual([owned])
      expect(acquisition.lootItem).toBeNull()
      expect(acquisition.duplicateCatalogId).toBe(entry.id)
      expect(acquisition.duplicateGold).toBe(DUPLICATE_GOLD[rarity])
      expect(acquisition.profile.gold).toBe(7 + DUPLICATE_GOLD[rarity])
    },
  )
})

describe('applyXp', () => {
  it.each([
    { gained: 0, xp: 0, level: 1 },
    { gained: 99, xp: 99, level: 1 },
    { gained: 100, xp: 100, level: 2 },
    { gained: 199, xp: 199, level: 2 },
    { gained: 200, xp: 200, level: 3 },
  ])('maps +$gained XP to level $level', ({ gained, xp, level }) => {
    const before = profile()
    const after = applyXp(before, gained)

    expect(after.xp).toBe(xp)
    expect(after.level).toBe(level)
    expect(before.xp).toBe(0)
    expect(before.level).toBe(1)
  })

  it('only crosses a level when the threshold is reached', () => {
    const almost = applyXp(profile({ xp: 95, level: 1 }), 4)
    expect(almost).toMatchObject({ xp: 99, level: 1 })

    const crossed = applyXp(almost, 1)
    expect(crossed).toMatchObject({ xp: 100, level: 2 })

    const kept = applyXp(profile({ xp: 199, level: 2 }), 0)
    expect(kept).toMatchObject({ xp: 199, level: 2 })
  })
})
