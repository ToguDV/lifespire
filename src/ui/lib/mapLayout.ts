import { DECISION_LAYERS } from '../../domain/balance'
import type { Day, GameMap, MapNode, NodeType } from '../../domain/types'

/** ViewBox used by the ported design. Node buttons are placed with percentages. */
export const MAP_WIDTH = 560
export const MAP_HEIGHT = 700

const START_Y = 660
const BOSS_Y = 90
const LAYER_Y = [570, 440, 310, 180] as const

/**
 * Hand-tuned horizontal ratios. Two-node layers keep the wide design rhythm;
 * three-node layers move the outer stops inwards so labels still fit beside the
 * map at 360 px. Four and five node layers use tighter lanes, so their labels
 * always sit below the node. The values are fixed, so the renderer never
 * jitters.
 */
const X_RATIOS: Record<number, readonly number[]> = {
  2: [0.22, 0.78],
  3: [0.26, 0.5, 0.74],
  4: [0.16, 0.38, 0.62, 0.84],
  5: [0.12, 0.31, 0.5, 0.69, 0.88],
}

export type MapLabelSide = 'left' | 'right' | 'below'

export interface MapPointLayout {
  x: number
  y: number
  left: number
  top: number
}

export interface MapAnchorLayout extends MapPointLayout {
  id: 'start'
}

export interface MapNodeLayout extends MapPointLayout {
  id: string
  node: MapNode
  type: NodeType
  layer: number
  indexInLayer: number
  layerSize: number
  labelSide: MapLabelSide
}

export interface MapEdgeLayout {
  id: string
  from: string
  to: string
  d: string
}

export interface MapLayout {
  width: number
  height: number
  start: MapAnchorLayout
  layers: MapNodeLayout[][]
  boss: MapNodeLayout
  edges: MapEdgeLayout[]
}

export type MapEdgeTone = 'done' | 'open' | 'veiled'

export interface ClassifiedMapEdge extends MapEdgeLayout {
  tone: MapEdgeTone
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function point(x: number, y: number): MapPointLayout {
  return {
    x: round(x),
    y: round(y),
    left: round((x / MAP_WIDTH) * 100),
    top: round((y / MAP_HEIGHT) * 100),
  }
}

function xFor(layerSize: number, index: number): number {
  const ratio = X_RATIOS[layerSize]?.[index] ?? (index + 1) / (layerSize + 1)
  return MAP_WIDTH * ratio
}

function yFor(layer: number): number {
  if (layer >= DECISION_LAYERS) return BOSS_Y
  return LAYER_Y[layer] ?? START_Y
}

function labelSideFor(layerSize: number, index: number): MapLabelSide {
  if (layerSize >= 4) return 'below'
  if (layerSize === 3) {
    if (index === 0) return 'left'
    if (index === layerSize - 1) return 'right'
    return 'below'
  }
  return index === 0 ? 'left' : 'right'
}

function curvePath(from: MapPointLayout, to: MapPointLayout): string {
  const lift = 30
  return [
    `M${from.x} ${from.y}`,
    `C${from.x} ${round(from.y - lift)}`,
    `${to.x} ${round(to.y + lift)}`,
    `${to.x} ${to.y}`,
  ].join(' ')
}

function edgeOf(
  fromId: string,
  toId: string,
  from: MapPointLayout,
  to: MapPointLayout,
): MapEdgeLayout {
  return {
    id: mapEdgeId(fromId, toId),
    from: fromId,
    to: toId,
    d: curvePath(from, to),
  }
}

function nodeLayout(node: MapNode, layerSize: number, index: number): MapNodeLayout {
  const layer = node.layer
  return {
    id: node.id,
    node,
    type: node.type,
    layer,
    indexInLayer: index,
    layerSize,
    labelSide: labelSideFor(layerSize, index),
    ...point(xFor(layerSize, index), yFor(layer)),
  }
}

/**
 * Pure geometry for the map. It only reads the stored map: no randomness,
 * clock or DOM. The returned order is bottom-up (layer 0 first, boss last).
 */
export function buildMapLayout(map: GameMap): MapLayout {
  const layers = map.layers.map((layer, layerIndex) =>
    layer.map((node, index) => nodeLayout({ ...node, layer: layerIndex }, layer.length, index)),
  )
  const boss = nodeLayout(map.boss, 1, 0)
  const start: MapAnchorLayout = { id: 'start', ...point(MAP_WIDTH / 2, START_Y) }

  const nodesById = new Map<string, MapNodeLayout>()
  for (const node of layers.flat()) nodesById.set(node.id, node)
  nodesById.set(boss.id, boss)

  const edges: MapEdgeLayout[] = []
  for (const node of layers[0] ?? []) {
    edges.push(edgeOf('start', node.id, start, node))
  }
  for (const node of layers.flat()) {
    for (const targetId of node.node.connections) {
      const target = nodesById.get(targetId)
      if (target) edges.push(edgeOf(node.id, targetId, node, target))
    }
  }

  return {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    start,
    layers,
    boss,
    edges,
  }
}

export function mapEdgeId(from: string, to: string): string {
  return `${from}->${to}`
}

/**
 * Classifies every edge for the SVG: the travelled path is solid, the route to
 * the current selection and its next options are open, everything else veiled.
 */
export function classifyMapEdges(
  layout: MapLayout,
  map: GameMap,
  day: Day,
): ClassifiedMapEdge[] {
  const done = new Set<string>()
  const pathIds = day.path.map((entry) => entry.nodeId)

  if (pathIds.length > 0) {
    done.add(mapEdgeId('start', pathIds[0] as string))
    for (let index = 1; index < pathIds.length; index += 1) {
      done.add(mapEdgeId(pathIds[index - 1] as string, pathIds[index] as string))
    }
  }

  const open = new Set<string>()
  const openOrigins = new Set<string>()
  const lastPathId = pathIds[pathIds.length - 1]
  const currentId = map.currentNodeId

  if (currentId) {
    open.add(mapEdgeId(lastPathId ?? 'start', currentId))
    openOrigins.add(currentId)
  } else {
    openOrigins.add(lastPathId ?? 'start')
  }

  return layout.edges.map((edge) => {
    const tone: MapEdgeTone = done.has(edge.id)
      ? 'done'
      : open.has(edge.id) || openOrigins.has(edge.from)
        ? 'open'
        : 'veiled'
    return { ...edge, tone }
  })
}
