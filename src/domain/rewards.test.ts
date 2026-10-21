import { describe, expect, it } from 'vitest'
import { BOSS_CLOSING_BONUS, EFFORT_MULTIPLIER, REWARDS } from './balance'
import { rewardsForNode } from './rewards'
import type { Effort, NodeRewards, NodeType } from './types'

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
