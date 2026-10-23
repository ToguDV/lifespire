import { BOSS_CLOSING_BONUS } from '../../domain/balance'
import type { MapNode, NodeStatus } from '../../domain/types'
import { EFFORT_LABEL, NODE_TYPE_LABEL } from './format'

export interface NodeViewCopy {
  title: string
  typeLine: string
  flavor: string
  mapHint: string
  rewardLine: string
}

const FLAVOR: Record<MapNode['type'], string> = {
  task: 'The trail asks for one honest step. The week grows by what you keep, not by what you plan.',
  elite: 'A harder climb, and a richer prize. The trail will not ask twice.',
  rest: 'Not every step is a climb. Let the fire burn low and take what quiet gives.',
  treasure: 'A cache left by another traveller. It asks nothing of the week.',
  wheel: 'A turn of fate. It may ask for a task, or simply give.',
  boss: 'The gate of the day. Finish here and the week takes its shape.',
}

const REST_TITLE = 'A quiet rest'
const TREASURE_TITLE = 'A hidden cache'
const WHEEL_TITLE = 'A turn of the wheel'

export function nodeTitle(node: MapNode): string {
  if (node.task) return node.task.title
  if (node.type === 'treasure') return TREASURE_TITLE
  if (node.type === 'wheel') return WHEEL_TITLE
  return REST_TITLE
}

export function nodeTypeLine(node: MapNode): string {
  const type = NODE_TYPE_LABEL[node.type]
  if (node.type === 'rest' || node.type === 'treasure' || node.type === 'wheel') {
    return `${type} node · no task`
  }
  const effort = node.task ? EFFORT_LABEL[node.task.effort] : 'Unknown'
  return `${type} node · ${effort} effort`
}

export function nodeFlavor(node: MapNode): string {
  return FLAVOR[node.type]
}

function pluralRolls(count: number): string {
  return `${count} loot roll${count === 1 ? '' : 's'}`
}

export function nodeRewardLine(node: MapNode): string {
  if (node.type === 'wheel') return 'A surprise: task, gold, XP or rest'
  const parts: string[] = []
  if (node.rewards.xp > 0) parts.push(`+${node.rewards.xp} XP`)
  if (node.rewards.gold > 0) parts.push(`+${node.rewards.gold} gold`)
  if (node.rewards.lootRolls > 0) parts.push(pluralRolls(node.rewards.lootRolls))
  if (node.rewards.progress > 0) parts.push('+1 toward weekly target')
  if (node.type === 'boss') parts.push('closing bonus')
  return parts.join(' · ')
}

export function nodeRewardSummary(node: MapNode): string {
  const parts: string[] = []
  if (node.rewards.xp > 0) parts.push(`plus ${node.rewards.xp} experience`)
  if (node.rewards.gold > 0) parts.push(`plus ${node.rewards.gold} gold`)
  if (node.rewards.lootRolls > 0) parts.push(pluralRolls(node.rewards.lootRolls))
  if (node.rewards.progress > 0) parts.push('plus one toward the weekly target')
  if (node.type === 'boss') {
    parts.push(
      `includes a closing bonus of ${BOSS_CLOSING_BONUS.xp} experience and ${BOSS_CLOSING_BONUS.gold} gold`,
    )
  }
  return parts.join(', ')
}

export function nodeAriaLabel(node: MapNode, status: NodeStatus): string {
  const type = NODE_TYPE_LABEL[node.type].toLowerCase()
  const title = nodeTitle(node)

  if (status === 'completed' || status === 'skipped') {
    const goal = node.task ? ` for ${node.task.goalTitle}` : ''
    return `${title}, ${type} node, ${status}${goal}.`
  }

  if (status === 'locked' && node.type !== 'boss') {
    return `A veiled ${type} node, locked.`
  }

  const reward = nodeRewardSummary(node)
  if (status === 'current') {
    return `${title}, ${type} node, ${reward}. Current step. Open details.`
  }
  if (status === 'available') {
    return `${title}, ${type} node, ${reward}. Open details.`
  }
  return `${title}, ${type} node, locked.`
}

export function effortNote(node: MapNode): string {
  if (!node.task) return 'No task is attached'
  if (node.task.effort === 'light') return '1 of 3 · gentle'
  if (node.task.effort === 'medium') return '2 of 3 · steady'
  return '3 of 3 · demanding'
}
