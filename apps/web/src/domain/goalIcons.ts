/**
 * Closed catalog of goal icons. The ids match the UI sprite names, but the
 * domain owns the list so persistence and validation never import React.
 */
export const GOAL_ICON_IDS = [
  'banner',
  'flame',
  'quill',
  'gem',
  'compass',
  'star',
  'sun',
  'moon',
  'key',
  'cup',
  'pine',
  'lantern',
  'feather',
  'ring',
  'scroll',
  'crown',
  'map',
  'tent',
  'book',
  'heart',
  'leaf',
  'brush',
  'dumbbell',
  'home',
  'wallet',
  'briefcase',
  'users',
  'utensils',
] as const

export type GoalIconId = (typeof GOAL_ICON_IDS)[number]

/** Icons assigned by index before goal icons became persisted data. */
export const LEGACY_GOAL_ICONS = ['banner', 'flame', 'quill', 'gem'] as const

export function isGoalIconId(value: unknown): value is GoalIconId {
  return typeof value === 'string' && GOAL_ICON_IDS.includes(value as GoalIconId)
}

/** Keeps the previous visual cycle when migrating saves without an icon. */
export function legacyGoalIcon(index: number): GoalIconId {
  return LEGACY_GOAL_ICONS[index % LEGACY_GOAL_ICONS.length] ?? 'banner'
}

/**
 * Suggests the first icon not used by an active goal, falling back to the
 * cycle. New goals start with a distinct crest instead of repeating.
 */
export function nextGoalIcon(
  goals: ReadonlyArray<{ icon?: GoalIconId; active?: boolean }>,
): GoalIconId {
  const used = new Set(
    goals
      .filter((goal) => goal.active !== false)
      .map((goal) => goal.icon)
      .filter(isGoalIconId),
  )
  const available = GOAL_ICON_IDS.find((icon) => !used.has(icon))
  return available ?? GOAL_ICON_IDS[goals.length % GOAL_ICON_IDS.length] ?? 'banner'
}
