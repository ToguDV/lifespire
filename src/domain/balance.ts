import type { Effort, NodeRewards, NodeType, Rarity } from './types'

export const SCHEMA_VERSION = 1
export const STORAGE_KEY = 'lifespire:mvp0'

export const RUN_DAYS = 7
export const DECISION_LAYERS = 4
export const BOSS_LAYER = DECISION_LAYERS
export const GENERATOR_VERSION = 1

export const MIN_LAYER_NODES = 2
export const MAX_LAYER_NODES = 3
export const MIN_ELITES_PER_MAP = 1
export const MAX_ELITES_PER_MAP = 2

export const MIN_GOALS = 1
export const MAX_GOALS = 3
export const MIN_ACTIVE_TASKS = 4
export const MIN_WEEKLY_OBJECTIVE = 1
export const MAX_WEEKLY_OBJECTIVE = 7

export const XP_PER_LEVEL = 100

export const EFFORT_MULTIPLIER: Record<Effort, number> = {
  light: 1,
  medium: 1.5,
  high: 2,
}

export const REWARDS: Record<NodeType, NodeRewards> = {
  task: { xp: 10, gold: 10, lootRolls: 0, progress: 1 },
  elite: { xp: 20, gold: 20, lootRolls: 1, progress: 1 },
  rest: { xp: 5, gold: 0, lootRolls: 0, progress: 0 },
  treasure: { xp: 0, gold: 15, lootRolls: 1, progress: 0 },
  boss: { xp: 20, gold: 20, lootRolls: 1, progress: 1 },
}

export const BOSS_CLOSING_BONUS = { xp: 20, gold: 20 }

export const DUPLICATE_GOLD: Record<Rarity, number> = {
  common: 10,
  rare: 25,
  epic: 60,
}

export const LOOT_RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 60,
  rare: 30,
  epic: 10,
}

export const OBJECTIVE_BONUS = { xp: 50, gold: 50, lootRolls: 1 }
export const ALL_OBJECTIVES_BONUS = { xp: 100, gold: 100, lootRolls: 1, guaranteedRare: 1 }
