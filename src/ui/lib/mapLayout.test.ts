import { describe, expect, it } from 'vitest'
import { createDemoSetup } from '../../content/demo'
import { DECISION_LAYERS } from '../../domain/balance'
import { generateMap } from '../../domain/generator'
import type { Day, GameMap, MapNode, NodeRewards, TaskSnapshot } from '../../domain/types'
import {
  buildMapLayout,
  classifyMapEdges,
  mapEdgeId,
} from './mapLayout'

const now = new Date(2026, 9, 20, 9, 0, 0)

function demoMap(dayIndex = 0): GameMap {
  const setup = createDemoSetup(now)
  return generateMap({
    runId: 'run_layout',
    runSeed: 'run:run_layout',
    dayIndex,
    generatorVersion: 1,
    goals: setup.goals,
    tasks: setup.tasks,
    objectives: [],
    now: now.toISOString(),
  })
}

const snapshot: TaskSnapshot = {
  taskId: 'task_layout',
  title: 'Walk the ridge',
  goalId: 'goal_layout',
  goalTitle: 'Wayfarer',
  effort: 'medium',
}

const rewards: NodeRewards = { xp: 15, gold: 15, lootRolls: 0, progress: 1 }

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
    id: 'map_layout',
    seed: 'run_layout:day:0:g1',
    dayIndex: 0,
    generatorVersion: 1,
    layers,
    boss: {
      id: 'n4_0',
      layer: DECISION_LAYERS,
      type: 'boss',
      task: snapshot,
      rewards: { xp: 50, gold: 50, lootRolls: 1, progress: 1 },
      connections: [],
    },
    currentNodeId: null,
    createdAt: now.toISOString(),
  }
}

function dayWith(map: GameMap, path: Day['path'] = []): Day {
  return {
    id: 'run_layout:day:0',
    index: 0,
    date: '2026-10-20',
    status: 'in_progress',
    map,
    path,
    rewards: [],
    openedAt: now.toISOString(),
    closedAt: null,
    summary: null,
  }
}

describe('map layout', () => {
  it('is deterministic and maps every stored node into four layers plus the boss', () => {
    const map = demoMap()
    const layout = buildMapLayout(map)

    expect(layout.layers).toHaveLength(DECISION_LAYERS)
    expect(layout.layers.flat().map((node) => node.id)).toEqual(
      map.layers.flat().map((node) => node.id),
    )
    expect(layout.boss.id).toBe(map.boss.id)
    expect(layout.start.id).toBe('start')
    expect(buildMapLayout(map)).toEqual(layout)
  })

  it('keeps two or three nodes per layer, in bounds and without overlaps', () => {
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const map = demoMap(dayIndex)
      const layout = buildMapLayout(map)
      const all = [...layout.layers.flat(), layout.boss, layout.start]

      for (const layer of layout.layers) {
        expect(layer.length).toBeGreaterThanOrEqual(2)
        expect(layer.length).toBeLessThanOrEqual(3)
        expect(new Set(layer.map((node) => node.x)).size).toBe(layer.length)
      }

      for (const node of all) {
        expect(node.left).toBeGreaterThan(0)
        expect(node.left).toBeLessThan(100)
        expect(node.top).toBeGreaterThan(0)
        expect(node.top).toBeLessThan(100)
      }

      for (let first = 0; first < all.length; first += 1) {
        for (let second = first + 1; second < all.length; second += 1) {
          const a = all[first]
          const b = all[second]
          if (!a || !b) continue
          const distance = Math.hypot(a.x - b.x, a.y - b.y)
          expect(distance).toBeGreaterThan(80)
        }
      }
    }
  })

  it('spreads two and three node layers with stable label sides', () => {
    const two = buildMapLayout(fakeMap([2, 2, 2, 2]))
    expect(two.layers[0]?.map((node) => node.x)).toEqual([190.4, 369.6])
    expect(two.layers[0]?.map((node) => node.labelSide)).toEqual(['left', 'right'])

    const three = buildMapLayout(fakeMap([3, 3, 3, 3]))
    expect(three.layers[0]?.map((node) => node.x)).toEqual([168, 280, 392])
    expect(three.layers[0]?.map((node) => node.labelSide)).toEqual([
      'left',
      'below',
      'right',
    ])
  })

  it('draws one edge per connection and one from the start to every first node', () => {
    const map = fakeMap([2, 3, 3, 2])
    const layout = buildMapLayout(map)
    const expected =
      (map.layers[0]?.length ?? 0) +
      map.layers.flat().reduce((total, node) => total + node.connections.length, 0)

    expect(layout.edges).toHaveLength(expected)
    for (const id of map.layers[0]?.map((node) => node.id) ?? []) {
      expect(layout.edges.some((edge) => edge.id === mapEdgeId('start', id))).toBe(true)
    }
  })
})

describe('map edge tones', () => {
  it('opens the first layer from the start before any choice', () => {
    const map = fakeMap([2, 2, 2, 2])
    const layout = buildMapLayout(map)
    const edges = classifyMapEdges(layout, map, dayWith(map))

    const open = edges.filter((edge) => edge.tone === 'open')
    expect(open).toHaveLength(map.layers[0]?.length ?? 0)
    expect(open.every((edge) => edge.from === 'start')).toBe(true)
    expect(edges.filter((edge) => edge.tone === 'done')).toHaveLength(0)
  })

  it('marks the travelled edge done and opens the connections from the last node', () => {
    const map = fakeMap([2, 2, 2, 2])
    const layout = buildMapLayout(map)
    const first = map.layers[0]?.[0] as MapNode
    const day = dayWith(map, [{ nodeId: first.id, action: 'complete', at: now.toISOString() }])
    const edges = classifyMapEdges(layout, map, day)

    expect(edges.find((edge) => edge.id === mapEdgeId('start', first.id))?.tone).toBe('done')
    for (const targetId of first.connections) {
      expect(edges.find((edge) => edge.id === mapEdgeId(first.id, targetId))?.tone).toBe('open')
    }
    expect(edges.find((edge) => edge.tone === 'veiled')).toBeDefined()
  })

  it('lights the route to a current node and its next options', () => {
    const map = fakeMap([2, 2, 2, 2])
    const layout = buildMapLayout(map)
    const first = map.layers[0]?.[0] as MapNode
    const current = map.layers[1]?.[0] as MapNode
    const selected: GameMap = { ...map, currentNodeId: current.id }
    const day = dayWith(selected, [
      { nodeId: first.id, action: 'complete', at: now.toISOString() },
    ])
    const edges = classifyMapEdges(layout, selected, day)

    expect(edges.find((edge) => edge.id === mapEdgeId(first.id, current.id))?.tone).toBe('open')
    for (const targetId of current.connections) {
      expect(edges.find((edge) => edge.id === mapEdgeId(current.id, targetId))?.tone).toBe('open')
    }
  })
})
