import {
  BOSS_CLOSING_BONUS,
  DUPLICATE_GOLD,
  EFFORT_MULTIPLIER,
  LOOT_RARITY_WEIGHTS,
  REWARDS,
} from './balance'
import { createLootItem, lootByRarity } from '../content/loot'
import type { LootCatalogEntry } from '../content/loot'
import { createRng } from './rng'
import { levelForXp } from './selectors'
import type {
  Effort,
  LootItem,
  NodeRewards,
  NodeType,
  Profile,
  Rarity,
} from './types'

const RARITY_ORDER: readonly Rarity[] = ['common', 'rare', 'epic']

/**
 * Rounds to the nearest whole unit. With the current balance table every
 * product is already integral, but storing integers is a hard persistence
 * invariant, so future tuning cannot leak fractional XP or gold into a save
 * file. Reward values are always non-negative.
 */
function roundUnits(value: number): number {
  return Math.round(value)
}

/**
 * Total rewards for completing a node, including the boss closing bonus.
 * Rest and treasure ignore effort; task, elite and boss scale XP and gold by
 * the effort multiplier captured in their snapshot.
 */
export function rewardsForNode(type: NodeType, effort: Effort): NodeRewards {
  const base = REWARDS[type]
  if (type === 'rest' || type === 'treasure' || type === 'wheel') {
    return { ...base }
  }

  const multiplier = EFFORT_MULTIPLIER[effort]
  const closingBonus = type === 'boss' ? BOSS_CLOSING_BONUS : { xp: 0, gold: 0 }

  return {
    xp: roundUnits(base.xp * multiplier) + closingBonus.xp,
    gold: roundUnits(base.gold * multiplier) + closingBonus.gold,
    lootRolls: base.lootRolls,
    progress: base.progress,
  }
}

/**
 * Stable seed for one loot roll. Resolution never rerolls, but the seed keeps
 * replays, tests and any future recomputation deterministic.
 */
export function lootRollSeed(
  runId: string,
  dayIndex: number,
  nodeId: string,
  rollIndex = 0,
): string {
  return `${runId}:day:${dayIndex}:node:${nodeId}:loot:${rollIndex}`
}

/** Picks a rarity with the documented 60/30/10 weights. */
export function rollLootRarity(seed: string): Rarity {
  return createRng(seed).weightedPick(RARITY_ORDER, (rarity) => LOOT_RARITY_WEIGHTS[rarity])
}

/**
 * Deterministically rolls one catalog item. The rarity is weighted first and
 * the item is then chosen uniformly inside that rarity, so every roll returns
 * a valid catalog entry.
 */
export function rollLoot(seed: string): LootCatalogEntry {
  const rng = createRng(seed)
  const rarity = rng.weightedPick(RARITY_ORDER, (entry) => LOOT_RARITY_WEIGHTS[entry])
  return rng.pick(lootByRarity(rarity))
}

export interface LootItemInput {
  runId: string
  dayIndex: number
  nodeId: string
  obtainedAt: string
}

/** Instance id: `runId:dayIndex:nodeId:catalogId`; stable across reloads. */
export function lootItemId(
  runId: string,
  dayIndex: number,
  nodeId: string,
  catalogId: string,
): string {
  return `${runId}:${dayIndex}:${nodeId}:${catalogId}`
}

/** Builds the profile instance for a rolled catalog entry with an injected time. */
export function buildLootItem(entry: LootCatalogEntry, input: LootItemInput): LootItem {
  return createLootItem(
    entry,
    lootItemId(input.runId, input.dayIndex, input.nodeId, entry.id),
    input.obtainedAt,
  )
}

export interface LootRollInput extends LootItemInput {
  rollIndex?: number
}

/** Rolls and instantiates one loot item in a single deterministic step. */
export function rollLootItem(input: LootRollInput): LootItem {
  const seed = lootRollSeed(input.runId, input.dayIndex, input.nodeId, input.rollIndex ?? 0)
  return buildLootItem(rollLoot(seed), input)
}

export interface LootAcquisition {
  profile: Profile
  /** The item added to the collection, or null when it was a duplicate. */
  lootItem: LootItem | null
  duplicateCatalogId: string | null
  duplicateGold: number
}

/**
 * Adds the first copy of a catalog item to the collection. Later copies never
 * enter `profile.loot`; they become gold using the rarity table and the
 * conversion is returned so it can be recorded in a `RewardEvent`.
 */
export function acquireLoot(profile: Profile, item: LootItem): LootAcquisition {
  if (profile.loot.some((owned) => owned.catalogId === item.catalogId)) {
    const duplicateGold = DUPLICATE_GOLD[item.rarity]
    return {
      profile: { ...profile, gold: profile.gold + duplicateGold },
      lootItem: null,
      duplicateCatalogId: item.catalogId,
      duplicateGold,
    }
  }

  return {
    profile: { ...profile, loot: [...profile.loot, item] },
    lootItem: item,
    duplicateCatalogId: null,
    duplicateGold: 0,
  }
}

/**
 * Adds XP and recalculates the display-only level in the same step, so a stored
 * profile can never carry a stale level.
 */
export function applyXp(profile: Profile, amount: number): Profile {
  const gained = Number.isFinite(amount) ? Math.max(0, Math.trunc(amount)) : 0
  const xp = profile.xp + gained
  return { ...profile, xp, level: levelForXp(xp) }
}
