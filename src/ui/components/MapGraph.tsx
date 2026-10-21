import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { nodeStatus } from '../../domain/selectors'
import type { Day, GameMap, NodeStatus } from '../../domain/types'
import { Icon } from './Icon'
import { NODE_TYPE_ICON, NODE_TYPE_LABEL, romanDay } from '../lib/format'
import {
  buildMapLayout,
  classifyMapEdges,
  type MapEdgeTone,
  type MapNodeLayout,
} from '../lib/mapLayout'
import { nodeAriaLabel, nodeMapHint, nodeTitle } from '../lib/nodeCopy'

const CONTOURS = [
  'M-30 610c100-26 150 32 245 4s150-62 245-38 90 22 120 8',
  'M-20 470c92-22 140 34 232 8s148-56 238-36 92 14 130-2',
  'M-30 332c96-24 150 34 244 8s150-54 240-34 90 10 120-4',
  'M-20 204c88-22 142 32 234 8s150-52 238-32 92 8 128-4',
  'M-30 678c104-18 162 24 268 4s180-24 352-12',
  'M-30 112c112-16 166 22 270 4s190-20 350-10',
]

const PINES: Array<{ x: number; y: number; size: number }> = [
  { x: 32, y: 456, size: 15 },
  { x: 52, y: 474, size: 11 },
  { x: 500, y: 364, size: 16 },
  { x: 482, y: 384, size: 11 },
  { x: 62, y: 244, size: 13 },
  { x: 486, y: 560, size: 14 },
]

const EDGE_CLASS: Record<MapEdgeTone, string> = {
  done: 'path-done',
  open: 'path-open',
  veiled: 'path-veiled',
}

interface NodeButtonProps {
  layout: MapNodeLayout
  day: Day
  map: GameMap
  onSelect: (nodeId: string) => void
}

function nodeClasses(layout: MapNodeLayout, status: NodeStatus): string {
  const classes = ['node']
  if (layout.type === 'boss') classes.push('node--boss')
  if (layout.layerSize === 3) classes.push('node--dense')
  if (status === 'completed') classes.push('node--done')
  if (status === 'skipped') classes.push('node--skipped')
  if (status === 'current') classes.push('node--available', 'node--current')
  if (status === 'available') classes.push('node--available')
  if (status === 'locked') classes.push('node--locked')
  return classes.join(' ')
}

function NodeButton({ layout, day, map, onSelect }: NodeButtonProps) {
  const status = nodeStatus(map, day, layout.id)
  const actionable = status === 'available' || status === 'current'
  const showLabel = actionable || layout.type === 'boss'
  const hint =
    status === 'locked'
      ? `${NODE_TYPE_LABEL[layout.type]} · locked`
      : status === 'current'
        ? `Chosen · ${nodeMapHint(layout.node)}`
        : nodeMapHint(layout.node)
  const style: CSSProperties = {
    left: `${layout.left}%`,
    top: `${layout.top}%`,
  }

  return (
    <button
      type="button"
      className={nodeClasses(layout, status)}
      style={style}
      data-node-id={layout.id}
      data-status={status}
      data-label-side={layout.labelSide}
      aria-label={nodeAriaLabel(layout.node, status)}
      aria-current={status === 'current' ? 'step' : undefined}
      disabled={!actionable}
      onClick={actionable ? () => onSelect(layout.id) : undefined}
    >
      {layout.type === 'boss' ? (
        <svg className="boss-frame" viewBox="0 0 84 90" aria-hidden="true">
          <polygon points="42,2 80,23 80,67 42,88 4,67 4,23" />
        </svg>
      ) : null}

      <span className="medallion">
        <Icon name={NODE_TYPE_ICON[layout.type]} />
        {status === 'completed' ? (
          <span className="node__check" aria-hidden="true">
            <Icon name="check" />
          </span>
        ) : null}
        {status === 'skipped' ? (
          <span className="node__skip" aria-hidden="true">
            –
          </span>
        ) : null}
      </span>

      {showLabel ? (
        <span className="node__label">
          <strong>{nodeTitle(layout.node)}</strong>
          <small>{hint}</small>
        </span>
      ) : null}

      {status === 'current' ? (
        <span className="node__here" aria-hidden="true">
          Here
        </span>
      ) : null}
    </button>
  )
}

export interface MapGraphProps {
  map: GameMap
  day: Day
  onSelect: (nodeId: string) => void
}

/**
 * Decorative SVG plus HTML node buttons. The SVG is hidden from assistive
 * technology; every interaction lives in a real button with a descriptive name.
 */
export function MapGraph({ map, day, onSelect }: MapGraphProps) {
  const layout = useMemo(() => buildMapLayout(map), [map])
  const edges = useMemo(() => classifyMapEdges(layout, map, day), [layout, map, day])

  return (
    <>
      <div className="map-canvas-wrap">
        <div
          className="map-canvas"
          role="group"
          aria-label="Day map. Camp at the bottom, four layers above, and the boss at the top."
        >
          <svg
            className="map-lines"
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            aria-hidden="true"
            focusable="false"
          >
            <g className="contour">
              {CONTOURS.map((d) => (
                <path key={d} d={d} />
              ))}
            </g>
            <g className="decor">
              {PINES.map((pine) => (
                <use
                  key={`${pine.x}-${pine.y}`}
                  href="#i-pine"
                  x={pine.x}
                  y={pine.y}
                  width={pine.size}
                  height={pine.size}
                />
              ))}
              <path d="M84 520c8-4 16-4 24 0M448 300c8-4 16-4 24 0M92 156c8-4 16-4 24 0" />
            </g>
            <circle
              className="boss-halo"
              cx={layout.boss.x}
              cy={layout.boss.y}
              r={56}
            />
            {edges.map((edge) => (
              <path key={edge.id} className={EDGE_CLASS[edge.tone]} d={edge.d} />
            ))}
          </svg>

          <button
            className="node node--done node--start"
            type="button"
            disabled
            style={{ left: `${layout.start.left}%`, top: `${layout.start.top}%` }}
            aria-label="Camp, start of the day"
          >
            <span className="medallion">
              <Icon name="tent" />
            </span>
            <span className="node__label">
              <strong>Camp</strong>
            </span>
          </button>

          {layout.layers.flat().map((node) => (
            <NodeButton
              key={node.id}
              layout={node}
              day={day}
              map={map}
              onSelect={onSelect}
            />
          ))}

          <NodeButton layout={layout.boss} day={day} map={map} onSelect={onSelect} />
        </div>
      </div>

      <div className="map-altimeter" aria-hidden="true">
        {layout.layers.map((layer, index) => (
          <span key={index} style={{ top: `${layer[0]?.top ?? 0}%` }}>
            {romanDay(index)}
          </span>
        ))}
      </div>

      <Icon name="compass" className="map-compass" />
    </>
  )
}
