import { balance, profiles } from '../rules';
import type { MapData, MapGenInput, MapNode, ValidationResult } from '../types';

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

function rowRange(
  rowIndex: number,
  lastRowIndex: number,
  profile: (typeof profiles)[string],
): [number, number] {
  if (rowIndex === 0) {
    return [2, 3];
  }
  if (rowIndex === lastRowIndex) {
    return profile.closingRowNodes;
  }
  return profile.nodesPerRow;
}

function collectNextIds(nodes: Record<string, MapNode>): Map<string, string[]> {
  const incoming = new Map<string, string[]>();
  for (const node of Object.values(nodes)) {
    incoming.set(node.id, []);
  }
  for (const node of Object.values(nodes)) {
    for (const targetId of node.next) {
      const list = incoming.get(targetId);
      if (list && !list.includes(node.id)) {
        list.push(node.id);
      }
    }
  }
  return incoming;
}

function reachableFromStart(map: MapData): Set<string> {
  const visited = new Set<string>();
  const queue = [...map.startIds];
  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined || visited.has(id)) {
      continue;
    }
    const node = map.nodes[id];
    if (!node) {
      continue;
    }
    visited.add(id);
    for (const nextId of node.next) {
      if (!visited.has(nextId)) {
        queue.push(nextId);
      }
    }
  }
  return visited;
}

function reachesClosing(map: MapData): Set<string> {
  const canReach = new Set<string>(map.closingIds);
  const queue = [...map.closingIds];
  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined) {
      continue;
    }
    for (const node of Object.values(map.nodes)) {
      if (!canReach.has(node.id) && node.next.includes(id)) {
        canReach.add(node.id);
        queue.push(node.id);
      }
    }
  }
  return canReach;
}

function maxRestChain(map: MapData): number {
  const trailing = new Map<string, number>();
  let worst = 0;

  for (const row of map.rows) {
    for (const id of row.nodeIds) {
      const node = map.nodes[id];
      if (!node) {
        continue;
      }
      let predecessorMax = 0;
      for (const predecessor of Object.values(map.nodes)) {
        if (predecessor.row === node.row - 1 && predecessor.next.includes(node.id)) {
          predecessorMax = Math.max(predecessorMax, trailing.get(predecessor.id) ?? 0);
        }
      }
      const value = node.type === 'rest' ? predecessorMax + 1 : 0;
      trailing.set(node.id, value);
      worst = Math.max(worst, value);
    }
  }

  return worst;
}

/**
 * Structural validator for a generated map (GDD §5.2, ADR-016).
 *
 * It never mutates the map and returns every problem it can find, so the API
 * and the generator share a single source of truth for the invariants. The
 * profile comes from `input.profileId`, falling back to `map.profileId`.
 */
export function validateMap(map: MapData, input: MapGenInput = {}): ValidationResult {
  const errors: string[] = [];
  const profileId = input.profileId ?? map.profileId;
  const profile = profiles[profileId];

  if (!profile) {
    return { ok: false, errors: [`unknown rule profile: ${profileId}`] };
  }
  if (map.profileId !== profile.id) {
    errors.push(`map profileId "${map.profileId}" does not match profile "${profile.id}"`);
  }

  const lastRowIndex = profile.rows - 1;
  if (map.rows.length !== profile.rows) {
    errors.push(`expected ${profile.rows} rows, found ${map.rows.length}`);
  }
  if (map.nodes && map.rows.length > 0) {
    const expectedNodes = map.rows.reduce((sum, row) => sum + row.nodeIds.length, 0);
    const actualNodes = Object.keys(map.nodes).length;
    if (actualNodes !== expectedNodes) {
      errors.push(`expected ${expectedNodes} nodes in rows, found ${actualNodes}`);
    }
  }

  const seenIds = new Set<string>();
  const orderedIds: string[] = [];

  map.rows.forEach((row, rowIndex) => {
    if (row.index !== rowIndex) {
      errors.push(`row ${rowIndex} has index ${row.index}`);
    }
    const [min, max] = rowRange(rowIndex, lastRowIndex, profile);
    if (row.nodeIds.length < min || row.nodeIds.length > max) {
      errors.push(`row ${rowIndex} must have ${min}-${max} nodes, found ${row.nodeIds.length}`);
    }

    row.nodeIds.forEach((id, col) => {
      orderedIds.push(id);
      if (seenIds.has(id)) {
        errors.push(`duplicate node id: ${id}`);
      }
      seenIds.add(id);

      const node = map.nodes[id];
      if (!node) {
        errors.push(`row ${rowIndex} references missing node ${id}`);
        return;
      }
      if (node.id !== id) {
        errors.push(`node map key ${id} does not match node id ${node.id}`);
      }
      if (node.row !== rowIndex) {
        errors.push(`node ${id} has row ${node.row}, expected ${rowIndex}`);
      }
      if (node.col !== col) {
        errors.push(`node ${id} has col ${node.col}, expected ${col}`);
      }
      if (!profile.nodeTypeSet.includes(node.type)) {
        errors.push(`node ${id} has type "${node.type}" outside the profile nodeTypeSet`);
      }
      if (!Number.isFinite(node.difficulty)) {
        errors.push(`node ${id} has a non-finite difficulty`);
      } else if (
        node.difficulty < balance.difficulty.min ||
        node.difficulty > balance.difficulty.max
      ) {
        errors.push(
          `node ${id} difficulty ${node.difficulty} is outside [${balance.difficulty.min}, ${balance.difficulty.max}]`,
        );
      }
    });
  });

  for (const id of Object.keys(map.nodes)) {
    if (!seenIds.has(id)) {
      errors.push(`node ${id} is not referenced by any row`);
    }
  }

  const firstRow = map.rows[0];
  if (firstRow) {
    for (const id of firstRow.nodeIds) {
      const node = map.nodes[id];
      if (node && node.type !== profile.startRowType) {
        errors.push(`start node ${id} must be "${profile.startRowType}", found "${node.type}"`);
      }
    }
  }

  if (!arraysEqual(map.startIds, firstRow?.nodeIds ?? [])) {
    errors.push('startIds must match the first row nodeIds in order');
  }
  const lastRow = map.rows[lastRowIndex];
  if (!arraysEqual(map.closingIds, lastRow?.nodeIds ?? [])) {
    errors.push('closingIds must match the last row nodeIds in order');
  }

  // Edge shape: 1-2 successors from every non-closing node, only into the next row.
  map.rows.forEach((row, rowIndex) => {
    const isClosing = rowIndex === lastRowIndex;
    for (const id of row.nodeIds) {
      const node = map.nodes[id];
      if (!node) {
        continue;
      }
      if (isClosing) {
        if (node.next.length > 0) {
          errors.push(`closing node ${id} must not have outgoing edges`);
        }
        continue;
      }
      if (node.next.length < 1 || node.next.length > 2) {
        errors.push(`node ${id} must have 1-2 outgoing edges, found ${node.next.length}`);
      }
      if (new Set(node.next).size !== node.next.length) {
        errors.push(`node ${id} has duplicate outgoing edges`);
      }
      for (const targetId of node.next) {
        const target = map.nodes[targetId];
        if (!target) {
          errors.push(`node ${id} points to missing node ${targetId}`);
        } else if (target.row !== rowIndex + 1) {
          errors.push(`node ${id} points to ${targetId}, which is not in row ${rowIndex + 1}`);
        }
      }
    }
  });

  // No orphans: every node after the start row needs at least one predecessor.
  const incoming = collectNextIds(map.nodes);
  map.rows.forEach((row, rowIndex) => {
    if (rowIndex === 0) {
      return;
    }
    for (const id of row.nodeIds) {
      if ((incoming.get(id) ?? []).length === 0) {
        errors.push(`node ${id} has no incoming edge (orphan)`);
      }
    }
  });

  // Full connectivity from the start and towards the closing row.
  const reachable = reachableFromStart(map);
  for (const id of orderedIds) {
    if (!reachable.has(id)) {
      errors.push(`node ${id} is not reachable from the start row`);
    }
  }
  const closingReachable = reachesClosing(map);
  for (const id of orderedIds) {
    if (!closingReachable.has(id)) {
      errors.push(`node ${id} cannot reach the closing row`);
    }
  }

  if (profile.guarantees.reconvergeAtLeastOnce && map.rows.length >= 4) {
    let reconverges = false;
    for (let rowIndex = 2; rowIndex < map.rows.length - 1 && !reconverges; rowIndex += 1) {
      const row = map.rows[rowIndex];
      for (const id of row?.nodeIds ?? []) {
        if ((incoming.get(id) ?? []).length >= 2) {
          reconverges = true;
          break;
        }
      }
    }
    if (!reconverges) {
      errors.push('map never reconverges: no node in rows 3..n-1 has two incoming edges');
    }
  }

  const restCount = Object.values(map.nodes).filter((node) => node.type === 'rest').length;
  if (restCount < profile.guarantees.restAtLeast) {
    errors.push(
      `expected at least ${profile.guarantees.restAtLeast} Rest nodes, found ${restCount}`,
    );
  }
  const shopCount = Object.values(map.nodes).filter((node) => node.type === 'shop').length;
  if (shopCount < profile.guarantees.shopAtLeast) {
    errors.push(
      `expected at least ${profile.guarantees.shopAtLeast} Shop nodes, found ${shopCount}`,
    );
  }

  const restChain = maxRestChain(map);
  if (restChain > profile.guarantees.maxConsecutiveRest) {
    errors.push(
      `a path has ${restChain} consecutive Rest nodes; maximum is ${profile.guarantees.maxConsecutiveRest}`,
    );
  }

  const bossNodes = Object.values(map.nodes).filter((node) => node.type === 'boss');
  if (profile.guarantees.bossOnClosingDay) {
    if (!lastRow || lastRow.nodeIds.length !== 1) {
      errors.push('the closing row must contain exactly one Boss node');
    }
    const closingBosses = (lastRow?.nodeIds ?? []).filter((id) => map.nodes[id]?.type === 'boss');
    if (closingBosses.length !== 1) {
      errors.push('the closing row must end with a Boss node');
    }
  }
  const misplacedBosses = bossNodes.filter((node) => {
    const allowed = profile.guarantees.bossOnClosingDay && node.row === lastRowIndex;
    return !allowed;
  });
  for (const node of misplacedBosses) {
    errors.push(`boss node ${node.id} is not allowed on row ${node.row}`);
  }

  return { ok: errors.length === 0, errors };
}
