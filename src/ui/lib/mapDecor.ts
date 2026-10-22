/**
 * Decorative forest for the day map.
 *
 * The data is plain geometry on the map viewBox (560x700). Nothing here reads
 * the clock, the DOM or a random source, so the forest is identical on every
 * render and can be asserted in tests.
 *
 * Placement rules, enforced by `mapDecor.test.ts`:
 * - Nothing touches a node medallion, the boss halo or the camp label.
 * - The forest lives in the gaps between node rows and along the margins.
 * - Far, mid and near planes never share the same depth.
 *
 * `x` is the centre of the artwork and `y` is its baseline, so trees and
 * animals stand on the ground instead of floating.
 */

export type DecorKind = 'pine' | 'birch' | 'fern' | 'rock' | 'mushroom' | 'tuft' | 'fox' | 'bear'

export type DecorPlane = 'far' | 'mid' | 'near'

export interface DecorItem {
  kind: DecorKind
  plane: DecorPlane
  x: number
  y: number
  size: number
  flip?: boolean
}

/** Width to height ratio of every artwork, so the baseline stays honest. */
export const DECOR_ASPECT: Record<DecorKind, number> = {
  pine: 1,
  birch: 1,
  fern: 1,
  rock: 1,
  mushroom: 1,
  tuft: 1,
  fox: 4 / 3,
  bear: 3 / 2,
}

/** Ground line of the distant treeline. The far plane stands on it. */
export const RIDGE = 'M-20 90c70-16 132 8 202-2s138-16 208-6 128 10 190 4'

/** Baseline shared by the distant treeline. */
const FAR_BASELINE = 88

/**
 * The distant treeline. Small and dense so it reads as a horizon, with a
 * deliberate clearing around the boss gate.
 */
const FAR: DecorItem[] = [
  { kind: 'pine', plane: 'far', x: 12, y: FAR_BASELINE, size: 20 },
  { kind: 'pine', plane: 'far', x: 40, y: FAR_BASELINE, size: 26 },
  { kind: 'pine', plane: 'far', x: 68, y: FAR_BASELINE, size: 16 },
  { kind: 'birch', plane: 'far', x: 96, y: FAR_BASELINE, size: 24 },
  { kind: 'pine', plane: 'far', x: 124, y: FAR_BASELINE, size: 28 },
  { kind: 'pine', plane: 'far', x: 152, y: FAR_BASELINE, size: 18 },
  { kind: 'pine', plane: 'far', x: 180, y: FAR_BASELINE, size: 22 },
  { kind: 'pine', plane: 'far', x: 380, y: FAR_BASELINE, size: 26 },
  { kind: 'pine', plane: 'far', x: 408, y: FAR_BASELINE, size: 16 },
  { kind: 'birch', plane: 'far', x: 436, y: FAR_BASELINE, size: 22 },
  { kind: 'pine', plane: 'far', x: 464, y: FAR_BASELINE, size: 18 },
  { kind: 'pine', plane: 'far', x: 492, y: FAR_BASELINE, size: 28 },
  { kind: 'pine', plane: 'far', x: 520, y: FAR_BASELINE, size: 15 },
  { kind: 'pine', plane: 'far', x: 548, y: FAR_BASELINE, size: 20 },
]

/**
 * The middle plane. Trees stand in the gaps between node rows and hug the
 * margins, where the map keeps no information.
 */
const MID: DecorItem[] = [
  { kind: 'pine', plane: 'mid', x: 30, y: 150, size: 22 },
  { kind: 'pine', plane: 'mid', x: 528, y: 148, size: 20 },
  { kind: 'pine', plane: 'mid', x: 22, y: 240, size: 30 },
  { kind: 'pine', plane: 'mid', x: 50, y: 262, size: 18 },
  { kind: 'pine', plane: 'mid', x: 538, y: 236, size: 24 },
  { kind: 'birch', plane: 'mid', x: 506, y: 258, size: 18 },
  { kind: 'birch', plane: 'mid', x: 16, y: 372, size: 26 },
  { kind: 'pine', plane: 'mid', x: 46, y: 396, size: 20 },
  { kind: 'pine', plane: 'mid', x: 542, y: 368, size: 28 },
  { kind: 'pine', plane: 'mid', x: 512, y: 392, size: 18 },
  { kind: 'pine', plane: 'mid', x: 24, y: 500, size: 28 },
  { kind: 'pine', plane: 'mid', x: 52, y: 520, size: 16 },
  { kind: 'pine', plane: 'mid', x: 530, y: 500, size: 26 },
  { kind: 'pine', plane: 'mid', x: 506, y: 520, size: 18 },
]

/**
 * The near plane. Undergrowth, stones and the two animals of the wood. It
 * stays at the bottom of the frame, where the map has no nodes, and its
 * baselines are uneven so the band reads as undergrowth and not as a shelf.
 */
const NEAR: DecorItem[] = [
  { kind: 'tuft', plane: 'near', x: 16, y: 630, size: 22 },
  { kind: 'tuft', plane: 'near', x: 542, y: 620, size: 20 },
  { kind: 'rock', plane: 'near', x: 496, y: 636, size: 18 },
  { kind: 'pine', plane: 'near', x: 22, y: 690, size: 38 },
  { kind: 'fox', plane: 'near', x: 86, y: 672, size: 44 },
  { kind: 'tuft', plane: 'near', x: 140, y: 698, size: 20 },
  { kind: 'fern', plane: 'near', x: 176, y: 660, size: 28 },
  { kind: 'mushroom', plane: 'near', x: 206, y: 678, size: 15 },
  { kind: 'rock', plane: 'near', x: 330, y: 696, size: 24 },
  { kind: 'fern', plane: 'near', x: 404, y: 688, size: 26 },
  { kind: 'bear', plane: 'near', x: 470, y: 690, size: 48 },
  { kind: 'fern', plane: 'near', x: 536, y: 664, size: 28 },
]

export const DECOR: DecorItem[] = [...FAR, ...MID, ...NEAR]

/**
 * Low haze patches. They separate the depth planes and soften the horizon.
 * They are drawn behind everything and stay almost invisible.
 */
export const MIST: Array<{ x: number; y: number; rx: number; ry: number }> = [
  { x: 120, y: 140, rx: 220, ry: 26 },
  { x: 410, y: 148, rx: 240, ry: 22 },
  { x: 80, y: 368, rx: 200, ry: 22 },
  { x: 440, y: 378, rx: 220, ry: 20 },
  { x: 200, y: 542, rx: 220, ry: 20 },
  { x: 470, y: 552, rx: 190, ry: 18 },
]

export interface DecorBounds {
  left: number
  right: number
  top: number
  bottom: number
}

/** Axis-aligned box of a decoration, used by the layout guards and the tests. */
export function decorBounds(item: DecorItem): DecorBounds {
  const width = item.size * DECOR_ASPECT[item.kind]
  return {
    left: item.x - width / 2,
    right: item.x + width / 2,
    top: item.y - item.size,
    bottom: item.y,
  }
}
