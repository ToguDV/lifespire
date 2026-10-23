import { WHEEL_SECTORS } from '../../domain/balance'

/** Degrees per sector for the current wheel layout. */
export function wheelSectorDegrees(count: number = WHEEL_SECTORS.length): number {
  return 360 / count
}

/** Suspenseful stop: fast launch, long progressive tail. */
export function easeOutQuart(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  return 1 - (1 - clamped) ** 4
}

/** Physics of the spin, shared by the animation loop. */
export const WHEEL_SPIN_TURNS = 4
export const WHEEL_SPIN_DURATION_MS = 7000

/**
 * Sector sitting under the top pointer for an absolute wheel rotation.
 * Inverts the target math: sector i is centered at `i * degrees - 90`.
 */
export function sectorIndexAtRotation(
  rotationDeg: number,
  sectorDegrees: number = wheelSectorDegrees(),
): number {
  const count = Math.max(1, Math.round(360 / sectorDegrees))
  const pointerAngle = (((-rotationDeg % 360) + 360) % 360 + 360) % 360
  return Math.floor(pointerAngle / sectorDegrees) % count
}

/** Rotation (mod 360) that brings `segmentIndex` under the top pointer. */
export function wheelTargetRotation(
  segmentIndex: number,
  sectorDegrees: number = wheelSectorDegrees(),
): number {
  return (((360 - ((segmentIndex * sectorDegrees) % 360)) % 360) + 360) % 360
}

/**
 * Next absolute rotation that lands on `segmentIndex`: full spins plus the
 * shortest forward delta from `prev`, so the result never depends on how many
 * times the wheel spun before.
 */
export function nextWheelRotation(
  prev: number,
  segmentIndex: number,
  fullTurns = 8,
  sectorDegrees: number = wheelSectorDegrees(),
): number {
  const target = wheelTargetRotation(segmentIndex, sectorDegrees)
  const current = (((prev % 360) + 360) % 360 + 360) % 360
  const delta = (((target - current) % 360) + 360) % 360
  return prev + fullTurns * 360 + delta
}

/** Center angle of a sector, with sector 0 pointing up. */
export function wheelSectorCenter(
  index: number,
  sectorDegrees: number = wheelSectorDegrees(),
): number {
  return index * sectorDegrees - 90
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
