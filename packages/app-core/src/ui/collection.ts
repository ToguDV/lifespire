import { LOOT_CATALOG, findLootById } from '@lifespire/core'
import type { LootCatalogEntry } from '@lifespire/core'
import type { LootItem, Rarity, Run } from '@lifespire/core'

export type CollectionFilter = 'all' | Rarity

export interface CollectionEntry {
  catalog: LootCatalogEntry
  owned: LootItem | null
}

export interface CollectionFilterOption {
  filter: CollectionFilter
  label: string
  owned: number
  total: number
}

export interface DuplicateConversion {
  eventId: string
  catalogId: string
  name: string
  rarity: Rarity | null
  gold: number
  dayNumber: number
  date: string | null
  at: string
}

export const COLLECTION_FILTERS: readonly CollectionFilter[] = [
  'all',
  'common',
  'rare',
  'epic',
]

export const COLLECTION_FILTER_LABEL: Record<CollectionFilter, string> = {
  all: 'All',
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
}

/**
 * The complete twelve-entry catalogue in display order. Owned instances are
 * matched by `catalogId`; a profile can only hold one copy of each relic.
 */
export function buildCollection(loot: readonly LootItem[]): CollectionEntry[] {
  const ownedByCatalog = new Map<string, LootItem>()
  for (const item of loot) {
    if (!ownedByCatalog.has(item.catalogId)) {
      ownedByCatalog.set(item.catalogId, item)
    }
  }
  return LOOT_CATALOG.map((catalog) => ({
    catalog,
    owned: ownedByCatalog.get(catalog.id) ?? null,
  }))
}

export function filterCollection(
  entries: readonly CollectionEntry[],
  filter: CollectionFilter,
): CollectionEntry[] {
  if (filter === 'all') return [...entries]
  return entries.filter((entry) => entry.catalog.rarity === filter)
}

/** Counters for the All/Common/Rare/Epic filter bar. */
export function collectionFilterOptions(
  entries: readonly CollectionEntry[],
): CollectionFilterOption[] {
  return COLLECTION_FILTERS.map((filter) => {
    const scoped = filterCollection(entries, filter)
    return {
      filter,
      label: COLLECTION_FILTER_LABEL[filter],
      owned: scoped.filter((entry) => entry.owned !== null).length,
      total: scoped.length,
    }
  })
}

export function collectionOwnedCount(entries: readonly CollectionEntry[]): number {
  return entries.filter((entry) => entry.owned !== null).length
}

/**
 * Duplicate conversions are stored only as `RewardEvent`s inside the current
 * run. There is no cross-run history in the save, so this deliberately reads
 * one run and never invents past weeks.
 */
export function duplicateConversions(run: Run | null): DuplicateConversion[] {
  if (!run) return []

  const conversions: DuplicateConversion[] = []
  for (const day of run.days) {
    for (const event of day.rewards) {
      if (!event.duplicateCatalogId || event.duplicateGold <= 0) continue
      const catalog = findLootById(event.duplicateCatalogId)
      conversions.push({
        eventId: event.id,
        catalogId: event.duplicateCatalogId,
        name: catalog?.name ?? event.duplicateCatalogId,
        rarity: catalog?.rarity ?? null,
        gold: event.duplicateGold,
        dayNumber: event.dayIndex + 1,
        date: day.date,
        at: event.at,
      })
    }
  }
  return conversions
}

export function duplicateGoldTotal(conversions: readonly DuplicateConversion[]): number {
  return conversions.reduce((total, conversion) => total + conversion.gold, 0)
}
