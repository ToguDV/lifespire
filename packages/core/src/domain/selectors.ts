import { XP_PER_LEVEL } from './balance.js'
import type { Day, GameMap, Goal, MapNode, NodeStatus, Run, RunObjective, Task } from './types.js'

/** Normalizes any counter to a finite, non-negative integer. */
export function safeCount(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.trunc(value))
}

export function levelForXp(xp: number): number {
  return Math.floor(safeCount(xp) / XP_PER_LEVEL) + 1
}

export function xpIntoLevel(xp: number): number {
  return safeCount(xp) % XP_PER_LEVEL
}

export function xpToNextLevel(xp: number): number {
  return XP_PER_LEVEL - xpIntoLevel(xp)
}

/** First day that is neither completed nor missed, or null for a closed run. */
export function currentDay(run: Run | null): Day | null {
  if (!run || run.status === 'closed') return null
  return run.days.find((day) => day.status !== 'completed' && day.status !== 'missed') ?? null
}

export function objectiveProgress(run: Run | null, goalId: string): RunObjective | null {
  if (!run) return null
  return run.objectives.find((objective) => objective.goalId === goalId) ?? null
}

/**
 * Weekly progress a completed node actually grants. Mirrors the lifecycle
 * rule: the node must reward progress, carry a task, and the task goal must
 * belong to the objective snapshot taken when the run started. Goals added
 * mid-run produce tasks but never weekly progress.
 */
export function nodeProgress(run: Run | null, node: MapNode): 0 | 1 {
  if (!run || node.rewards.progress !== 1 || !node.task) return 0
  const goalId = node.task.goalId
  return run.objectives.some((objective) => objective.goalId === goalId) ? 1 : 0
}

export function countActiveGoals(goals: readonly Goal[]): number {
  let total = 0
  for (const goal of goals) {
    if (goal.active) total += 1
  }
  return total
}

export function countActiveTasks(tasks: readonly Task[], goals?: readonly Goal[]): number {
  const activeGoalIds = goals
    ? new Set(goals.filter((goal) => goal.active).map((goal) => goal.id))
    : null
  let total = 0
  for (const task of tasks) {
    if (task.active && (!activeGoalIds || activeGoalIds.has(task.goalId))) {
      total += 1
    }
  }
  return total
}

/** Finds a decision or boss node by its stable id. */
export function resolveNodeById(map: GameMap, nodeId: string): MapNode | null {
  for (const layer of map.layers) {
    const node = layer.find((candidate) => candidate.id === nodeId)
    if (node) return node
  }
  return map.boss.id === nodeId ? map.boss : null
}

function resolvedEntry(day: Day, nodeId: string) {
  return day.path.find((entry) => entry.nodeId === nodeId)
}

/**
 * Nodes the player can choose right now. While a node is current it is the
 * only choice (the player must resolve it); otherwise the first layer or the
 * connections of the last resolved node are available.
 */
export function availableNodeIds(map: GameMap, day: Day): string[] {
  if (day.status !== 'in_progress' || !day.map) return []

  if (map.currentNodeId !== null) {
    const current = resolveNodeById(map, map.currentNodeId)
    if (!current || resolvedEntry(day, current.id)) return []
    return [current.id]
  }

  if (day.path.length === 0) {
    return (map.layers[0] ?? [])
      .filter((node) => !resolvedEntry(day, node.id))
      .map((node) => node.id)
  }

  const lastEntry = day.path[day.path.length - 1]
  if (!lastEntry) return []
  const lastNode = resolveNodeById(map, lastEntry.nodeId)
  if (!lastNode) return []

  return lastNode.connections.filter((nodeId) => {
    const node = resolveNodeById(map, nodeId)
    return node !== null && !resolvedEntry(day, nodeId)
  })
}

/** Resolved path entries win over the current selection. */
export function nodeStatus(map: GameMap, day: Day, nodeId: string): NodeStatus {
  const entry = resolvedEntry(day, nodeId)
  if (entry) return entry.action === 'complete' ? 'completed' : 'skipped'

  if (day.status === 'in_progress' && day.map && map.currentNodeId === nodeId) {
    return 'current'
  }
  if (availableNodeIds(map, day).includes(nodeId)) return 'available'
  return 'locked'
}
