/**
 * Frozen public types of the LifeSpire engine (v0.1.0 / M0).
 *
 * Every game formula consumes these structures; map generation and layout are
 * implemented under `./map/*`. Keep them free of platform-specific types.
 */

export const ENGINE_VERSION = '0.1.0';

export type NodeType = 'enemy' | 'elite' | 'event' | 'shop' | 'rest' | 'boss';

export interface MapNode {
  id: string;
  row: number;
  col: number;
  type: NodeType;
  difficulty: number;
  next: string[];
}

export interface MapRow {
  index: number;
  nodeIds: string[];
}

export interface MapData {
  engineVersion: string;
  seed: string;
  profileId: string;
  rows: MapRow[];
  nodes: Record<string, MapNode>;
  startIds: string[];
  closingIds: string[];
}

export interface MapGenInput {
  profileId?: string;
  playerLevel?: number;
  successRate7d?: number;
  streakDays?: number;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export interface MapLayoutNode {
  id: string;
  x: number;
  y: number;
  row: number;
  col: number;
  type: NodeType;
}

export interface MapLayout {
  width: number;
  height: number;
  nodes: MapLayoutNode[];
  edges: Array<{ from: string; to: string }>;
}

export interface Rewards {
  gold: number;
  xp: number;
  dropChance: number;
}

export interface StatSnapshot {
  healthLevel?: number;
  disciplineLevel?: number;
  damageReductionPct?: number;
  goldGainPct?: number;
  xpGainPct?: number;
}

export interface DeathPenalty {
  goldLost: number;
}

export interface Rng {
  next(): number;
  nextInt(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
}

export interface RuleProfile {
  id: string;
  nodeTypeSet: NodeType[];
  weights: Partial<Record<NodeType, number>>;
  rows: number;
  nodesPerRow: [number, number];
  closingRowNodes: [number, number];
  startRowType: NodeType;
  guarantees: {
    reconvergeAtLeastOnce: boolean;
    restAtLeast: number;
    shopAtLeast: number;
    bossOnClosingDay: boolean;
    maxConsecutiveRest: number;
  };
}

/** Gold and XP sources, from GDD Appendix A. */
export interface RewardsTable {
  enemyBaseGold: number;
  goldPerDifficulty: number;
  eliteGoldMultiplier: number;
  bossGold: number;
  enemyXpPerDifficulty: number;
  eliteXpMultiplier: number;
  bossXp: number;
  questXp: number;
}

export interface StreakTable {
  multiplierPerDay: number;
  cap: number;
}

export interface DifficultyTable {
  base: number;
  perLevel: number;
  adjust: number;
  highSuccessThreshold: number;
  lowSuccessThreshold: number;
  min: number;
  max: number;
  rowRamp: number;
  rowMin: number;
  rowMax: number;
}

export interface DamageTable {
  enemyBase: number;
  perDifficulty: number;
  eliteMultiplier: number;
  bossDamage: number;
  maxReductionPct: number;
}

export interface DropsTable {
  enemy: number;
  elite: number;
  boss: number;
  phoenix: number;
}

export interface XpCurveTable {
  base: number;
  exponent: number;
}

export interface DeathTable {
  baseLossPct: number;
  perLevelPct: number;
  minLossPct: number;
}

export type MapDistributionTable = Record<Exclude<NodeType, 'boss'>, number>;

export interface HealingTable {
  restPct: number;
  minorPotionHp: number;
  greaterPotionHp: number;
}

export interface PriceRange {
  min: number;
  max: number;
}

export interface PricesTable {
  commonConsumable: PriceRange;
  rareConsumable: PriceRange;
  vouchers: {
    common: number;
    rare: number;
    epic: number;
  };
}

export interface BalanceTables {
  rewards: RewardsTable;
  streak: StreakTable;
  difficulty: DifficultyTable;
  damage: DamageTable;
  drops: DropsTable;
  xpCurve: XpCurveTable;
  skillXpCurve: XpCurveTable;
  death: DeathTable;
  mapDistribution: MapDistributionTable;
  healing: HealingTable;
  prices: PricesTable;
}
