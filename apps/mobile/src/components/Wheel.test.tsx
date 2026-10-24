import { WHEEL_SECTORS } from '@lifespire/core'
import {
  nextWheelRotation,
  sectorIndexAtRotation,
  wheelSectorCenter,
} from '@lifespire/app-core/ui/wheel'
import {
  WHEEL_ICON_RADIUS,
  WHEEL_RADIUS,
  WHEEL_SIZE,
  sectorIconPosition,
  sectorPath,
} from './wheelGeometry'

function normalize(angle: number): number {
  return ((angle % 360) + 360) % 360
}

function pathNumbers(index: number): number[] {
  const degrees = 360 / WHEEL_SECTORS.length
  const numbers = sectorPath(index, degrees).match(/-?\d+(?:\.\d+)?/g)
  if (!numbers) throw new Error('wheel sector path is not parseable')
  return numbers.map(Number)
}

describe('wheel geometry', () => {
  const degrees = 360 / WHEEL_SECTORS.length

  it('draws ten sectors with the canonical 5/2/2/1 split', () => {
    expect(WHEEL_SECTORS).toHaveLength(10)
    const counts = new Map<string, number>()
    for (const sector of WHEEL_SECTORS) {
      counts.set(sector, (counts.get(sector) ?? 0) + 1)
    }
    expect(counts.get('task')).toBe(5)
    expect(counts.get('gold')).toBe(2)
    expect(counts.get('xp')).toBe(2)
    expect(counts.get('rest')).toBe(1)
    expect(degrees).toBe(36)
  })

  it('centers every path on wheelSectorCenter, from -18 to +18 degrees', () => {
    for (let index = 0; index < WHEEL_SECTORS.length; index += 1) {
      const [cx, cy, x1, y1, arcRadius, , , , , x2, y2] = pathNumbers(index)
      expect(cx).toBe(WHEEL_SIZE / 2)
      expect(cy).toBe(WHEEL_SIZE / 2)
      expect(arcRadius).toBe(WHEEL_RADIUS)
      expect(Math.hypot(x1 - cx, y1 - cy)).toBeCloseTo(WHEEL_RADIUS, 3)
      expect(Math.hypot(x2 - cx, y2 - cy)).toBeCloseTo(WHEEL_RADIUS, 3)

      // The bisector of the two arc endpoints is the center of the wedge.
      const midpoint = normalize(
        (Math.atan2(y1 - cy + (y2 - cy), x1 - cx + (x2 - cx)) * 180) / Math.PI,
      )
      expect(midpoint).toBeCloseTo(normalize(wheelSectorCenter(index, degrees)), 5)
    }
  })

  it('anchors sector 0 at the top and spans 252-288 degrees', () => {
    // Web's canonical check: the first wedge is centered on 270° (up), so the
    // pointer at rest sits inside it and the target math stays aligned.
    expect(normalize(wheelSectorCenter(0, degrees))).toBe(270)
    const [cx, cy, x1, y1, , , , , , x2, y2] = pathNumbers(0)
    const start = normalize(
      (Math.atan2(y1 - cy, x1 - cx) * 180) / Math.PI,
    )
    const end = normalize(
      (Math.atan2(y2 - cy, x2 - cx) * 180) / Math.PI,
    )
    expect(start).toBeCloseTo(252, 5)
    expect(end).toBeCloseTo(288, 5)
  })

  it('lands the pointer on the sector center for every target rotation', () => {
    for (let index = 0; index < WHEEL_SECTORS.length; index += 1) {
      const target = nextWheelRotation(0, index, 4, degrees)
      expect(sectorIndexAtRotation(target, degrees)).toBe(index)
    }
  })

  it('places each sector icon at radius 62 on the sector angle', () => {
    for (let index = 0; index < WHEEL_SECTORS.length; index += 1) {
      const position = sectorIconPosition(index, degrees)
      const radius = Math.hypot(
        position.x - WHEEL_SIZE / 2,
        position.y - WHEEL_SIZE / 2,
      )
      const angle = normalize(
        (Math.atan2(position.y - WHEEL_SIZE / 2, position.x - WHEEL_SIZE / 2) * 180) /
          Math.PI,
      )
      expect(radius).toBeCloseTo(WHEEL_ICON_RADIUS, 3)
      expect(angle).toBeCloseTo(normalize(wheelSectorCenter(index, degrees)), 3)
    }
  })
})
