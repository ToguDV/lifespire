import type { MapData } from '@lifespire/engine';
import type { NodeVisitState } from '@lifespire/shared-types';

import type { ResolvedNodeState } from '../../db/db';

export type NodeStateMap = Record<string, NodeVisitState>;
export type EdgeState = 'idle' | 'active' | 'done';

/**
 * Derive every node's visual state from the local run progress.
 *
 * - No node resolved yet: the start nodes are `available`, everything else is
 *   `locked` (row 1 is always playable).
 * - After a node is resolved, its successors become `available`.
 * - The selected node, when reachable, is `current` (the only glow in the map).
 */
export function deriveNodeStates(
  map: MapData,
  progress: Record<string, ResolvedNodeState>,
  selectedId: string | null,
): NodeStateMap {
  const states: NodeStateMap = {};
  for (const id of Object.keys(map.nodes)) {
    states[id] = 'locked';
  }

  const resolvedIds = Object.keys(progress);
  if (resolvedIds.length === 0) {
    for (const id of map.startIds) {
      states[id] = 'available';
    }
  } else {
    for (const id of resolvedIds) {
      const resolved = progress[id];
      if (resolved) {
        states[id] = resolved;
      }
    }
    for (const id of resolvedIds) {
      const node = map.nodes[id];
      if (!node) {
        continue;
      }
      for (const nextId of node.next) {
        if (!(nextId in progress) && nextId in states) {
          states[nextId] = 'available';
        }
      }
    }
  }

  if (selectedId && states[selectedId] === 'available') {
    states[selectedId] = 'current';
  }

  return states;
}

/** An edge is dimmed behind a resolved node and highlighted toward the frontier. */
export function deriveEdgeState(from: NodeVisitState, to: NodeVisitState): EdgeState {
  if (from === 'visited' || from === 'skipped') {
    return 'done';
  }
  if (to === 'available' || to === 'current' || to === 'visited' || to === 'skipped') {
    return 'active';
  }
  return 'idle';
}

/** Row index (0-based) of the current frontier, used by the `fila X / N` chip. */
export function deriveFrontierRow(map: MapData, states: NodeStateMap): number {
  let frontier = Number.POSITIVE_INFINITY;
  let resolvedMax = -1;

  for (const row of map.rows) {
    for (const id of row.nodeIds) {
      const state = states[id];
      if (state === 'available' || state === 'current') {
        frontier = Math.min(frontier, row.index);
      }
      if (state === 'visited' || state === 'skipped') {
        resolvedMax = Math.max(resolvedMax, row.index);
      }
    }
  }

  if (Number.isFinite(frontier)) {
    return frontier;
  }
  return resolvedMax >= 0 ? resolvedMax : 0;
}

export interface DayCounts {
  resolved: number;
  skipped: number;
  remaining: number;
}

export function countDay(states: NodeStateMap): DayCounts {
  let resolved = 0;
  let skipped = 0;
  let remaining = 0;
  for (const state of Object.values(states)) {
    if (state === 'visited') {
      resolved += 1;
    } else if (state === 'skipped') {
      skipped += 1;
    } else {
      remaining += 1;
    }
  }
  return { resolved, skipped, remaining };
}
