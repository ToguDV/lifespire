import { BOSS_CLOSING_BONUS, EFFORT_MULTIPLIER, REWARDS } from './balance'
import type { Effort, NodeRewards, NodeType } from './types'

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
  if (type === 'rest' || type === 'treasure') {
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
