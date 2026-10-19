import { describe, expect, it } from 'vitest';

import { deriveDailySeed } from '../seed';
import { ENGINE_VERSION } from '../types';
import type { MapData } from '../types';
import { generateMap } from './generate';
import { validateMap } from './validate';

const SEED = deriveDailySeed('00'.repeat(32), '2026-10-18', ENGINE_VERSION);

function clone(map: MapData): MapData {
  return JSON.parse(JSON.stringify(map)) as MapData;
}

function errorsOf(map: MapData): string[] {
  return validateMap(map, { profileId: map.profileId }).errors;
}

describe('validateMap', () => {
  it('accepts canonical M0 and full maps', () => {
    expect(validateMap(generateMap(SEED, { profileId: 'm0' }), { profileId: 'm0' })).toEqual({
      ok: true,
      errors: [],
    });
    expect(validateMap(generateMap(SEED, { profileId: 'full' }), { profileId: 'full' })).toEqual({
      ok: true,
      errors: [],
    });
  });

  it('falls back to map.profileId when no input is given', () => {
    const map = generateMap(SEED, { profileId: 'm0' });
    expect(validateMap(map).ok).toBe(true);
  });

  it('reports an unknown profile instead of throwing', () => {
    const result = validateMap(generateMap(SEED, { profileId: 'm0' }), { profileId: 'nope' });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('unknown rule profile');
  });

  it('reports the wrong number of rows', () => {
    const map = clone(generateMap(SEED, { profileId: 'm0' }));
    map.rows.pop();
    expect(errorsOf(map).some((error) => error.includes('expected 8 rows'))).toBe(true);
  });

  it('reports row sizes outside the profile range', () => {
    const map = clone(generateMap(SEED, { profileId: 'm0' }));
    map.rows[0]!.nodeIds.push('n-1-98', 'n-1-99');
    expect(errorsOf(map).some((error) => error.includes('row 0 must have 2-3 nodes'))).toBe(true);
  });

  it('reports node types outside the profile nodeTypeSet', () => {
    const map = clone(generateMap(SEED, { profileId: 'm0' }));
    map.nodes['n-2-0']!.type = 'event';
    expect(errorsOf(map).some((error) => error.includes('outside the profile nodeTypeSet'))).toBe(
      true,
    );
  });

  it('requires row 1 to use the profile start type', () => {
    const map = clone(generateMap(SEED, { profileId: 'm0' }));
    map.nodes['n-1-0']!.type = 'elite';
    expect(errorsOf(map).some((error) => error.includes('start node n-1-0 must be "enemy"'))).toBe(
      true,
    );
  });

  it('reports orphans and unreachable nodes', () => {
    const map = clone(generateMap(SEED, { profileId: 'm0' }));
    const targetId = map.rows[3]!.nodeIds[0]!;
    for (const node of Object.values(map.nodes)) {
      node.next = node.next.filter((id) => id !== targetId);
    }
    const errors = errorsOf(map);
    expect(errors.some((error) => error.includes(`node ${targetId} has no incoming edge`))).toBe(
      true,
    );
    expect(
      errors.some((error) =>
        error.includes(`node ${targetId} is not reachable from the start row`),
      ),
    ).toBe(true);
  });

  it('reports nodes that cannot reach the closing row', () => {
    const map = clone(generateMap(SEED, { profileId: 'm0' }));
    const node = map.nodes[map.rows[3]!.nodeIds[0]!]!;
    node.next = [];
    expect(
      errorsOf(map).some((error) => error.includes(`node ${node.id} cannot reach the closing row`)),
    ).toBe(true);
  });

  it('reports difficulties outside the balance range', () => {
    const map = clone(generateMap(SEED, { profileId: 'm0' }));
    map.nodes['n-2-0']!.difficulty = 9;
    expect(errorsOf(map).some((error) => error.includes('difficulty 9 is outside'))).toBe(true);
  });

  it('reports the absence of reconvergence', () => {
    const map = clone(generateMap(SEED, { profileId: 'm0' }));
    for (const node of Object.values(map.nodes)) {
      const predecessors = Object.values(map.nodes).filter((candidate) =>
        candidate.next.includes(node.id),
      );
      for (const predecessor of predecessors.slice(1)) {
        predecessor.next = predecessor.next.filter((id) => id !== node.id);
      }
    }
    expect(errorsOf(map).some((error) => error.includes('never reconverges'))).toBe(true);
  });

  it('reports missing Rest and Shop guarantees', () => {
    const map = clone(generateMap(SEED, { profileId: 'full' }));
    for (const node of Object.values(map.nodes)) {
      if (node.type === 'rest' || node.type === 'shop') {
        node.type = 'enemy';
      }
    }
    const errors = errorsOf(map);
    expect(errors.some((error) => error.includes('at least 1 Rest nodes'))).toBe(true);
    expect(errors.some((error) => error.includes('at least 1 Shop nodes'))).toBe(true);
  });

  it('reports two consecutive Rest nodes on a path', () => {
    const map = clone(generateMap(SEED, { profileId: 'full' }));
    const lastRow = map.rows.length - 1;
    const source = Object.values(map.nodes).find(
      (node) => node.row >= 1 && node.row < lastRow && node.next.length > 0,
    );
    expect(source).toBeDefined();
    source!.type = 'rest';
    map.nodes[source!.next[0]!]!.type = 'rest';
    expect(errorsOf(map).some((error) => error.includes('consecutive Rest'))).toBe(true);
  });

  it('rejects a Boss outside the closing row', () => {
    const map = clone(generateMap(SEED, { profileId: 'full' }));
    map.nodes['n-2-0']!.type = 'boss';
    expect(errorsOf(map).some((error) => error.includes('is not allowed on row 1'))).toBe(true);
  });

  it('rejects mismatched startIds and closingIds', () => {
    const map = clone(generateMap(SEED, { profileId: 'm0' }));
    map.startIds.push('n-1-99');
    map.closingIds.pop();
    const errors = errorsOf(map);
    expect(errors.some((error) => error.includes('startIds must match'))).toBe(true);
    expect(errors.some((error) => error.includes('closingIds must match'))).toBe(true);
  });
});
