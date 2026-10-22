import { describe, expect, it } from 'vitest'
import {
  GOAL_ICON_IDS,
  isGoalIconId,
  legacyGoalIcon,
  nextGoalIcon,
} from './goalIcons'

describe('goal icons', () => {
  it('keeps the legacy four-icon cycle for migrated saves', () => {
    expect(legacyGoalIcon(0)).toBe('banner')
    expect(legacyGoalIcon(1)).toBe('flame')
    expect(legacyGoalIcon(5)).toBe('flame')
  })

  it('recognises only catalog ids', () => {
    expect(isGoalIconId('book')).toBe(true)
    expect(isGoalIconId('not-an-icon')).toBe(false)
    expect(isGoalIconId(undefined)).toBe(false)
  })

  it('suggests the first icon not used by an active goal', () => {
    expect(nextGoalIcon([])).toBe('banner')
    expect(nextGoalIcon([{ icon: 'banner', active: true }])).toBe('flame')
    expect(
      nextGoalIcon([
        { icon: 'banner', active: false },
        { icon: 'flame', active: true },
      ]),
    ).toBe('banner')
  })

  it('falls back to the cycle when every icon is taken', () => {
    const goals = GOAL_ICON_IDS.map((icon) => ({ icon, active: true }))
    expect(nextGoalIcon(goals)).toBe(GOAL_ICON_IDS[goals.length % GOAL_ICON_IDS.length])
  })
})
