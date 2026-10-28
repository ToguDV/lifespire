import type { GoalIconId } from './goalIcons.js'

export type Effort = 'light' | 'medium' | 'high'
export type NodeType = 'task' | 'elite' | 'rest' | 'treasure' | 'boss' | 'wheel'
export type WheelOutcome = 'task' | 'gold' | 'xp' | 'rest'
export type Rarity = 'common' | 'rare' | 'epic'
export type DayStatus = 'locked' | 'available' | 'in_progress' | 'completed' | 'missed'
export type RunStatus = 'active' | 'closed'
export type ResolutionAction = 'complete' | 'skip'
export type NodeStatus = 'locked' | 'available' | 'current' | 'completed' | 'skipped'
export type ThemePreference = 'light' | 'dark' | 'system'

export type View =
  | { name: 'onboarding' }
  | { name: 'home' }
  | { name: 'map' }
  | { name: 'node'; nodeId: string }
  | { name: 'reward'; nodeId: string }
  | { name: 'day-summary'; dayId: string }
  | { name: 'run-summary' }
  | { name: 'goals' }
  | { name: 'profile' }
  | { name: 'settings' }
  | { name: 'recovery'; reason: 'corrupt' | 'future-version' | 'import-error' }

export interface GameDocument {
  schemaVersion: 4
  profile: Profile | null
  goals: Goal[]
  tasks: Task[]
  run: Run | null
  onboardingDraft: OnboardingDraft | null
  settings: { theme: ThemePreference }
}

export interface Profile {
  id: string
  name: string
  xp: number
  level: number
  gold: number
  loot: LootItem[]
  createdAt: string
}

export interface LootItem {
  id: string
  catalogId: string
  name: string
  rarity: Rarity
  description: string
  obtainedAt: string
}

export interface Goal {
  id: string
  title: string
  category: string
  description: string
  icon: GoalIconId
  weeklyObjective: number
  active: boolean
  createdAt: string
}

export type GoalInput = Pick<
  Goal,
  'title' | 'category' | 'weeklyObjective' | 'active'
> &
  Partial<Pick<Goal, 'id' | 'createdAt' | 'icon' | 'description' | 'category'>>

export interface Task {
  id: string
  goalId: string
  title: string
  effort: Effort
  active: boolean
  createdAt: string
}

export type TaskInput = Pick<Task, 'goalId' | 'title' | 'effort' | 'active'> &
  Partial<Pick<Task, 'id' | 'createdAt'>>

export interface TaskSnapshot {
  taskId: string
  title: string
  goalId: string
  goalTitle: string
  effort: Effort
}

export interface NodeRewards {
  xp: number
  gold: number
  lootRolls: number
  progress: 0 | 1
}

export interface MapNode {
  id: string
  layer: number
  type: NodeType
  task: TaskSnapshot | null
  rewards: NodeRewards
  connections: string[]
}

export interface GameMap {
  id: string
  seed: string
  dayIndex: number
  generatorVersion: number
  layers: MapNode[][]
  boss: MapNode
  currentNodeId: string | null
  createdAt: string
}

export interface ResolvedNode {
  nodeId: string
  action: ResolutionAction
  at: string
}

export interface RewardEvent {
  id: string
  dayIndex: number
  nodeId: string
  nodeType: NodeType
  action: ResolutionAction
  taskId: string | null
  taskTitle: string | null
  goalId: string | null
  goalTitle: string | null
  xp: number
  gold: number
  progress: number
  lootItem: LootItem | null
  duplicateCatalogId: string | null
  duplicateGold: number
  closingBonus: boolean
  wheelOutcome?: WheelOutcome | null
  at: string
}

export interface DaySummary {
  xp: number
  gold: number
  loot: LootItem[]
  duplicateGold: number
  bossCompleted: boolean
  closingBonusXp: number
  closingBonusGold: number
  completed: number
  skipped: number
  objectives: Array<{ goalId: string; title: string; before: number; after: number; target: number }>
}

export interface Day {
  id: string
  index: number
  date: string
  status: DayStatus
  map: GameMap | null
  path: ResolvedNode[]
  rewards: RewardEvent[]
  openedAt: string | null
  closedAt: string | null
  summary: DaySummary | null
}

export interface RunObjective {
  goalId: string
  goalTitle: string
  target: number
  progress: number
}

export interface RunTotals {
  xp: number
  gold: number
  lootCount: number
  nodesCompleted: number
  nodesSkipped: number
  daysPlayed: number
  daysMissed: number
}

export interface RunSummary {
  closedAt: string
  objectives: Array<{
    goalId: string
    title: string
    target: number
    progress: number
    met: boolean
    bonusXp: number
    bonusGold: number
    loot: LootItem[]
  }>
  allComplete: boolean
  bonusXp: number
  bonusGold: number
  loot: LootItem[]
  duplicateGold: number
  guaranteedRare: LootItem | null
  totals: RunTotals
}

export interface Run {
  id: string
  seed: string
  generatorVersion: number
  startDate: string
  /** IANA zone the run's day boundaries are computed in; null = legacy device-local runs. */
  timeZone: string | null
  status: RunStatus
  objectives: RunObjective[]
  days: Day[]
  totals: RunTotals
  createdAt: string
  closedAt: string | null
  summary: RunSummary | null
}

export interface OnboardingDraft {
  step: number
  mode: 'demo' | 'custom' | null
  name: string
  goals: Goal[]
  tasks: Task[]
}

export interface OnboardingSetup {
  name: string
  goals: Goal[]
  tasks: Task[]
}

export interface RunSetup {
  goals: Goal[]
  tasks: Task[]
}

export interface StorageIssue {
  reason: 'corrupt' | 'future-version'
}
