import type { MapLabelSide } from '@lifespire/app-core/ui/mapLayout'

/**
 * Pure geometry for the map labels.
 *
 * Labels are placed with absolute pixel offsets instead of percentage
 * translations: RN's `processTransform` walks the transform array with
 * `forEach`, and the late-mounted map labels were the only styles relying on
 * `translateX/Y` percentages. Pixel offsets keep every box finite and
 * transform-free.
 *
 * The values are expressed in local coordinates: `below` and side labels are
 * relative to the node target (54 dp), and the boss label to the boss wrap.
 */

/** Touch target of a map node; labels are positioned from its center. */
export const NODE_TARGET = 54
export const BOSS_WIDTH = 76
export const BOSS_HEIGHT = 82
export const LABEL_MAX_WIDTH = 78
export const LABEL_MAX_WIDTH_DENSE = 64
export const BOSS_LABEL_MAX_WIDTH = 124

const LABEL_GAP_BELOW = 5
const LABEL_GAP_SIDE = 7
/** Keeps the text away from the canvas edge, matching the web gutter. */
const LABEL_EDGE_PADDING = 6
/** Below this width a side label is moved under the node instead. */
const LABEL_MIN_SIDE_WIDTH = 48

export interface MapLabelBox {
  left?: number
  right?: number
  top?: number
  bottom?: number
  width: number
}

export interface MapLabelPlacement {
  /** `side` is the requested side, or `below` when it did not fit. */
  placement: MapLabelSide
  box: MapLabelBox
}

export interface NodeLabelInput {
  side: MapLabelSide
  /** Medallion diameter in dp. */
  size: number
  /** Node center x in canvas pixels. */
  cx: number
  canvasWidth: number
  dense: boolean
}

function belowBox(size: number, maxLabel: number, cx: number, canvasWidth: number): MapLabelBox {
  const center = NODE_TARGET / 2
  // The wrap is anchored at `cx - NODE_TARGET / 2`, so the raw offset must be
  // clamped in absolute canvas pixels to stay inside the edge gutters.
  const origin = cx - NODE_TARGET / 2
  const absolute = clampToCanvas(origin + (center - maxLabel / 2), maxLabel, canvasWidth)
  return {
    left: absolute - origin,
    top: center + size / 2 + LABEL_GAP_BELOW,
    width: maxLabel,
  }
}

/**
 * Keeps an absolutely-positioned label inside `[EDGE, canvasWidth - width -
 * EDGE]`, matching the web gutter. When the canvas is narrower than the label
 * plus both gutters, the label pins to the leading edge.
 */
function clampToCanvas(absoluteLeft: number, width: number, canvasWidth: number): number {
  const min = LABEL_EDGE_PADDING
  const max = Math.max(min, canvasWidth - width - LABEL_EDGE_PADDING)
  return Math.min(Math.max(absoluteLeft, min), max)
}

/**
 * Box for a node label. Side labels span the node target vertically so their
 * text stays centered on the medallion; when there is not enough horizontal
 * room they fall back below the node, exactly like the web stylesheet.
 */
export function nodeLabelLayout({
  side,
  size,
  cx,
  canvasWidth,
  dense,
}: NodeLabelInput): MapLabelPlacement {
  const center = NODE_TARGET / 2
  const maxLabel = dense ? LABEL_MAX_WIDTH_DENSE : LABEL_MAX_WIDTH
  if (side === 'below') {
    return { placement: 'below', box: belowBox(size, maxLabel, cx, canvasWidth) }
  }

  const maxWidth = Math.min(
    maxLabel,
    side === 'left'
      ? cx - size / 2 - LABEL_GAP_SIDE - LABEL_EDGE_PADDING
      : canvasWidth - (cx + size / 2 + LABEL_GAP_SIDE) - LABEL_EDGE_PADDING,
  )
  if (maxWidth < LABEL_MIN_SIDE_WIDTH) {
    return { placement: 'below', box: belowBox(size, maxLabel, cx, canvasWidth) }
  }

  return {
    placement: side,
    box: {
      top: 0,
      bottom: 0,
      width: maxWidth,
      ...(side === 'left'
        ? { right: center + size / 2 + LABEL_GAP_SIDE }
        : { left: center + size / 2 + LABEL_GAP_SIDE }),
    },
  }
}

/**
 * Box for the boss name, centered above the hexagon and clamped to the canvas
 * gutters. `cx`/`canvasWidth` are canvas pixels: the wrap sits at
 * `cx - BOSS_WIDTH / 2`, so the offset is clamped in absolute coordinates like
 * the node labels below.
 */
export function bossLabelBox(cx: number, canvasWidth: number): MapLabelBox {
  const origin = cx - BOSS_WIDTH / 2
  const absolute = clampToCanvas(
    origin + (BOSS_WIDTH / 2 - BOSS_LABEL_MAX_WIDTH / 2),
    BOSS_LABEL_MAX_WIDTH,
    canvasWidth,
  )
  return {
    left: absolute - origin,
    bottom: BOSS_HEIGHT + 4,
    width: BOSS_LABEL_MAX_WIDTH,
  }
}
