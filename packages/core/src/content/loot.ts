import type { LootItem, Rarity } from '../domain/types'

export interface LootCatalogEntry {
  id: string
  name: string
  rarity: Rarity
  description: string
}

/** Twelve original collectibles with no mechanical effects. */
export const LOOT_CATALOG: readonly LootCatalogEntry[] = [
  {
    id: 'wayfarers-compass',
    name: "Wayfarer's Compass",
    rarity: 'common',
    description: 'A worn brass needle that swings toward the next bend in the road.',
  },
  {
    id: 'ember-flask',
    name: 'Ember Flask',
    rarity: 'common',
    description: 'A clay flask that keeps a coal warm long after the fire has died.',
  },
  {
    id: 'moth-wing-charm',
    name: 'Moth-Wing Charm',
    rarity: 'common',
    description: 'A pale wing pressed in glass, still turning toward the light.',
  },
  {
    id: 'river-pebble',
    name: 'River Pebble',
    rarity: 'common',
    description: 'A smooth grey stone that has outlasted every hand that held it.',
  },
  {
    id: 'ink-ribbon',
    name: 'Ink-Stained Ribbon',
    rarity: 'common',
    description: 'A frayed ribbon marking the page where a long letter paused.',
  },
  {
    id: 'lantern-of-the-long-road',
    name: 'Lantern of the Long Road',
    rarity: 'rare',
    description: 'Its small flame never hurries, yet it outlasts the longest night.',
  },
  {
    id: 'silverbark-ring',
    name: 'Silverbark Ring',
    rarity: 'rare',
    description: 'Carved from a fallen branch, it keeps the scent of rain and cedar.',
  },
  {
    id: 'high-pass-feather',
    name: 'Feather of the High Pass',
    rarity: 'rare',
    description: 'A grey feather found above the treeline, light enough to ride the wind.',
  },
  {
    id: 'hearthkeepers-cup',
    name: "Hearthkeeper's Cup",
    rarity: 'rare',
    description: 'A chipped cup that always seems to hold one more measure of tea.',
  },
  {
    id: 'crown-of-the-quiet-spire',
    name: 'Crown of the Quiet Spire',
    rarity: 'epic',
    description: 'A circlet of blackened silver, worn by those who climb without noise.',
  },
  {
    id: 'moonlit-atlas',
    name: 'Moonlit Atlas',
    rarity: 'epic',
    description: 'Its maps redraw themselves in moonlight, though never toward an easier road.',
  },
  {
    id: 'unbroken-thread',
    name: 'The Unbroken Thread',
    rarity: 'epic',
    description: 'A single silver thread, warm to the touch, linking one promise to the next.',
  },
]

export function findLootById(catalogId: string): LootCatalogEntry | null {
  return LOOT_CATALOG.find((entry) => entry.id === catalogId) ?? null
}

export function lootByRarity(rarity: Rarity): LootCatalogEntry[] {
  return LOOT_CATALOG.filter((entry) => entry.rarity === rarity)
}

/** Builds a profile loot instance from a catalog entry. */
export function createLootItem(
  entry: LootCatalogEntry,
  id: string,
  obtainedAt: string,
): LootItem {
  return {
    id,
    catalogId: entry.id,
    name: entry.name,
    rarity: entry.rarity,
    description: entry.description,
    obtainedAt,
  }
}

export function createLootItemFromCatalog(
  catalogId: string,
  id: string,
  obtainedAt: string,
): LootItem | null {
  const entry = findLootById(catalogId)
  return entry ? createLootItem(entry, id, obtainedAt) : null
}
