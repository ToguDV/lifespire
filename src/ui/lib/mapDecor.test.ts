import { describe, expect, it } from 'vitest'
import { DECISION_LAYERS } from '../../domain/balance'
import type { GameMap, MapNode, NodeRewards, TaskSnapshot } from '../../domain/types'
import { buildMapLayout, MAP_HEIGHT, MAP_WIDTH } from './mapLayout'
import { DECOR, decorBounds, type DecorItem } from './mapDecor'

const snapshot: TaskSnapshot = {
  taskId: 'task_decor',
  title: 'Walk the ridge',
  goalId: 'goal_decor',
  goalTitle: 'Wayfarer',
  effort: 'medium',
}

const rewards: NodeRewards = { xp: 15, gold: 15, lootRolls: 0, progress: 1 }

/**
 * Worst case for the forest: mixed layer sizes, so the nodes cover every
 * column a real map can place them in.
 */
function fakeMap(layerSizes: readonly number[]): GameMap {
  const layers: MapNode[][] = layerSizes.map((size, layerIndex) =>
    Array.from({ length: size }, (_, index) => ({
      id: `n${layerIndex}_${index}`,
      layer: layerIndex,
      type: 'task' as const,
      task: snapshot,
      rewards,
      connections: [],
    })),
  )

  layers.forEach((layer, layerIndex) => {
    const next = layerIndex < DECISION_LAYERS - 1 ? layers[layerIndex + 1] : null
    for (const node of layer) {
      node.connections = next ? next.map((target) => target.id) : ['n4_0']
    }
  })

  return {
    id: 'map_decor',
    seed: 'run_decor:day:0:g1',
    dayIndex: 0,
    generatorVersion: 1,
    layers,
    boss: {
      id: 'boss',
      layer: DECISION_LAYERS,
      type: 'boss',
      task: null,
      rewards,
      connections: [],
    },
    currentNodeId: null,
    createdAt: '2026-10-20T09:00:00.000Z',
  }
}

/** Distance from a point to the closest edge of an axis-aligned box. */
function distanceToBox(
  point: { x: number; y: number },
  box: { left: number; right: number; top: number; bottom: number },
): number {
  const dx = Math.max(box.left - point.x, 0, point.x - box.right)
  const dy = Math.max(box.top - point.y, 0, point.y - box.bottom)
  return Math.hypot(dx, dy)
}

function itemsOf(plane: DecorItem['plane']): DecorItem[] {
  return DECOR.filter((item) => item.plane === plane)
}

describe('map decor', () => {
  it('keeps every decoration inside the map canvas', () => {
    for (const item of DECOR) {
      const box = decorBounds(item)
      expect(box.left, `${item.kind} at ${item.x}`).toBeGreaterThanOrEqual(2)
      expect(box.right, `${item.kind} at ${item.x}`).toBeLessThanOrEqual(MAP_WIDTH - 2)
      expect(box.top, `${item.kind} at ${item.y}`).toBeGreaterThanOrEqual(0)
      expect(box.bottom, `${item.kind} at ${item.y}`).toBeLessThanOrEqual(MAP_HEIGHT)
    }
  })

  it('keeps a clear margin around every node medallion', () => {
    const layout = buildMapLayout(fakeMap([5, 3, 4, 2]))
    const nodes = [...layout.layers.flat(), layout.boss]

    for (const item of DECOR) {
      const box = decorBounds(item)
      for (const node of nodes) {
        const distance = distanceToBox({ x: node.x, y: node.y }, box)
        expect(distance, `${item.kind} at ${item.x} is too close to node ${node.id}`).toBeGreaterThan(30)
      }
    }
  })

  it('keeps the boss halo clear', () => {
    const layout = buildMapLayout(fakeMap([5, 3, 4, 2]))
    const box = decorBounds

    for (const item of DECOR) {
      const distance = distanceToBox(
        { x: layout.boss.x, y: layout.boss.y },
        box(item),
      )
      expect(distance, `${item.kind} at ${item.x} crowds the boss halo`).toBeGreaterThan(62)
    }
  })

  it('keeps the camp anchor and its label clear', () => {
    const layout = buildMapLayout(fakeMap([5, 3, 4, 2]))
    const camp = { left: 243, right: 317, top: 636, bottom: 700 }

    for (const item of DECOR) {
      const box = decorBounds(item)
      const overlaps =
        box.right > camp.left &&
        box.left < camp.right &&
        box.bottom > camp.top &&
        box.top < camp.bottom
      expect(overlaps, `${item.kind} at ${item.x} covers the camp`).toBe(false)
    }

    expect(layout.start.x).toBe(280)
  })

  it('never overlaps two mid or near decorations', () => {
    const front = [...itemsOf('mid'), ...itemsOf('near')]

    for (let index = 0; index < front.length; index += 1) {
      for (let other = index + 1; other < front.length; other += 1) {
        const a = decorBounds(front[index] as DecorItem)
        const b = decorBounds(front[other] as DecorItem)
        const overlaps =
          a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom
        expect(
          overlaps,
          `${front[index]?.kind} overlaps ${front[other]?.kind}`,
        ).toBe(false)
      }
    }
  })

  it('keeps a quiet cast with a fixed depth plan', () => {
    const far = itemsOf('far')
    const mid = itemsOf('mid')
    const near = itemsOf('near')

    expect(far.length).toBeGreaterThanOrEqual(12)
    expect(far.length).toBeLessThanOrEqual(22)
    expect(mid.length).toBeGreaterThanOrEqual(8)
    expect(mid.length).toBeLessThanOrEqual(16)
    expect(near.length).toBeGreaterThanOrEqual(8)
    expect(near.length).toBeLessThanOrEqual(18)
    expect(DECOR.length).toBeLessThanOrEqual(52)

    expect(DECOR.some((item) => item.kind === 'fox')).toBe(true)
    expect(DECOR.some((item) => item.kind === 'bear')).toBe(true)
    expect(DECOR.some((item) => item.kind === 'fern')).toBe(true)
  })
})
