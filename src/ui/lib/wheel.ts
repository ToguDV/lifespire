import { WHEEL_SECTORS } from '../../domain/balance'

/** Degrees per sector for the current wheel layout. */
export function wheelSectorDegrees(count: number = WHEEL_SECTORS.length): number {
  return 360 / count
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
