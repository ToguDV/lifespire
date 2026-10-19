import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { deriveDailySeed } from '../seed';
import { ENGINE_VERSION } from '../types';
import type { MapData } from '../types';
import golden from './__fixtures__/golden-m0.json';
import { generateMap } from './generate';
import { validateMap } from './validate';

const SALT = '00'.repeat(32);
const DAY_KEY = '2026-10-18';
const SEED = deriveDailySeed(SALT, DAY_KEY, ENGINE_VERSION);

function allNodes(map: MapData) {
  return Object.values(map.nodes);
}

function incomingCount(map: MapData, nodeId: string): number {
  return allNodes(map).filter((node) => node.next.includes(nodeId)).length;
}

describe('generateMap', () => {
  it('matches the frozen M0 golden map', () => {
    const map = generateMap(SEED, { profileId: 'm0' });
    expect(map).toEqual(golden);
    expect(map.engineVersion).toBe(ENGINE_VERSION);
    expect(map.seed).toBe(SEED);
    expect(map.profileId).toBe('m0');
  });

  it('is deterministic for the same seed', () => {
    const first = generateMap(SEED, { profileId: 'm0' });
    const second = generateMap(SEED, { profileId: 'm0' });
    expect(second).toEqual(first);
  });

  it('changes the map when the day key changes', () => {
    const otherSeed = deriveDailySeed(SALT, '2026-10-19', ENGINE_VERSION);
    expect(generateMap(otherSeed, { profileId: 'm0' })).not.toEqual(
      generateMap(SEED, { profileId: 'm0' }),
    );
  });

  it('uses 1-indexed rows in ids and 0-indexed rows in the structures', () => {
    const map = generateMap(SEED, { profileId: 'm0' });
    expect(map.startIds).toEqual(['n-1-0', 'n-1-1']);
    for (const row of map.rows) {
      for (const id of row.nodeIds) {
        const node = map.nodes[id];
        expect(id).toBe(`n-${node!.row + 1}-${node!.col}`);
      }
    }
  });

  it('rejects an unknown profile and an empty seed', () => {
    expect(() => generateMap(SEED, { profileId: 'nope' })).toThrow(RangeError);
    expect(() => generateMap('', { profileId: 'm0' })).toThrow(RangeError);
  });

  it('generates valid M0 maps for random seeds (no orphans, valid difficulty, enemy start)', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 64 }), (seed) => {
        const map = generateMap(seed, { profileId: 'm0' });
        const validation = validateMap(map, { profileId: 'm0' });
        expect(validation.errors).toEqual([]);

        for (const node of allNodes(map)) {
          expect(node.difficulty).toBeGreaterThanOrEqual(1);
          expect(node.difficulty).toBeLessThanOrEqual(5);
          if (node.row > 0) {
            expect(incomingCount(map, node.id)).toBeGreaterThanOrEqual(1);
          }
        }
        for (const id of map.startIds) {
          expect(map.nodes[id]!.type).toBe('enemy');
        }
      }),
      { numRuns: 150 },
    );
  });

  it('generates valid full-profile maps with Rest, Shop and Boss guarantees', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 64 }), (seed) => {
        const map = generateMap(seed, { profileId: 'full' });
        const validation = validateMap(map, { profileId: 'full' });
        expect(validation.errors).toEqual([]);

        const types = allNodes(map).map((node) => node.type);
        expect(types.filter((type) => type === 'rest').length).toBeGreaterThanOrEqual(1);
        expect(types.filter((type) => type === 'shop').length).toBeGreaterThanOrEqual(1);
        expect(map.closingIds).toHaveLength(1);
        expect(map.nodes[map.closingIds[0]!]!.type).toBe('boss');
      }),
      { numRuns: 150 },
    );
  });
});
