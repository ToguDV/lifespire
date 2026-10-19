import balanceJson from '../balance/balance.json';
import profilesJson from '../balance/profiles.json';
import type {
  BalanceTables,
  DeathPenalty,
  NodeType,
  Rewards,
  RuleProfile,
  StatSnapshot,
} from './types';

/**
 * Canonical balance data (GDD Appendix A). Numbers live only in
 * `balance/*.json`; this module just reads and applies them.
 */
export const balance = balanceJson as BalanceTables;

const profileEntries = Object.entries(profilesJson).filter(([id]) => !id.startsWith('$'));

/** Rule profiles that parameterize map generation (ADR-016). */
export const profiles = Object.fromEntries(profileEntries) as Record<string, RuleProfile>;

export function getProfile(id: string): RuleProfile {
  const profile = profiles[id];
  if (!profile) {
    throw new RangeError(`unknown rule profile: ${id}`);
  }
  return profile;
}

function streakMultiplier(streakDays: number): number {
  const days = Math.max(0, streakDays);
  const raw = 1 + balance.streak.multiplierPerDay * days;
  return Math.min(balance.streak.cap, raw);
}

function dropChanceFor(node: NodeType): number {
  switch (node) {
    case 'enemy':
      return balance.drops.enemy;
    case 'elite':
      return balance.drops.elite;
    case 'boss':
      return balance.drops.boss;
    default:
      return 0;
  }
}

/**
 * Gold, XP and drop chance for resolving a node.
 *
 * Enemy = `10 + 2 × d` gold and `10 × d` XP; Elite doubles both; Boss pays 75
 * gold and 120 XP. The streak multiplier applies to gold only, capped at 1.30.
 */
export function computeRewards(node: NodeType, difficulty: number, streakDays = 0): Rewards {
  const rewards = balance.rewards;
  let gold = 0;
  let xp = 0;

  switch (node) {
    case 'enemy':
      gold = rewards.enemyBaseGold + rewards.goldPerDifficulty * difficulty;
      xp = rewards.enemyXpPerDifficulty * difficulty;
      break;
    case 'elite':
      gold =
        (rewards.enemyBaseGold + rewards.goldPerDifficulty * difficulty) *
        rewards.eliteGoldMultiplier;
      xp = rewards.enemyXpPerDifficulty * difficulty * rewards.eliteXpMultiplier;
      break;
    case 'boss':
      gold = rewards.bossGold;
      xp = rewards.bossXp;
      break;
    case 'event':
    case 'shop':
    case 'rest':
      break;
  }

  return {
    gold: Math.round(gold * streakMultiplier(streakDays)),
    xp: Math.round(xp),
    dropChance: dropChanceFor(node),
  };
}

/**
 * Damage taken when failing a node: `12 + 3 × d`, Elite ×1.5 and Boss 40.
 * `damageReductionPct` is capped at 25 %; the result is never negative.
 */
export function computeDamage(node: NodeType, difficulty: number, stats?: StatSnapshot): number {
  const damage = balance.damage;
  let base = 0;

  switch (node) {
    case 'enemy':
      base = damage.enemyBase + damage.perDifficulty * difficulty;
      break;
    case 'elite':
      base = (damage.enemyBase + damage.perDifficulty * difficulty) * damage.eliteMultiplier;
      break;
    case 'boss':
      base = damage.bossDamage;
      break;
    case 'event':
    case 'shop':
    case 'rest':
      break;
  }

  const reductionPct = Math.min(
    damage.maxReductionPct,
    Math.max(0, stats?.damageReductionPct ?? 0),
  );
  return Math.max(0, Math.round(base * (1 - reductionPct / 100)));
}

/**
 * Gold lost on death: `max(25 %, 50 % − 2 % × disciplineLevel)`, rounded down
 * and never greater than the gold held (GDD §8.3, Appendix A.2).
 */
export function computeDeathPenalty(gold: number, stats?: StatSnapshot): DeathPenalty {
  const death = balance.death;
  const level = Math.max(0, stats?.disciplineLevel ?? 0);
  const lossPct = Math.min(
    death.baseLossPct,
    Math.max(death.minLossPct, death.baseLossPct - death.perLevelPct * level),
  );
  const held = Math.max(0, gold);
  const goldLost = Math.min(held, Math.floor(held * lossPct + 1e-9));
  return { goldLost };
}

/** XP required to go from `level` to `level + 1`: `round(100 × n^1.35)`. */
export function xpToNext(level: number): number {
  if (!Number.isFinite(level) || level < 1) {
    throw new RangeError('level must be a finite number >= 1');
  }
  return Math.round(balance.xpCurve.base * level ** balance.xpCurve.exponent);
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Adaptive difficulty budget (GDD §5.4). `successRate7d` is a 0–1 ratio:
 * ≥ 0.8 adds +0.3, ≤ 0.4 subtracts 0.3, and the result is clamped to [2, 4.4].
 */
export function difficultyBudget(playerLevel: number, successRate7d: number): number {
  if (!Number.isFinite(playerLevel)) {
    throw new RangeError('playerLevel must be a finite number');
  }
  if (!Number.isFinite(successRate7d)) {
    throw new RangeError('successRate7d must be a finite number');
  }

  const difficulty = balance.difficulty;
  const level = Math.max(1, playerLevel);
  const rate = Math.min(1, Math.max(0, successRate7d));

  let adjust = 0;
  if (rate >= difficulty.highSuccessThreshold) {
    adjust = difficulty.adjust;
  } else if (rate <= difficulty.lowSuccessThreshold) {
    adjust = -difficulty.adjust;
  }

  const raw = difficulty.base + difficulty.perLevel * (level - 1) + adjust;
  return roundToTwoDecimals(Math.min(difficulty.max, Math.max(difficulty.min, raw)));
}
