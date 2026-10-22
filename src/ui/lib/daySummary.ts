import { resolveNodeById } from '../../domain/selectors'
import type {
  Day,
  LootItem,
  NodeType,
  ResolutionAction,
  RewardEvent,
} from '../../domain/types'
import { nodeTitle } from './nodeCopy'

export interface DayPathRow {
  nodeId: string
  type: NodeType
  title: string
  goalTitle: string | null
  action: ResolutionAction
  xp: number
  gold: number
  loot: LootItem | null
  duplicateGold: number
  closingBonus: boolean
}

/**
 * Joins the persisted path order with its reward events. Events are the source
 * of truth for actions and rewards, so the summary can never show more than was
 * actually granted (including a reload or a skipped boss).
 */
export function buildDayPath(day: Day): DayPathRow[] {
  return day.path.map((entry) => {
    const event = day.rewards.find((candidate) => candidate.nodeId === entry.nodeId)
    const node = day.map ? resolveNodeById(day.map, entry.nodeId) : null

    return {
      nodeId: entry.nodeId,
      type: event?.nodeType ?? node?.type ?? 'task',
      title: event?.taskTitle ?? (node ? nodeTitle(node) : 'An unnamed step'),
      goalTitle: event?.goalTitle ?? node?.task?.goalTitle ?? null,
      action: event?.action ?? entry.action,
      xp: event?.xp ?? 0,
      gold: event?.gold ?? 0,
      loot: event?.lootItem ?? null,
      duplicateGold: event?.duplicateGold ?? 0,
      closingBonus: event?.closingBonus ?? false,
    }
  })
}

/** Transient message shown after a node resolution, before leaving the screen. */
export function rewardFeedback(event: Pick<RewardEvent,
  'action' | 'xp' | 'gold' | 'lootItem' | 'duplicateGold' | 'duplicateCatalogId' | 'progress'
>): string {
  if (event.action === 'skip') {
    return 'Step skipped · no XP, gold, loot or weekly progress.'
  }

  const parts: string[] = ['Step kept']
  if (event.xp > 0) parts.push(`+${event.xp} XP`)
  if (event.gold > 0) parts.push(`+${event.gold} gold`)
  if (event.lootItem) parts.push(`found ${event.lootItem.name}`)
  if (event.duplicateCatalogId && event.duplicateGold > 0) {
    parts.push(`incl. +${event.duplicateGold} gold duplicate`)
  }
  if (event.progress > 0) parts.push('+1 toward weekly target')
  if (parts.length === 1) parts.push('the step is recorded')
  return parts.join(' · ')
}

/** A compact, human-readable reward line for one path row. */
export function dayPathReward(row: Pick<DayPathRow, 'action' | 'xp' | 'gold' | 'loot' | 'duplicateGold'>): string {
  if (row.action === 'skip') return 'No reward'
  const parts: string[] = []
  if (row.xp > 0) parts.push(`+${row.xp} XP`)
  if (row.gold > 0) parts.push(`+${row.gold} g`)
  if (row.loot) parts.push(row.loot.name)
  return parts.length > 0 ? parts.join(' · ') : 'No reward'
}

/** Text for the boss closing bonus block. */
export function closingBonusCopy(bossCompleted: boolean, bonusXp: number, bonusGold: number): string {
  if (!bossCompleted) return 'Forfeited'
  return `+${bonusXp} XP · +${bonusGold} gold`
}
