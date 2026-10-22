import {
  LAYER_OFFSET_GOALS,
  LAYER_OFFSET_MAX,
  LAYER_OFFSET_MIN,
  MAX_DECISION_LAYERS,
  MAX_GOALS,
  MIN_DECISION_LAYERS,
  MIN_GOALS,
} from './balance'

function clamp(min: number, max: number, value: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * The map grows with the number of goals that have at least one active routine;
 * empty goals do not add depth. With `g` active goals the depth is
 * `clamp(3, 15, g + clamp(2, 5, 2 + floor(max(0, g - 2) / 2)))`: one goal → 3
 * layers, two → 4, three → 5, four → 7, five → 8, six → 10, seven → 11,
 * eight → 13, nine → 14 and ten → 15. Routines only affect layer width, never
 * depth by themselves.
 */
export function resolveDecisionLayerCount(goalsWithActiveRoutines: number): number {
  const goals = clamp(MIN_GOALS, MAX_GOALS, goalsWithActiveRoutines)
  const offset = clamp(
    LAYER_OFFSET_MIN,
    LAYER_OFFSET_MAX,
    LAYER_OFFSET_MIN + Math.floor(Math.max(0, goals - LAYER_OFFSET_GOALS) / 2),
  )
  return clamp(MIN_DECISION_LAYERS, MAX_DECISION_LAYERS, goals + offset)
}
