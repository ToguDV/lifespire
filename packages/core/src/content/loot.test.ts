import { describe, expect, it } from 'vitest'
import {
  LOOT_CATALOG,
  createLootItem,
  createLootItemFromCatalog,
  findLootById,
  lootByRarity,
} from './loot.js'

describe('loot catalog', () => {
  it('has exactly twelve original items', () => {
    expect(LOOT_CATALOG).toHaveLength(12)
    expect(new Set(LOOT_CATALOG.map((item) => item.id)).size).toBe(12)
    expect(new Set(LOOT_CATALOG.map((item) => item.name)).size).toBe(12)
  })

  it('covers every rarity with the expected distribution', () => {
    expect(lootByRarity('common')).toHaveLength(5)
    expect(lootByRarity('rare')).toHaveLength(4)
    expect(lootByRarity('epic')).toHaveLength(3)
    expect(lootByRarity('common').length + lootByRarity('rare').length + lootByRarity('epic').length).toBe(12)
  })

  it('contains only cosmetic fields', () => {
    for (const item of LOOT_CATALOG) {
      expect(Object.keys(item).sort()).toEqual(['description', 'id', 'name', 'rarity'])
      expect(item.description.length).toBeGreaterThan(10)
      expect(item.name.length).toBeGreaterThan(0)
    }
  })

  it('finds entries by id and rarity', () => {
    expect(findLootById('ember-flask')?.name).toBe('Ember Flask')
    expect(findLootById('missing')).toBeNull()
    expect(lootByRarity('epic').map((item) => item.id)).toEqual([
      'crown-of-the-quiet-spire',
      'moonlit-atlas',
      'unbroken-thread',
    ])
  })

  it('instantiates stable profile loot', () => {
    const entry = findLootById('silverbark-ring')
    expect(entry).not.toBeNull()
    if (!entry) return

    const item = createLootItem(entry, 'loot_instance_1', '2026-10-20T10:00:00.000Z')
    expect(item).toMatchObject({
      id: 'loot_instance_1',
      catalogId: 'silverbark-ring',
      name: 'Silverbark Ring',
      rarity: 'rare',
    })
    expect(createLootItemFromCatalog('missing', 'loot_x', item.obtainedAt)).toBeNull()
  })
})
