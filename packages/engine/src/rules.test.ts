import { describe, expect, it } from 'vitest';

import {
  balance,
  computeDamage,
  computeDeathPenalty,
  computeRewards,
  difficultyBudget,
  getProfile,
  profiles,
  xpToNext,
} from './rules';

describe('computeRewards', () => {
  it('matches GDD Appendix A for an Enemy at difficulty 1', () => {
    expect(computeRewards('enemy', 1, 0)).toEqual({ gold: 12, xp: 10, dropChance: 0.1 });
  });

  it('doubles gold and XP for an Elite', () => {
    expect(computeRewards('elite', 1, 0)).toEqual({ gold: 24, xp: 20, dropChance: 0.35 });
    expect(computeRewards('elite', 3, 0)).toEqual({ gold: 32, xp: 60, dropChance: 0.35 });
  });

  it('pays the fixed Boss loot', () => {
    expect(computeRewards('boss', 4, 0)).toEqual({ gold: 75, xp: 120, dropChance: 1 });
  });

  it('grants no gold, XP or drop from non-combat nodes', () => {
    for (const node of ['event', 'shop', 'rest'] as const) {
      expect(computeRewards(node, 3, 10)).toEqual({ gold: 0, xp: 0, dropChance: 0 });
    }
  });

  it('applies the streak multiplier to gold only', () => {
    expect(computeRewards('enemy', 1, 5).gold).toBe(13); // 12 × 1.10 = 13.2
    expect(computeRewards('enemy', 1, 5).xp).toBe(10);
  });

  it('caps the streak multiplier at 1.30', () => {
    expect(computeRewards('enemy', 1, 15).gold).toBe(16);
    expect(computeRewards('enemy', 1, 100).gold).toBe(16);
    expect(computeRewards('enemy', 1, 100)).toEqual(computeRewards('enemy', 1, 15));
  });

  it('treats negative streaks as zero', () => {
    expect(computeRewards('enemy', 1, -7)).toEqual(computeRewards('enemy', 1, 0));
  });
});

describe('computeDamage', () => {
  it('follows 12 + 3 × difficulty for Enemies', () => {
    expect(computeDamage('enemy', 1)).toBe(15);
    expect(computeDamage('enemy', 5)).toBe(27);
  });

  it('multiplies Elite damage by 1.5 and fixes Boss damage at 40', () => {
    expect(computeDamage('elite', 1)).toBe(23);
    expect(computeDamage('elite', 3)).toBe(32);
    expect(computeDamage('boss', 5)).toBe(40);
  });

  it('applies damage reduction and caps it at 25 %', () => {
    expect(computeDamage('enemy', 1, { damageReductionPct: 10 })).toBe(14);
    expect(computeDamage('enemy', 1, { damageReductionPct: 50 })).toBe(11);
  });

  it('never returns negative damage', () => {
    expect(computeDamage('enemy', 1, { damageReductionPct: 9_999 })).toBe(11);
    expect(computeDamage('event', 1)).toBe(0);
  });
});

describe('computeDeathPenalty', () => {
  it('loses 50 % of gold by default', () => {
    expect(computeDeathPenalty(1000, {})).toEqual({ goldLost: 500 });
  });

  it('reduces the loss by 2 pp per stat level', () => {
    expect(computeDeathPenalty(1000, { disciplineLevel: 5 })).toEqual({ goldLost: 400 });
  });

  it('enforces the 25 % minimum loss', () => {
    expect(computeDeathPenalty(1000, { disciplineLevel: 20 })).toEqual({ goldLost: 250 });
    expect(computeDeathPenalty(1000, { disciplineLevel: 100 })).toEqual({ goldLost: 250 });
  });

  it('never loses more gold than the player holds', () => {
    expect(computeDeathPenalty(10, {})).toEqual({ goldLost: 5 });
    expect(computeDeathPenalty(0, {})).toEqual({ goldLost: 0 });
  });
});

describe('xpToNext', () => {
  it('follows round(100 × n^1.35)', () => {
    expect(xpToNext(1)).toBe(100);
    expect(xpToNext(2)).toBe(255);
    expect(xpToNext(3)).toBe(441);
    expect(xpToNext(10)).toBe(2239);
  });

  it('rejects levels below 1', () => {
    expect(() => xpToNext(0)).toThrow(RangeError);
    expect(() => xpToNext(-1)).toThrow(RangeError);
  });
});

describe('difficultyBudget', () => {
  it('starts at 2.0 for a level-1 player with no success history', () => {
    expect(difficultyBudget(1, 0)).toBe(2);
    expect(difficultyBudget(1, 0.5)).toBe(2);
    expect(difficultyBudget(1, 1)).toBe(2.3);
  });

  it('adds +0.3 for a 7-day success rate of at least 80 %', () => {
    expect(difficultyBudget(10, 1)).toBe(3.2);
    expect(difficultyBudget(5, 0.81)).toBe(2.7);
  });

  it('subtracts 0.3 for a success rate of at most 40 %', () => {
    expect(difficultyBudget(5, 0.4)).toBe(2.1);
    expect(difficultyBudget(10, 0.5)).toBe(2.9);
  });

  it('clamps to [2.0, 4.4]', () => {
    expect(difficultyBudget(40, 0)).toBe(4.4);
  });
});

describe('balance and profiles', () => {
  it('exposes the canonical GDD numbers as data', () => {
    expect(balance.rewards.enemyBaseGold).toBe(10);
    expect(balance.damage.perDifficulty).toBe(3);
    expect(balance.death.baseLossPct).toBe(0.5);
    expect(balance.mapDistribution.event).toBe(0.125);
  });

  it('ships the reduced M0 profile', () => {
    const m0 = getProfile('m0');
    expect(m0.nodeTypeSet).toEqual(['enemy', 'elite']);
    expect(m0.rows).toBe(8);
    expect(m0.guarantees.bossOnClosingDay).toBe(false);
    expect(m0.guarantees.restAtLeast).toBe(0);
    expect(m0.guarantees.shopAtLeast).toBe(0);
  });

  it('ships the full profile with Rest, Shop and Boss guarantees', () => {
    const full = getProfile('full');
    expect(full.nodeTypeSet).toContain('boss');
    expect(full.guarantees.restAtLeast).toBe(1);
    expect(full.guarantees.shopAtLeast).toBe(1);
    expect(full.guarantees.bossOnClosingDay).toBe(true);
  });

  it('exposes both profiles and rejects unknown ids', () => {
    expect(Object.keys(profiles).sort()).toEqual(['full', 'm0']);
    expect(() => getProfile('nope')).toThrow(RangeError);
  });
});
