import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { nodeStatus } from '../../domain/selectors'
import type { Day, GameMap, NodeStatus } from '../../domain/types'
import { Icon } from './Icon'
import { NODE_TYPE_ICON, romanDay } from '../lib/format'
import {
  buildMapLayout,
  classifyMapEdges,
  type MapEdgeTone,
  type MapNodeLayout,
} from '../lib/mapLayout'
import { nodeAriaLabel, nodeTitle } from '../lib/nodeCopy'

/**
 * Four hand-tuned contour silhouettes, rebased to y=0. Each decision layer is
 * drawn with its own shape, cycled when a map has more than four layers so the
 * top layer never repeats its neighbour's line.
 */
const LAYER_CONTOURS = [
  'M-30 0c100-26 150 32 245 4s150-62 245-38 90 22 120 8',
  'M-20 0c92-22 140 34 232 8s148-56 238-36 92 14 130-2',
  'M-30 0c96-24 150 34 244 8s150-54 240-34 90 10 120-4',
  'M-20 0c88-22 142 32 234 8s150-52 238-32 92 8 128-4',
]
const CAMP_CONTOUR = 'M-30 0c104-18 162 24 268 4s180-24 352-12'
const BOSS_CONTOUR = 'M-30 0c112-16 166 22 270 4s190-20 350-10'

const EDGE_CLASS: Record<MapEdgeTone, string> = {
  done: 'path-done',
  open: 'path-open',
  veiled: 'path-veiled',
}

interface NodeButtonProps {
  layout: MapNodeLayout
  day: Day
  map: GameMap
  revealed: boolean
  onReveal: (nodeId: string) => void
  onSelect: (nodeId: string) => void
}

/**
 * Touch devices cannot hover, so the first tap reveals the task name and a
 * second tap selects the node. Keyboard activation goes straight through.
 */
function firstTapOnlyReveals(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(hover: none)').matches
}

function nodeClasses(layout: MapNodeLayout, status: NodeStatus): string {
  const classes = ['node']
  if (layout.type === 'boss') classes.push('node--boss')
  if (layout.layerSize >= 3) classes.push('node--dense')
  if (layout.layerSize === 5) classes.push('node--wide')
  if (status === 'completed') classes.push('node--done')
  if (status === 'skipped') classes.push('node--skipped')
  if (status === 'current') classes.push('node--available', 'node--current')
  if (status === 'available') classes.push('node--available')
  if (status === 'locked') classes.push('node--locked')
  return classes.join(' ')
}

function NodeButton({ layout, day, map, revealed, onReveal, onSelect }: NodeButtonProps) {
  const status = nodeStatus(map, day, layout.id)
  const actionable = status === 'available' || status === 'current'
  const showLabel = actionable || layout.type === 'boss'
  const style: CSSProperties = {
    left: `${layout.left}%`,
    top: `${layout.top}%`,
  }

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!revealed && event.detail > 0 && firstTapOnlyReveals()) {
      onReveal(layout.id)
      return
    }
    onSelect(layout.id)
  }

  return (
    <button
      type="button"
      className={nodeClasses(layout, status)}
      style={style}
      data-node-id={layout.id}
      data-status={status}
      data-label-side={layout.labelSide}
      data-revealed={revealed ? 'true' : undefined}
      aria-label={nodeAriaLabel(layout.node, status)}
      aria-current={status === 'current' ? 'step' : undefined}
      disabled={!actionable}
      onClick={actionable ? handleClick : undefined}
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
  const [revealedId, setRevealedId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleSelect = (nodeId: string) => {
    setRevealedId(null)
    onSelect(nodeId)
  }

  // Keep the step in play centred when the day opens, after each resolution and
  // whenever a new node becomes current. The camp anchors a fresh map.
  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    const targetId = map.currentNodeId ?? 'start'
    const target = scroller.querySelector<HTMLElement>(`[data-node-id="${targetId}"]`)
    if (!target) return
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: reduced ? 'auto' : 'smooth',
    })
  }, [map.currentNodeId, day.path.length, layout])

  return (
    <>
      <div className="map-canvas-wrap" ref={scrollRef}>
        <div
          className="map-canvas"
          role="group"
          aria-label={`Day map. Camp at the bottom, ${layout.layers.length} layers above, and the boss at the top.`}
          style={{ aspectRatio: `${layout.width} / ${layout.height}` }}
        >
          <svg
            className="map-lines"
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            aria-hidden="true"
            focusable="false"
          >
            <g className="contour">
              {layout.layers.map((layer, index) => (
                <path
                  key={layer[0]?.id ?? index}
                  d={LAYER_CONTOURS[index % LAYER_CONTOURS.length]}
                  transform={`translate(0 ${layer[0]?.y ?? 0})`}
                />
              ))}
              <path d={CAMP_CONTOUR} transform={`translate(0 ${layout.start.y + 4})`} />
              <path d={BOSS_CONTOUR} transform={`translate(0 ${layout.boss.y})`} />
            </g>
            <g className="decor">
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
            data-node-id="start"
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
              revealed={revealedId === node.id}
              onReveal={setRevealedId}
              onSelect={handleSelect}
            />
          ))}

          <NodeButton
            layout={layout.boss}
            day={day}
            map={map}
            revealed={revealedId === layout.boss.id}
            onReveal={setRevealedId}
            onSelect={handleSelect}
          />

          <div className="map-altimeter" aria-hidden="true">
            <div
              className="map-altimeter__line"
              style={{
                top: `${layout.boss.top}%`,
                bottom: `${100 - layout.start.top}%`,
              }}
            />
            {layout.layers.map((layer, index) => (
              <span key={index} style={{ top: `${layer[0]?.top ?? 0}%` }}>
                {romanDay(index)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <Icon name="compass" className="map-compass" />
    </>
  )
}
