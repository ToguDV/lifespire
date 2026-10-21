import { describe, expect, it } from 'vitest'
import { ALL_OBJECTIVES_BONUS, OBJECTIVE_BONUS } from '../../domain/balance'
import type { LootItem, RunSummary } from '../../domain/types'
import {
  allAimsBonusCopy,
  duplicateGoldCopy,
  guaranteedRareCopy,
  objectiveAggregate,
  objectiveBonusCopy,
  weeklyBonusTotalCopy,
} from './runSummary'

const at = '2026-10-26T09:00:00.000Z'

const rare: LootItem = {
  id: 'run:7:weekly:all:silverbark-ring',
  catalogId: 'silverbark-ring',
  name: 'Silverbark Ring',
  rarity: 'rare',
  description: 'A ring of pale wood.',
  obtainedAt: at,
}

function objective(
  patch: Partial<RunSummary['objectives'][number]> &
    Pick<RunSummary['objectives'][number], 'goalId' | 'title'>,
): RunSummary['objectives'][number] {
  return {
    target: 4,
    progress: 0,
    met: false,
    bonusXp: 0,
    bonusGold: 0,
    loot: [],
    ...patch,
  }
}

describe('objectiveAggregate', () => {
  it('rolls up zero, partial and all objectives', () => {
    expect(objectiveAggregate([])).toMatchObject({ total: 0, met: 0, progress: 0, target: 0 })

    const partial = objectiveAggregate([
      objective({
        goalId: 'wayfarer',
        title: 'Wayfarer',
        progress: 4,
        met: true,
        bonusXp: OBJECTIVE_BONUS.xp,
        bonusGold: OBJECTIVE_BONUS.gold,
        loot: [rare],
      }),
      objective({ goalId: 'craft', title: 'Craft', target: 3, progress: 1 }),
    ])
    expect(partial).toEqual({
      total: 2,
      met: 1,
      progress: 5,
      target: 7,
      bonusXp: OBJECTIVE_BONUS.xp,
      bonusGold: OBJECTIVE_BONUS.gold,
      lootCount: 1,
    })

    const all = objectiveAggregate([
      objective({
        goalId: 'wayfarer',
        title: 'Wayfarer',
        progress: 4,
        met: true,
        bonusXp: OBJECTIVE_BONUS.xp,
        bonusGold: OBJECTIVE_BONUS.gold,
      }),
      objective({
        goalId: 'craft',
        title: 'Craft',
        target: 3,
        progress: 3,
        met: true,
        bonusXp: OBJECTIVE_BONUS.xp,
        bonusGold: OBJECTIVE_BONUS.gold,
      }),
    ])
    expect(all).toMatchObject({
      total: 2,
      met: 2,
      progress: 7,
      target: 7,
      bonusXp: 2 * OBJECTIVE_BONUS.xp,
      bonusGold: 2 * OBJECTIVE_BONUS.gold,
    })
  })
})

describe('weekly bonus copy', () => {
  it('explains per-aim and all-aim bonuses without hiding forfeits', () => {
    expect(
      objectiveBonusCopy({
        met: true,
        bonusXp: OBJECTIVE_BONUS.xp,
        bonusGold: OBJECTIVE_BONUS.gold,
      }),
    ).toBe('Kept · +50 XP · +50 gold · 1 loot roll')
    expect(
      objectiveBonusCopy({ met: false, bonusXp: 0, bonusGold: 0 }),
    ).toBe('Not kept · no bonus')

    expect(allAimsBonusCopy(true)).toBe(
      `+${ALL_OBJECTIVES_BONUS.xp} XP · +${ALL_OBJECTIVES_BONUS.gold} gold · one guaranteed rare`,
    )
    expect(allAimsBonusCopy(false)).toBe(
      'Not granted · every weekly aim must be kept',
    )
  })

  it('names the duplicate gold inside the total rather than adding it twice', () => {
    expect(
      weeklyBonusTotalCopy({ bonusXp: 200, bonusGold: 215, duplicateGold: 15 }),
    ).toBe('+200 XP · +215 gold (includes 15 gold from duplicates)')
    expect(
      weeklyBonusTotalCopy({ bonusXp: 50, bonusGold: 50, duplicateGold: 0 }),
    ).toBe('+50 XP · +50 gold')
    expect(duplicateGoldCopy(0)).toBe('No duplicate relics were converted this week.')
    expect(duplicateGoldCopy(25)).toContain('25 gold came from duplicate relics')
  })

  it('explains the guaranteed rare when it is kept or converted', () => {
    expect(guaranteedRareCopy(true, rare)).toBe('Guaranteed rare · Silverbark Ring')
    expect(guaranteedRareCopy(true, null)).toContain('became gold')
    expect(guaranteedRareCopy(false, null)).toContain('only when every weekly aim')
  })
})
