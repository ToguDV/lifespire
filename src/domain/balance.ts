import type { Effort, NodeRewards, NodeType, Rarity, WheelOutcome } from './types'

export const SCHEMA_VERSION = 2
export const STORAGE_KEY = 'lifespire:mvp0'

export const RUN_DAYS = 7
export const MIN_GOALS = 1
export const MAX_GOALS = 10

export const MIN_DECISION_LAYERS = 3
export const LAYER_OFFSET_MIN = 2
export const LAYER_OFFSET_MAX = 5
export const LAYER_OFFSET_GOALS = 2
export const MAX_DECISION_LAYERS = LAYER_OFFSET_MAX + MAX_GOALS
export const GENERATOR_VERSION = 5
/** First generator version that enforces three-node layers and forced crossings. */
export const STRICT_LAYER_RULES_VERSION = 4
/** Maps generated before `STRICT_LAYER_RULES_VERSION` may contain two-node layers. */
export const LEGACY_MIN_LAYER_NODES = 2

export const MIN_LAYER_NODES = 3
export const MAX_LAYER_NODES = 5
/** Weekly-target total needed for each extra decision layer. */
export const WEEKLY_TARGETS_PER_EXTRA_LAYER = 7
export const MIN_ELITES_PER_MAP = 1
export const MAX_ELITES_PER_MAP = 2

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
  wheel: { xp: 0, gold: 0, lootRolls: 0, progress: 0 },
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

// Wheel node outcome weights and payouts.
export const WHEEL_OUTCOME_WEIGHTS = { task: 50, gold: 20, xp: 20, rest: 10 } as const
// Ten visual sectors proportional to the real weights: 5 task, 2 gold, 2 xp, 1 rest.
export const WHEEL_SECTORS: ReadonlyArray<WheelOutcome> = [
  'task', 'task', 'task', 'task', 'task',
  'gold', 'gold',
  'xp', 'xp',
  'rest',
]
export const WHEEL_GOLD = 20
export const WHEEL_XP = 25
export const WHEEL_REST_XP = 5
/** Pending goals weigh this many times more than completed ones in task selection. */
export const WHEEL_PENDING_WEIGHT = 4
