import { ALL_OBJECTIVES_BONUS } from '@lifespire/core'
import type { LootItem, RunSummary } from '@lifespire/core'

export interface ObjectiveAggregate {
  total: number
  met: number
  progress: number
  target: number
  bonusXp: number
  bonusGold: number
  lootCount: number
}

const EMPTY_AGGREGATE: ObjectiveAggregate = {
  total: 0,
  met: 0,
  progress: 0,
  target: 0,
  bonusXp: 0,
  bonusGold: 0,
  lootCount: 0,
}

/** Read-only roll-up of the persisted weekly objectives for the summary. */
export function objectiveAggregate(
  objectives: RunSummary['objectives'],
): ObjectiveAggregate {
  return objectives.reduce<ObjectiveAggregate>(
    (total, objective) => ({
      ...total,
      total: total.total + 1,
      met: total.met + (objective.met ? 1 : 0),
      progress: total.progress + Math.min(objective.progress, objective.target),
      target: total.target + objective.target,
      bonusXp: total.bonusXp + objective.bonusXp,
      bonusGold: total.bonusGold + objective.bonusGold,
      lootCount: total.lootCount + objective.loot.length,
    }),
    EMPTY_AGGREGATE,
  )
}

/** Bonus line under one weekly target. The loot roll is always part of the bonus. */
export function objectiveBonusCopy(
  objective: Pick<
    RunSummary['objectives'][number],
    'met' | 'bonusXp' | 'bonusGold'
  >,
): string {
  if (!objective.met) return 'Not kept · no bonus'
  return `Kept · +${objective.bonusXp} XP · +${objective.bonusGold} gold · 1 loot roll`
}

/** All-aims bonus line, including the exact guaranteed-rare promise. */
export function allAimsBonusCopy(allComplete: boolean): string {
  if (!allComplete) return 'Not granted · every weekly target must be kept'
  return `+${ALL_OBJECTIVES_BONUS.xp} XP · +${ALL_OBJECTIVES_BONUS.gold} gold · one guaranteed rare`
}

/** Total weekly bonus, including duplicate conversions folded into the gold. */
export function weeklyBonusTotalCopy(
  summary: Pick<RunSummary, 'bonusXp' | 'bonusGold' | 'duplicateGold'>,
): string {
  const base = `+${summary.bonusXp} XP · +${summary.bonusGold} gold`
  if (summary.duplicateGold <= 0) return base
  return `${base} (includes ${summary.duplicateGold} gold from duplicates)`
}

/** What happened to the guaranteed rare, without implying it was lost. */
export function guaranteedRareCopy(allComplete: boolean, rare: LootItem | null): string {
  if (!allComplete) {
    return 'A guaranteed rare is granted only when every weekly target is kept.'
  }
  if (rare) return `Guaranteed rare · ${rare.name}`
  return 'The guaranteed rare duplicated a relic already found or owned, so it became gold.'
}

/** Duplicate explanation shared by the weekly loot and gold blocks. */
export function duplicateGoldCopy(amount: number): string {
  if (amount <= 0) return 'No duplicate relics were converted this week.'
  return `${amount} gold came from duplicate relics. It is already included in the totals above.`
}
