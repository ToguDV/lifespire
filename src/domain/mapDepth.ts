import {
  DECISION_LAYERS_BASE,
  MAX_DECISION_LAYERS,
  MAX_GOALS,
  MIN_DECISION_LAYERS,
  MIN_GOALS,
} from './balance'

function clamp(min: number, max: number, value: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * The map grows with the number of active goals: one goal keeps three decision
 * layers, two keep the classic four, and three reach the maximum of five.
 * Routines only affect layer width, never depth.
 */
export function resolveDecisionLayerCount(activeGoalCount: number): number {
  const goals = clamp(MIN_GOALS, MAX_GOALS, activeGoalCount)
  return clamp(MIN_DECISION_LAYERS, MAX_DECISION_LAYERS, DECISION_LAYERS_BASE + goals)
}
