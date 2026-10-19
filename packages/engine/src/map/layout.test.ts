import { describe, expect, it } from 'vitest';

import { deriveDailySeed } from '../seed';
import { ENGINE_VERSION } from '../types';
import type { MapData } from '../types';
import { generateMap } from './generate';
import { layoutMap } from './layout';

function sumEdges(map: MapData): number {
  return Object.values(map.nodes).reduce((sum, node) => sum + node.next.length, 0);
}

describe('layoutMap', () => {
  const seed = deriveDailySeed('00'.repeat(32), '2026-10-18', ENGINE_VERSION);
  const map = generateMap(seed, { profileId: 'm0' });
  const layout = layoutMap(map);

  it('uses the documented viewBox', () => {
    expect(layout.width).toBe(660);
    expect(layout.height).toBe(640);
  });

  it('keeps every node inside the viewBox', () => {
    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(layout.width);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(layout.height);
    }
  });

  it('never gives two nodes the same coordinate', () => {
    const coordinates = layout.nodes.map((node) => `${node.x},${node.y}`);
    expect(new Set(coordinates).size).toBe(coordinates.length);
  });

  it('orders nodes by row and column deterministically', () => {
    const keys = layout.nodes.map((node) => node.row * 100 + node.col);
    expect(keys).toEqual([...keys].sort((left, right) => left - right));
    expect(layoutMap(map)).toEqual(layout);
  });

  it('emits exactly one edge per entry in next', () => {
    expect(layout.edges).toHaveLength(sumEdges(map));
    for (const edge of layout.edges) {
      expect(map.nodes[edge.from]).toBeDefined();
      expect(map.nodes[edge.to]).toBeDefined();
      expect(map.nodes[edge.from]!.next).toContain(edge.to);
    }
  });

  it('places a single closing node centred horizontally', () => {
    expect(map.closingIds).toHaveLength(1);
    const closing = layout.nodes.find((node) => node.id === map.closingIds[0]);
    expect(closing?.x).toBe(330);
    expect(closing?.y).toBe(600);
  });
});
