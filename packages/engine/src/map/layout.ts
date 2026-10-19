import type { MapData, MapLayout, MapLayoutNode } from '../types';

/** ViewBox used by the web SVG canvas (Xbox-style column/row grid). */
const WIDTH = 660;
const HEIGHT = 640;
const MARGIN = 40;

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Normalizes a map into deterministic SVG coordinates.
 *
 * Columns are evenly distributed across their row and rows are evenly
 * distributed top-to-bottom inside the viewBox margins. Nodes are ordered by
 * row and column, and edges are derived from `next` in that same order, so the
 * result is stable for rendering, tests and snapshots. No DOM is involved.
 */
export function layoutMap(map: MapData): MapLayout {
  const rowCount = map.rows.length;
  const innerWidth = WIDTH - MARGIN * 2;
  const innerHeight = HEIGHT - MARGIN * 2;

  const nodes: MapLayoutNode[] = [];

  map.rows.forEach((row, rowIndex) => {
    const count = row.nodeIds.length;
    const y =
      rowCount <= 1 ? round(HEIGHT / 2) : round(MARGIN + (innerHeight * rowIndex) / (rowCount - 1));

    row.nodeIds.forEach((id, col) => {
      const node = map.nodes[id];
      if (!node) {
        return;
      }
      const x = count <= 1 ? round(WIDTH / 2) : round(MARGIN + (innerWidth * col) / (count - 1));
      nodes.push({
        id: node.id,
        x,
        y,
        row: node.row,
        col: node.col,
        type: node.type,
      });
    });
  });

  const positions = new Map(nodes.map((node) => [node.id, node] as const));
  const edges: MapLayout['edges'] = [];

  for (const node of nodes) {
    const data = map.nodes[node.id];
    if (!data) {
      continue;
    }
    for (const targetId of data.next) {
      if (positions.has(targetId)) {
        edges.push({ from: node.id, to: targetId });
      }
    }
  }

  edges.sort((left, right) => {
    const leftFrom = positions.get(left.from);
    const rightFrom = positions.get(right.from);
    const fromDelta =
      (leftFrom?.row ?? 0) - (rightFrom?.row ?? 0) || (leftFrom?.col ?? 0) - (rightFrom?.col ?? 0);
    if (fromDelta !== 0) {
      return fromDelta;
    }
    const leftTo = positions.get(left.to);
    const rightTo = positions.get(right.to);
    return (leftTo?.row ?? 0) - (rightTo?.row ?? 0) || (leftTo?.col ?? 0) - (rightTo?.col ?? 0);
  });

  return { width: WIDTH, height: HEIGHT, nodes, edges };
}
