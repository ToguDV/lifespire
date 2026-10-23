import { describe, expect, it } from 'vitest'
import { WHEEL_SECTORS } from '../../domain/balance'
import {
  easeOutQuart,
  nextWheelRotation,
  sectorIndexAtRotation,
  wheelSectorCenter,
  wheelTargetRotation,
} from './wheel'

describe('wheel rotation', () => {
  it('maps every sector center to the top pointer', () => {
    const degrees = 360 / WHEEL_SECTORS.length
    for (let index = 0; index < WHEEL_SECTORS.length; index += 1) {
      const target = wheelTargetRotation(index, degrees)
      // Rotating the sector center by the target must land on top (-90 ≡ 270).
      const landed = (wheelSectorCenter(index, degrees) + target) % 360
      const normalized = ((landed % 360) + 360) % 360
      expect(normalized).toBeCloseTo(270, 10)
    }
  })

  it('advances forward with full spins from any previous rotation', () => {
    const degrees = 360 / WHEEL_SECTORS.length
    const next = nextWheelRotation(1234, 3, 8, degrees)
    expect(next).toBeGreaterThan(1234 + 8 * 360 - 1)
    const normalized = (((next % 360) + 360) % 360 + 360) % 360
    expect(normalized).toBeCloseTo(wheelTargetRotation(3, degrees), 10)
  })

  it('lands on the same target regardless of history', () => {
    const degrees = 360 / WHEEL_SECTORS.length
    const fromZero = nextWheelRotation(0, 9, 8, degrees)
    const fromSpun = nextWheelRotation(5000, 9, 8, degrees)
    const norm = (value: number): number => (((value % 360) + 360) % 360 + 360) % 360
    expect(norm(fromZero)).toBeCloseTo(norm(fromSpun), 10)
    expect(norm(fromZero)).toBeCloseTo(wheelTargetRotation(9, degrees), 10)
  })
})

describe('spin physics', () => {
  it('easeOutQuart starts at 0, ends at 1 and rushes early', () => {
    expect(easeOutQuart(0)).toBe(0)
    expect(easeOutQuart(1)).toBe(1)
    expect(easeOutQuart(0.5)).toBeCloseTo(0.9375, 10)
    expect(easeOutQuart(0.25)).toBeGreaterThan(0.25)
  })

  it('reports the sector under the pointer for any rotation', () => {
    const degrees = 360 / WHEEL_SECTORS.length
    for (let index = 0; index < WHEEL_SECTORS.length; index += 1) {
      expect(sectorIndexAtRotation(wheelTargetRotation(index, degrees), degrees)).toBe(
        index,
      )
    }
    expect(sectorIndexAtRotation(0, degrees)).toBe(0)
  })
})
