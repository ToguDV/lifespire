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
 * empty goals do not add depth. One goal keeps three decision layers, two keep
 * the classic four, and every two goals beyond the second add one more, up to
 * the fifteen-layer cap. Routines only affect layer width, never depth by
 * themselves.
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
