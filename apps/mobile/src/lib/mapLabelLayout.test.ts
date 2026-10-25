import {
  BOSS_HEIGHT,
  BOSS_LABEL_MAX_WIDTH,
  BOSS_WIDTH,
  LABEL_MAX_WIDTH,
  LABEL_MAX_WIDTH_DENSE,
  NODE_TARGET,
  bossLabelBox,
  nodeLabelLayout,
} from './mapLabelLayout'
import type { MapLabelBox } from './mapLabelLayout'

function expectFiniteGeometry(box: MapLabelBox): void {
  for (const value of Object.values(box)) {
    if (value !== undefined) expect(Number.isFinite(value)).toBe(true)
  }
  // Labels must stay pure offsets: no transform key can reach a View style.
  expect(box).not.toHaveProperty('transform')
}

describe('map label geometry', () => {
  it('centers a below label under the node without a transform', () => {
    const { placement, box } = nodeLabelLayout({
      side: 'below',
      size: 45,
      cx: 120,
      canvasWidth: 328,
      dense: false,
    })

    expect(placement).toBe('below')
    expect(box).toEqual({
      left: NODE_TARGET / 2 - LABEL_MAX_WIDTH / 2,
      top: NODE_TARGET / 2 + 45 / 2 + 5,
      width: LABEL_MAX_WIDTH,
    })
    expectFiniteGeometry(box)
  })

  it('tightens the below label on dense layers', () => {
    const { box } = nodeLabelLayout({
      side: 'below',
      size: 40,
      cx: 120,
      canvasWidth: 328,
      dense: true,
    })

    expect(box.width).toBe(LABEL_MAX_WIDTH_DENSE)
    expect(box.left).toBe(NODE_TARGET / 2 - LABEL_MAX_WIDTH_DENSE / 2)
    expectFiniteGeometry(box)
  })

  it('places side labels beside the medallion, centered on it', () => {
    const canvasWidth = 328
    const size = 45
    const left = nodeLabelLayout({
      side: 'left',
      size,
      cx: 85.28,
      canvasWidth,
      dense: false,
    })
    const right = nodeLabelLayout({
      side: 'right',
      size,
      cx: 242.72,
      canvasWidth,
      dense: false,
    })

    expect(left.placement).toBe('left')
    expect(left.box.top).toBe(0)
    expect(left.box.bottom).toBe(0)
    expect(left.box.width).toBeCloseTo(49.78, 5)
    expect(left.box.right).toBe(NODE_TARGET / 2 + size / 2 + 7)
    expect(left.box).not.toHaveProperty('left')
    expect(right.placement).toBe('right')
    expect(right.box.top).toBe(0)
    expect(right.box.bottom).toBe(0)
    expect(right.box.width).toBeCloseTo(49.78, 5)
    expect(right.box.left).toBe(NODE_TARGET / 2 + size / 2 + 7)
    expect(right.box).not.toHaveProperty('right')
    expectFiniteGeometry(left.box)
    expectFiniteGeometry(right.box)
  })

  it('falls back below the node when the side lane is too narrow', () => {
    const { placement, box } = nodeLabelLayout({
      side: 'left',
      size: 45,
      cx: 40,
      canvasWidth: 328,
      dense: false,
    })

    expect(placement).toBe('below')
    expect(box.top).toBe(NODE_TARGET / 2 + 45 / 2 + 5)
    expectFiniteGeometry(box)
  })

  it('centers the boss label above the hexagon', () => {
    const box = bossLabelBox(160, 320)

    expect(box).toEqual({
      left: BOSS_WIDTH / 2 - BOSS_LABEL_MAX_WIDTH / 2,
      bottom: BOSS_HEIGHT + 4,
      width: BOSS_LABEL_MAX_WIDTH,
    })
    expectFiniteGeometry(box)
  })

  it('clamps a below label inside the canvas gutters at both edges', () => {
    const canvasWidth = 320
    for (const cx of [40, 300]) {
      const { placement, box } = nodeLabelLayout({
        side: 'below',
        size: 45,
        cx,
        canvasWidth,
        dense: false,
      })
      expect(placement).toBe('below')
      const absoluteLeft = cx - NODE_TARGET / 2 + (box.left ?? 0)
      expect(absoluteLeft).toBeGreaterThanOrEqual(6)
      expect(absoluteLeft + box.width).toBeLessThanOrEqual(canvasWidth - 6)
      expectFiniteGeometry(box)
    }
  })

  it('clamps the boss label inside the canvas gutters at both edges', () => {
    const canvasWidth = 320
    for (const cx of [40, 300]) {
      const box = bossLabelBox(cx, canvasWidth)
      const absoluteLeft = cx - BOSS_WIDTH / 2 + (box.left ?? 0)
      expect(absoluteLeft).toBeGreaterThanOrEqual(6)
      expect(absoluteLeft + box.width).toBeLessThanOrEqual(canvasWidth - 6)
      expectFiniteGeometry(box)
    }
  })

  it('keeps every label finite across node sizes and side lanes', () => {
    for (const size of [40, 44, 45, 50]) {
      for (const canvasWidth of [320, 328, 360, 560]) {
        for (const side of ['left', 'right', 'below'] as const) {
          for (const cx of [40, 85.28, 164, 242.72, 300]) {
            for (const dense of [false, true]) {
              const { box } = nodeLabelLayout({ side, size, cx, canvasWidth, dense })
              expectFiniteGeometry(box)
              expect(box.width).toBeGreaterThan(0)
            }
          }
        }
      }
    }
  })
})
