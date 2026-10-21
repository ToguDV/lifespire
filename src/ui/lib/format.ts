import { parseDayKey } from '../../domain/dates'
import type { Effort, NodeType, Rarity } from '../../domain/types'
import type { IconName } from '../components/Icon'

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

export function romanDay(index: number): string {
  return ROMAN[index] ?? String(index + 1)
}

export function formatDayKey(key: string): string {
  try {
    const date = parseDayKey(key)
    const weekday = new Intl.DateTimeFormat('en', { weekday: 'long' }).format(date)
    const rest = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date)
    return `${weekday} · ${rest}`
  } catch {
    return key
  }
}

export function formatShortIsoDay(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date)
}

export function percent(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0
  return Math.min(100, Math.max(0, (value / max) * 100))
}

export const GOAL_ICONS: readonly IconName[] = ['banner', 'flame', 'quill', 'gem']

export function goalIcon(index: number): IconName {
  return GOAL_ICONS[index % GOAL_ICONS.length] ?? 'banner'
}

export const EFFORT_LABEL: Record<Effort, string> = {
  light: 'Light',
  medium: 'Medium',
  high: 'Heavy',
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
}

export const NODE_TYPE_LABEL: Record<NodeType, string> = {
  task: 'Task',
  elite: 'Elite',
  rest: 'Rest',
  treasure: 'Treasure',
  boss: 'Boss',
}

export const NODE_TYPE_ICON: Record<NodeType, IconName> = {
  task: 'scroll',
  elite: 'elite',
  rest: 'campfire',
  treasure: 'chest',
  boss: 'crown',
}

const LOOT_ICONS: Record<string, IconName> = {
  'wayfarers-compass': 'compass',
  'ember-flask': 'flame',
  'moth-wing-charm': 'feather',
  'river-pebble': 'gem',
  'ink-ribbon': 'scroll',
  'lantern-of-the-long-road': 'lantern',
  'silverbark-ring': 'ring',
  'high-pass-feather': 'feather',
  'hearthkeepers-cup': 'cup',
  'crown-of-the-quiet-spire': 'crown',
  'moonlit-atlas': 'map',
  'unbroken-thread': 'key',
}

export function lootIcon(catalogId: string): IconName {
  return LOOT_ICONS[catalogId] ?? 'gem'
}

export function rarityPips(rarity: Rarity): number {
  if (rarity === 'epic') return 3
  if (rarity === 'rare') return 2
  return 1
}
