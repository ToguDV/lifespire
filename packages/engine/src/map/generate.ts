import { createRng } from '../rng';
import { balance, difficultyBudget, getProfile } from '../rules';
import type { MapData, MapGenInput, MapNode, MapRow, NodeType, Rng, RuleProfile } from '../types';
import { ENGINE_VERSION } from '../types';
import { validateMap } from './validate';

/** Upper bound of deterministic attempts before returning the best candidate. */
const MAX_ATTEMPTS = 50;

/** Probability of adding an optional second edge from a node. */
const EXTRA_EDGE_CHANCE = 0.5;

/** Internal failure of a single attempt; the caller retries with a new seed. */
class GenerationError extends Error {}

interface GenerationOptions {
  profile: RuleProfile;
  playerLevel: number;
  successRate7d: number;
}

function nextInRange(rng: Rng, min: number, max: number): number {
  return min + rng.nextInt(max - min + 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function nodeId(rowIndex: number, col: number): string {
  // Rows are 1-indexed in ids (GDD convention) and 0-indexed in the structures.
  return `n-${rowIndex + 1}-${col}`;
}

function createRow(rowIndex: number, count: number): MapNode[] {
  const row: MapNode[] = [];
  for (let col = 0; col < count; col += 1) {
    row.push({
      id: nodeId(rowIndex, col),
      row: rowIndex,
      col,
      type: 'enemy',
      difficulty: 0,
      next: [],
    });
  }
  return row;
}

function addEdge(from: MapNode, to: MapNode): void {
  if (!from.next.includes(to.id)) {
    from.next.push(to.id);
  }
}

/**
 * Connects two consecutive rows.
 *
 * Every node in the next row receives at least one predecessor (coverage pass),
 * every current node emits at least one edge, and a second edge is added
 * probabilistically preferring columns `col - 1 .. col + 1` so the drawing does
 * not cross more than necessary.
 */
function connectRows(current: MapNode[], next: MapNode[], rng: Rng): void {
  if (next.length === 1) {
    const target = next[0];
    if (!target) {
      return;
    }
    for (const node of current) {
      addEdge(node, target);
    }
    return;
  }

  const n = current.length;
  const m = next.length;

  // Guarantee an incoming edge for every node of the next row.
  for (let j = 0; j < m; j += 1) {
    const sourceIndex = n === 1 ? 0 : clamp(Math.round((j * (n - 1)) / (m - 1)), 0, n - 1);
    const source = current[sourceIndex];
    const target = next[j];
    if (source && target) {
      addEdge(source, target);
    }
  }

  // Guarantee an outgoing edge for every node of the current row.
  for (let i = 0; i < n; i += 1) {
    const source = current[i];
    if (!source || source.next.length > 0) {
      continue;
    }
    const targetIndex = m === 1 ? 0 : clamp(Math.round((i * (m - 1)) / (n - 1)), 0, m - 1);
    const target = next[targetIndex];
    if (target) {
      addEdge(source, target);
    }
  }

  // Optional second edge, preferring adjacent columns.
  for (let i = 0; i < n; i += 1) {
    const source = current[i];
    if (!source || source.next.length >= 2 || rng.next() >= EXTRA_EDGE_CHANCE) {
      continue;
    }
    const available = next.filter((target) => !source.next.includes(target.id));
    if (available.length === 0) {
      continue;
    }
    const adjacent = available.filter((target) => Math.abs(target.col - source.col) <= 1);
    const pool = adjacent.length > 0 ? adjacent : available;
    const target = rng.pick(pool);
    addEdge(source, target);
  }
}

function computeIndegree(rows: MapNode[][]): Map<string, number> {
  const indegree = new Map<string, number>();
  for (const row of rows) {
    for (const node of row) {
      indegree.set(node.id, 0);
    }
  }
  for (const row of rows) {
    for (const node of row) {
      for (const targetId of node.next) {
        indegree.set(targetId, (indegree.get(targetId) ?? 0) + 1);
      }
    }
  }
  return indegree;
}

/**
 * Forces a reconvergence point (a node with at least two incoming edges) in the
 * rows required by the guarantee, when the random edges did not produce one.
 */
function forceReconvergence(rows: MapNode[][], profile: RuleProfile): void {
  if (!profile.guarantees.reconvergeAtLeastOnce || rows.length < 4) {
    return;
  }

  const indegree = computeIndegree(rows);
  const hasReconvergence = rows
    .slice(2, rows.length - 1)
    .some((row) => row.some((node) => (indegree.get(node.id) ?? 0) >= 2));
  if (hasReconvergence) {
    return;
  }

  for (let rowIndex = 2; rowIndex < rows.length - 1; rowIndex += 1) {
    const current = rows[rowIndex - 1] ?? [];
    const targetRow = rows[rowIndex] ?? [];
    for (const target of targetRow) {
      if ((indegree.get(target.id) ?? 0) < 1) {
        continue;
      }
      for (const source of current) {
        if (source.next.includes(target.id) || source.next.length >= 2) {
          continue;
        }
        addEdge(source, target);
        indegree.set(target.id, (indegree.get(target.id) ?? 0) + 1);
        return;
      }
    }
  }

  throw new GenerationError('could not create a reconvergence point');
}

function maxTrailingRest(rows: MapNode[][]): Map<string, number> {
  const trailing = new Map<string, number>();
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const previous = rowIndex > 0 ? (rows[rowIndex - 1] ?? []) : [];
    for (const node of row) {
      let predecessorMax = 0;
      for (const candidate of previous) {
        if (candidate.next.includes(node.id)) {
          predecessorMax = Math.max(predecessorMax, trailing.get(candidate.id) ?? 0);
        }
      }
      trailing.set(node.id, node.type === 'rest' ? predecessorMax + 1 : 0);
    }
  }
  return trailing;
}

function maxRestChain(rows: MapNode[][]): number {
  let worst = 0;
  for (const value of maxTrailingRest(rows).values()) {
    worst = Math.max(worst, value);
  }
  return worst;
}

function pickWeightedType(
  rng: Rng,
  profile: RuleProfile,
  forbidden: ReadonlySet<NodeType>,
): NodeType {
  const candidates = profile.nodeTypeSet.filter((type) => {
    if (type === 'boss' || forbidden.has(type)) {
      return false;
    }
    return (profile.weights[type] ?? 0) > 0;
  });

  if (candidates.length === 0) {
    throw new GenerationError('no weighted node type available for this row');
  }

  const total = candidates.reduce((sum, type) => sum + (profile.weights[type] ?? 0), 0);
  let roll = rng.next() * total;
  for (const type of candidates) {
    roll -= profile.weights[type] ?? 0;
    if (roll < 0) {
      return type;
    }
  }
  return candidates[candidates.length - 1] as NodeType;
}

function assignTypes(rows: MapNode[][], profile: RuleProfile, rng: Rng): void {
  const lastRow = rows.length - 1;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    if (rowIndex === 0) {
      for (const node of row) {
        node.type = profile.startRowType;
      }
      continue;
    }

    const trailing = maxTrailingRest(rows);
    const previous = rows[rowIndex - 1] ?? [];
    const isClosingRow = rowIndex === lastRow;

    for (const node of row) {
      if (isClosingRow && profile.guarantees.bossOnClosingDay) {
        node.type = 'boss';
        continue;
      }

      let predecessorMax = 0;
      for (const candidate of previous) {
        if (candidate.next.includes(node.id)) {
          predecessorMax = Math.max(predecessorMax, trailing.get(candidate.id) ?? 0);
        }
      }

      const forbidden = new Set<NodeType>();
      if (predecessorMax + 1 > profile.guarantees.maxConsecutiveRest) {
        forbidden.add('rest');
      }

      node.type = pickWeightedType(rng, profile, forbidden);
    }
  }
}

function countType(rows: MapNode[][], type: NodeType): number {
  let count = 0;
  for (const row of rows) {
    for (const node of row) {
      if (node.type === type) {
        count += 1;
      }
    }
  }
  return count;
}

/**
 * Ensures the Rest/Shop minimums by converting eligible nodes (never the start
 * row, the closing row, or another guaranteed type). Rest conversions are only
 * accepted when the `maxConsecutiveRest` rule still holds.
 */
function enforceGuarantees(rows: MapNode[][], profile: RuleProfile): void {
  const lastRow = rows.length - 1;
  const eligible = rows.slice(1, lastRow).flat();
  const targets: Array<{ type: NodeType; atLeast: number }> = [
    { type: 'rest', atLeast: profile.guarantees.restAtLeast },
    { type: 'shop', atLeast: profile.guarantees.shopAtLeast },
  ];

  for (const { type, atLeast } of targets) {
    while (countType(rows, type) < atLeast) {
      let converted = false;
      for (const node of eligible) {
        if (node.type === 'rest' || node.type === 'shop' || node.type === 'boss') {
          continue;
        }
        const previousType = node.type;
        node.type = type;
        if (type === 'rest' && maxRestChain(rows) > profile.guarantees.maxConsecutiveRest) {
          node.type = previousType;
          continue;
        }
        converted = true;
        break;
      }
      if (!converted) {
        throw new GenerationError(`could not place a reachable ${type} node`);
      }
    }
  }
}

function assignDifficulty(rows: MapNode[][], options: GenerationOptions): void {
  const budget = difficultyBudget(options.playerLevel, options.successRate7d);
  const table = balance.difficulty;

  for (const row of rows) {
    for (const node of row) {
      const raw = budget + table.rowRamp * node.row;
      node.difficulty = clamp(Math.round(raw), table.min, table.max);
    }
  }
}

function toMapData(rows: MapNode[][], seed: string, profile: RuleProfile): MapData {
  const mapRows: MapRow[] = rows.map((row, index) => ({
    index,
    nodeIds: row.map((node) => node.id),
  }));

  const nodes: Record<string, MapNode> = {};
  for (const row of rows) {
    for (const node of row) {
      nodes[node.id] = node;
    }
  }

  return {
    engineVersion: ENGINE_VERSION,
    seed,
    profileId: profile.id,
    rows: mapRows,
    nodes,
    startIds: rows[0]?.map((node) => node.id) ?? [],
    closingIds: rows[rows.length - 1]?.map((node) => node.id) ?? [],
  };
}

function generateCandidate(
  attemptSeed: string,
  originalSeed: string,
  options: GenerationOptions,
): MapData {
  const { profile } = options;
  const rng = createRng(attemptSeed);

  const rows: MapNode[][] = [];
  const startCount = nextInRange(rng, 2, 3);
  rows.push(createRow(0, startCount));

  for (let rowIndex = 1; rowIndex < profile.rows - 1; rowIndex += 1) {
    const [min, max] = profile.nodesPerRow;
    rows.push(createRow(rowIndex, nextInRange(rng, min, max)));
  }

  const closingCount = profile.guarantees.bossOnClosingDay
    ? 1
    : nextInRange(rng, profile.closingRowNodes[0], profile.closingRowNodes[1]);
  rows.push(createRow(profile.rows - 1, closingCount));

  for (let rowIndex = 0; rowIndex < rows.length - 1; rowIndex += 1) {
    connectRows(rows[rowIndex] ?? [], rows[rowIndex + 1] ?? [], rng);
  }

  forceReconvergence(rows, profile);
  assignTypes(rows, profile, rng);
  enforceGuarantees(rows, profile);
  assignDifficulty(rows, options);

  return toMapData(rows, originalSeed, profile);
}

/**
 * Generates the daily map for a rule profile.
 *
 * The whole shape (row sizes, weighted node types, edges, guarantees and
 * difficulty) is a pure function of `seed` and `input`. Invalid attempts are
 * retried with deterministic child seeds; if none of the 50 attempts satisfies
 * every guarantee, the candidate with the fewest validation errors is returned
 * so `validateMap` can report the failure instead of throwing.
 */
export function generateMap(seed: string, input: MapGenInput = {}): MapData {
  if (seed.length === 0) {
    throw new RangeError('seed must not be empty');
  }

  const profile = getProfile(input.profileId ?? 'm0');
  const options: GenerationOptions = {
    profile,
    playerLevel: input.playerLevel ?? 1,
    successRate7d: input.successRate7d ?? 0,
  };

  const retryRng = createRng(`${seed}:map-retry`);
  let best: MapData | null = null;
  let bestErrorCount = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const attemptSeed =
      attempt === 0 ? seed : `${seed}:retry:${retryRng.nextInt(0x100000000).toString(16)}`;

    let candidate: MapData;
    try {
      candidate = generateCandidate(attemptSeed, seed, options);
    } catch (error) {
      if (error instanceof GenerationError) {
        continue;
      }
      throw error;
    }

    const validation = validateMap(candidate, input);
    if (validation.ok) {
      return candidate;
    }
    if (validation.errors.length < bestErrorCount) {
      best = candidate;
      bestErrorCount = validation.errors.length;
    }
  }

  if (!best) {
    throw new GenerationError('map generation failed before producing a candidate');
  }
  return best;
}
