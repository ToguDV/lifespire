import { describe, expect, it } from 'vitest'
import { GOAL_ICON_IDS, LEGACY_GOAL_ICONS } from '../../domain/goalIcons'
import { ICON_MAP, ICON_NAMES } from './iconMap'

describe('iconMap', () => {
  it('keeps the runtime names and the map in sync', () => {
    expect(Object.keys(ICON_MAP).sort()).toEqual([...ICON_NAMES].sort())
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length)
  })

  it('maps every persisted goal icon to a Lucide component', () => {
    for (const icon of [...GOAL_ICON_IDS, ...LEGACY_GOAL_ICONS]) {
      expect(ICON_MAP[icon], icon).toBeTruthy()
    }
  })

  it('keeps the brand spire as a custom glyph', () => {
    expect(ICON_MAP.spire).toBeNull()
  })
})
