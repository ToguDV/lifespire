import {
  LAYER_OFFSET_GOALS,
  LAYER_OFFSET_MAX,
  LAYER_OFFSET_MIN,
  MAX_DECISION_LAYERS,
  MAX_GOALS,
  MIN_DECISION_LAYERS,
  MIN_GOALS,
  WEEKLY_TARGETS_PER_EXTRA_LAYER,
} from './balance'

export interface DecisionLayerInput {
  /** Active goals that own at least one active routine. */
  goalsWithActiveRoutines: number
  /** Sum of `weeklyObjective` across those goals. */
  weeklyTargetSum: number
}

function clamp(min: number, max: number, value: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * The map grows with the goals that have at least one active routine and with
 * the weekly targets those goals ask for. With `g` active goals and total
 * weekly target `s` the depth is
 * `clamp(3, 15, g + offset(g) + floor(max(0, s) / 7))`, where
 * `offset(g) = clamp(2, 5, 2 + floor(max(0, g - 2) / 2))`. The goal term alone
 * gives 1 → 3, 2 → 4, 3 → 5, 4 → 7, 5 → 8, 6 → 10, 7 → 11, 8 → 13, 9 → 14 and
 * 10 → 15 layers. Every seven weekly targets add one layer, capped at 15.
 * Routines only affect layer width, never depth by themselves.
 */
export function resolveDecisionLayerCount(input: DecisionLayerInput): number {
  const goals = clamp(MIN_GOALS, MAX_GOALS, input.goalsWithActiveRoutines)
  const offset = clamp(
    LAYER_OFFSET_MIN,
    LAYER_OFFSET_MAX,
    LAYER_OFFSET_MIN + Math.floor(Math.max(0, goals - LAYER_OFFSET_GOALS) / 2),
  )
  const weeklyBonus = Math.floor(
    Math.max(0, input.weeklyTargetSum) / WEEKLY_TARGETS_PER_EXTRA_LAYER,
  )
  return clamp(MIN_DECISION_LAYERS, MAX_DECISION_LAYERS, goals + offset + weeklyBonus)
}
