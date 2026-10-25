import {
  wheelSectorCenter,
  wheelSectorDegrees,
} from '@lifespire/app-core/ui/wheel'

/** The wheel is drawn in a 200 x 200 box, exactly like the web version. */
export const WHEEL_SIZE = 200
/** Radius of the drawn sectors; 10px are reserved for the outer ring. */
export const WHEEL_RADIUS = 90
/** Static hub, rendered outside the rotating layer. */
export const WHEEL_HUB_SIZE = 52
/** Distance from the center to the center of each sector icon. */
export const WHEEL_ICON_RADIUS = 62
export const WHEEL_ICON_SIZE = 16
/** Outer ring drawn around the wheel (6px, hairlineStrong). */
export const WHEEL_RING_WIDTH = 6
/** Total footprint: the 200px disc plus the 6px ring on each side. */
export const WHEEL_FRAME_SIZE = WHEEL_SIZE + WHEEL_RING_WIDTH * 2

export interface WheelPoint {
  x: number
  y: number
}

function round(value: number): number {
  return Math.round(value * 100000) / 100000
}

/** Cartesian point at `angle` degrees (0 is right, -90 is up). */
export function wheelPoint(
  angle: number,
  radius: number,
  size: number = WHEEL_SIZE,
): WheelPoint {
  const radians = (angle * Math.PI) / 180
  return {
    x: round(size / 2 + radius * Math.cos(radians)),
    y: round(size / 2 + radius * Math.sin(radians)),
  }
}

/** Each wedge is centered on its sector, from center - 18° to center + 18°. */
export function sectorAngles(
  index: number,
  sectorDegrees: number = wheelSectorDegrees(),
): { center: number; start: number; end: number } {
  const center = wheelSectorCenter(index, sectorDegrees)
  const half = sectorDegrees / 2
  return { center, start: center - half, end: center + half }
}

/** SVG path for a wedge whose point sits at the wheel center. */
export function sectorPath(
  index: number,
  sectorDegrees: number = wheelSectorDegrees(),
  size: number = WHEEL_SIZE,
  radius: number = WHEEL_RADIUS,
): string {
  const { start, end } = sectorAngles(index, sectorDegrees)
  const center = size / 2
  const from = wheelPoint(start, radius, size)
  const to = wheelPoint(end, radius, size)
  return `M${center} ${center} L${from.x} ${from.y} A${radius} ${radius} 0 0 1 ${to.x} ${to.y} Z`
}

/** Center of a sector icon at the canonical 62px radius. */
export function sectorIconPosition(
  index: number,
  sectorDegrees: number = wheelSectorDegrees(),
  radius: number = WHEEL_ICON_RADIUS,
): WheelPoint {
  return wheelPoint(wheelSectorCenter(index, sectorDegrees), radius)
}
