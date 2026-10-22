import type { Day, GameMap, MapNode, NodeType } from '../../domain/types'

/** ViewBox width used by the ported design. Node buttons are placed with percentages. */
export const MAP_WIDTH = 560

/**
 * Height of the classic four-layer map. The live layout derives its height from
 * the day's layer count; this constant stays as the base viewBox for the empty
 * map art and for tests that need the reference geometry.
 */
export const MAP_HEIGHT = 700

export const LAYER_STEP = 130
export const CAMP_GAP = 90
export const BOSS_GAP = 90
export const BOTTOM_MARGIN = 40
export const TOP_MARGIN = 90

/** Canvas height for a map with `layerCount` decision layers. */
export function mapHeight(layerCount: number): number {
  return (
    BOTTOM_MARGIN +
    CAMP_GAP +
    LAYER_STEP * (layerCount - 1) +
    BOSS_GAP +
    TOP_MARGIN
  )
}

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

function point(x: number, y: number, height: number): MapPointLayout {
  return {
    x: round(x),
    y: round(y),
    left: round((x / MAP_WIDTH) * 100),
    top: round((y / height) * 100),
  }
}

function xFor(layerSize: number, index: number): number {
  const ratio = X_RATIOS[layerSize]?.[index] ?? (index + 1) / (layerSize + 1)
  return MAP_WIDTH * ratio
}

function campY(height: number): number {
  return height - BOTTOM_MARGIN
}

function layerY(height: number, layer: number): number {
  return campY(height) - CAMP_GAP - LAYER_STEP * layer
}

function bossY(height: number, layerCount: number): number {
  return layerY(height, layerCount - 1) - BOSS_GAP
}

function yFor(layer: number, height: number, layerCount: number): number {
  if (layer >= layerCount) return bossY(height, layerCount)
  return layerY(height, layer)
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

function nodeLayout(
  node: MapNode,
  layerSize: number,
  index: number,
  height: number,
  layerCount: number,
): MapNodeLayout {
  const layer = node.layer
  return {
    id: node.id,
    node,
    type: node.type,
    layer,
    indexInLayer: index,
    layerSize,
    labelSide: labelSideFor(layerSize, index),
    ...point(xFor(layerSize, index), yFor(layer, height, layerCount), height),
  }
}

/**
 * Pure geometry for the map. It only reads the stored map: no randomness,
 * clock or DOM. The returned order is bottom-up (layer 0 first, boss last).
 * The canvas grows with the day's layer count; spacing between layers is fixed.
 */
export function buildMapLayout(map: GameMap): MapLayout {
  const layerCount = map.layers.length
  const height = mapHeight(layerCount)
  const layers = map.layers.map((layer, layerIndex) =>
    layer.map((node, index) =>
      nodeLayout({ ...node, layer: layerIndex }, layer.length, index, height, layerCount),
    ),
  )
  const boss = nodeLayout(map.boss, 1, 0, height, layerCount)
  const start: MapAnchorLayout = {
    id: 'start',
    ...point(MAP_WIDTH / 2, campY(height), height),
  }

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
    height,
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
