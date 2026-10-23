import {
  MAX_DECISION_LAYERS,
  MAX_WEEKLY_OBJECTIVE,
  MIN_DECISION_LAYERS,
  RUN_DAYS,
  SCHEMA_VERSION,
} from './balance'
import { isDayKey } from './dates'
import { GOAL_ICON_IDS, isGoalIconId, legacyGoalIcon } from './goalIcons'
import type { GoalIconId } from './goalIcons'
import { validateMap } from './generator'
import type {
  Day,
  DaySummary,
  GameDocument,
  GameMap,
  Goal,
  LootItem,
  MapNode,
  NodeRewards,
  OnboardingDraft,
  Profile,
  Rarity,
  ResolutionAction,
  ResolvedNode,
  RewardEvent,
  Run,
  RunObjective,
  RunSummary,
  RunTotals,
  Task,
  TaskSnapshot,
  ThemePreference,
} from './types'

export interface SchemaSuccess {
  ok: true
  value: GameDocument
}

export interface SchemaFailure {
  ok: false
  reason: 'invalid' | 'future-version'
  error: string
}

export type SchemaResult = SchemaSuccess | SchemaFailure

type RawObject = Record<string, unknown>
type Migration = (document: RawObject) => RawObject

/** Entry point for future schema upgrades. Version 2 persists goal icons. */
const MIGRATIONS: Partial<Record<number, Migration>> = {
  1: migrateV1ToV2,
}

function migrateV1ToV2(document: RawObject): RawObject {
  return {
    ...document,
    schemaVersion: 2,
    goals: withMigratedGoalIcons(document.goals),
    onboardingDraft: withMigratedDraftIcons(document.onboardingDraft),
  }
}

/**
 * Version 1 derived goal crests from their index. The migration keeps that
 * cycle so existing saves look the same, then the icon becomes editable data.
 * It uses the full goals array, matching the weekly rail's v1 index (the goals
 * screen used the active-goal index, so the two could already disagree).
 */
function withMigratedGoalIcons(value: unknown): unknown {
  if (!Array.isArray(value)) return value
  return value.map((goal, index) => {
    if (!isRecord(goal)) return goal
    if (isGoalIconId(goal.icon)) return goal
    return { ...goal, icon: legacyGoalIcon(index) }
  })
}

function withMigratedDraftIcons(value: unknown): unknown {
  if (!isRecord(value)) return value
  return { ...value, goals: withMigratedGoalIcons(value.goals) }
}

const EFFORTS = ['light', 'medium', 'high'] as const
const NODE_TYPES = ['task', 'elite', 'rest', 'treasure', 'boss'] as const
const RARITIES = ['common', 'rare', 'epic'] as const
const DAY_STATUSES = ['locked', 'available', 'in_progress', 'completed', 'missed'] as const
const RUN_STATUSES = ['active', 'closed'] as const
const ACTIONS = ['complete', 'skip'] as const
const THEMES = ['light', 'dark', 'system'] as const
const DRAFT_MODES = ['demo', 'custom'] as const

export function createEmptyDocument(): GameDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: null,
    goals: [],
    tasks: [],
    run: null,
    onboardingDraft: null,
    settings: { theme: 'system' },
  }
}

/** Same versioned document as persistence, readable for export. */
export function serializeDocument(document: GameDocument): string {
  return JSON.stringify(document, null, 2)
}

/** Validates and deserializes a document from JSON text or an unknown value. */
export function parseDocument(input: unknown): SchemaResult {
  return migrateDocument(input)
}

/**
 * Applies migrations one version at a time, then validates the current shape.
 * Version 1 saves are upgraded by `MIGRATIONS[1]`; future bumps add an entry.
 */
export function migrateDocument(input: unknown): SchemaResult {
  const raw = readObject(input)
  if (!raw.ok) return raw

  const version = raw.value.schemaVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return failure('invalid', 'The save file is missing a valid schema version.')
  }
  if (version > SCHEMA_VERSION) {
    return failure(
      'future-version',
      `This save uses schema version ${version}; this app supports version ${SCHEMA_VERSION}.`,
    )
  }

  let current = raw.value
  for (let from = version; from < SCHEMA_VERSION; from += 1) {
    const migration = MIGRATIONS[from]
    if (!migration) {
      return failure('invalid', `No migration is available from schema version ${from}.`)
    }
    current = migration(current)
  }

  try {
    return { ok: true, value: validateDocument(current) }
  } catch (error) {
    return failure('invalid', error instanceof Error ? error.message : 'The save file is not valid.')
  }
}

function failure(reason: SchemaFailure['reason'], error: string): SchemaFailure {
  return { ok: false, reason, error }
}

function readObject(input: unknown): { ok: true; value: RawObject } | SchemaFailure {
  if (typeof input === 'string') {
    try {
      return readObject(JSON.parse(input) as unknown)
    } catch {
      return failure('invalid', 'The file does not contain valid JSON.')
    }
  }
  if (!isRecord(input)) {
    return failure('invalid', 'The document must be a JSON object.')
  }
  return { ok: true, value: input }
}

function isRecord(value: unknown): value is RawObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(path: string, message: string): never {
  throw new Error(`${path}: ${message}`)
}

function expectRecord(value: unknown, path: string): RawObject {
  if (!isRecord(value)) fail(path, 'must be an object')
  return value
}

function expectArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'must be an array')
  return value
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, 'must be a string')
  return value
}

function expectBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, 'must be a boolean')
  return value
}

function expectInteger(value: unknown, path: string, min = 0): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    fail(path, `must be an integer greater than or equal to ${min}`)
  }
  return value
}

function expectEnum<T extends string>(value: unknown, path: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    fail(path, `must be one of: ${allowed.join(', ')}`)
  }
  return value as T
}

function expectNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(path, 'must be a finite number')
  }
  return value
}

function expectNullableString(value: unknown, path: string): string | null {
  return value === null ? null : expectString(value, path)
}

function validateDocument(raw: RawObject): GameDocument {
  if (raw.schemaVersion !== SCHEMA_VERSION) {
    fail('schemaVersion', `must be ${SCHEMA_VERSION}`)
  }

  const profile = raw.profile === null ? null : validateProfile(raw.profile, 'profile')
  const goals = expectArray(raw.goals, 'goals').map((goal, index) =>
    validateGoal(goal, `goals[${index}]`),
  )
  const tasks = expectArray(raw.tasks, 'tasks').map((task, index) =>
    validateTask(task, `tasks[${index}]`),
  )
  const run = raw.run === null ? null : validateRun(raw.run, 'run')
  const onboardingDraft =
    raw.onboardingDraft === null
      ? null
      : validateOnboardingDraft(raw.onboardingDraft, 'onboardingDraft')

  const settings = expectRecord(raw.settings, 'settings')
  const theme = expectEnum<ThemePreference>(settings.theme, 'settings.theme', THEMES)

  return {
    schemaVersion: SCHEMA_VERSION,
    profile,
    goals,
    tasks,
    run,
    onboardingDraft,
    settings: { theme },
  }
}

function validateProfile(value: unknown, path: string): Profile {
  const raw = expectRecord(value, path)
  return {
    id: expectString(raw.id, `${path}.id`),
    name: expectString(raw.name, `${path}.name`),
    xp: expectInteger(raw.xp, `${path}.xp`),
    level: expectInteger(raw.level, `${path}.level`, 1),
    gold: expectInteger(raw.gold, `${path}.gold`),
    loot: expectArray(raw.loot, `${path}.loot`).map((item, index) =>
      validateLootItem(item, `${path}.loot[${index}]`),
    ),
    createdAt: expectString(raw.createdAt, `${path}.createdAt`),
  }
}

function validateLootItem(value: unknown, path: string): LootItem {
  const raw = expectRecord(value, path)
  return {
    id: expectString(raw.id, `${path}.id`),
    catalogId: expectString(raw.catalogId, `${path}.catalogId`),
    name: expectString(raw.name, `${path}.name`),
    rarity: expectEnum<Rarity>(raw.rarity, `${path}.rarity`, RARITIES),
    description: expectString(raw.description, `${path}.description`),
    obtainedAt: expectString(raw.obtainedAt, `${path}.obtainedAt`),
  }
}

function validateGoal(value: unknown, path: string): Goal {
  const raw = expectRecord(value, path)
  const weeklyObjective = expectInteger(raw.weeklyObjective, `${path}.weeklyObjective`, 1)
  if (weeklyObjective > MAX_WEEKLY_OBJECTIVE) {
    fail(`${path}.weeklyObjective`, `must be at most ${MAX_WEEKLY_OBJECTIVE}`)
  }
  return {
    id: expectString(raw.id, `${path}.id`),
    title: expectString(raw.title, `${path}.title`),
    category: expectString(raw.category, `${path}.category`),
    icon: expectEnum<GoalIconId>(raw.icon, `${path}.icon`, GOAL_ICON_IDS),
    weeklyObjective,
    active: expectBoolean(raw.active, `${path}.active`),
    createdAt: expectString(raw.createdAt, `${path}.createdAt`),
  }
}

function validateTask(value: unknown, path: string): Task {
  const raw = expectRecord(value, path)
  return {
    id: expectString(raw.id, `${path}.id`),
    goalId: expectString(raw.goalId, `${path}.goalId`),
    title: expectString(raw.title, `${path}.title`),
    effort: expectEnum(raw.effort, `${path}.effort`, EFFORTS),
    active: expectBoolean(raw.active, `${path}.active`),
    createdAt: expectString(raw.createdAt, `${path}.createdAt`),
  }
}

function validateTaskSnapshot(value: unknown, path: string): TaskSnapshot {
  const raw = expectRecord(value, path)
  return {
    taskId: expectString(raw.taskId, `${path}.taskId`),
    title: expectString(raw.title, `${path}.title`),
    goalId: expectString(raw.goalId, `${path}.goalId`),
    goalTitle: expectString(raw.goalTitle, `${path}.goalTitle`),
    effort: expectEnum(raw.effort, `${path}.effort`, EFFORTS),
  }
}

function validateNodeRewards(value: unknown, path: string): NodeRewards {
  const raw = expectRecord(value, path)
  const progress = expectInteger(raw.progress, `${path}.progress`)
  if (progress !== 0 && progress !== 1) {
    fail(`${path}.progress`, 'must be 0 or 1')
  }
  return {
    xp: expectInteger(raw.xp, `${path}.xp`),
    gold: expectInteger(raw.gold, `${path}.gold`),
    lootRolls: expectInteger(raw.lootRolls, `${path}.lootRolls`),
    progress,
  }
}

function validateMapNode(value: unknown, path: string): MapNode {
  const raw = expectRecord(value, path)
  return {
    id: expectString(raw.id, `${path}.id`),
    layer: expectInteger(raw.layer, `${path}.layer`),
    type: expectEnum(raw.type, `${path}.type`, NODE_TYPES),
    task: raw.task === null ? null : validateTaskSnapshot(raw.task, `${path}.task`),
    rewards: validateNodeRewards(raw.rewards, `${path}.rewards`),
    connections: expectArray(raw.connections, `${path}.connections`).map((id, index) =>
      expectString(id, `${path}.connections[${index}]`),
    ),
  }
}

function validateGameMap(value: unknown, path: string): GameMap {
  const raw = expectRecord(value, path)
  const layers = expectArray(raw.layers, `${path}.layers`)
  if (layers.length < MIN_DECISION_LAYERS || layers.length > MAX_DECISION_LAYERS) {
    fail(
      `${path}.layers`,
      `must contain ${MIN_DECISION_LAYERS}–${MAX_DECISION_LAYERS} decision layers`,
    )
  }
  const dayIndex = expectInteger(raw.dayIndex, `${path}.dayIndex`)
  if (dayIndex >= RUN_DAYS) {
    fail(`${path}.dayIndex`, `must be lower than ${RUN_DAYS}`)
  }
  const boss = validateMapNode(raw.boss, `${path}.boss`)
  if (boss.layer !== layers.length) {
    fail(`${path}.boss.layer`, `must match the ${layers.length} decision layers`)
  }
  return {
    id: expectString(raw.id, `${path}.id`),
    seed: expectString(raw.seed, `${path}.seed`),
    dayIndex,
    generatorVersion: expectInteger(raw.generatorVersion, `${path}.generatorVersion`, 1),
    layers: layers.map((layer, index) =>
      expectArray(layer, `${path}.layers[${index}]`).map((node, nodeIndex) =>
        validateMapNode(node, `${path}.layers[${index}][${nodeIndex}]`),
      ),
    ),
    boss,
    currentNodeId: expectNullableString(raw.currentNodeId, `${path}.currentNodeId`),
    createdAt: expectString(raw.createdAt, `${path}.createdAt`),
  }
}

function validateResolvedNode(value: unknown, path: string): ResolvedNode {
  const raw = expectRecord(value, path)
  return {
    nodeId: expectString(raw.nodeId, `${path}.nodeId`),
    action: expectEnum<ResolutionAction>(raw.action, `${path}.action`, ACTIONS),
    at: expectString(raw.at, `${path}.at`),
  }
}

function validateRewardEvent(value: unknown, path: string): RewardEvent {
  const raw = expectRecord(value, path)
  const dayIndex = expectInteger(raw.dayIndex, `${path}.dayIndex`)
  if (dayIndex >= RUN_DAYS) {
    fail(`${path}.dayIndex`, `must be lower than ${RUN_DAYS}`)
  }
  return {
    id: expectString(raw.id, `${path}.id`),
    dayIndex,
    nodeId: expectString(raw.nodeId, `${path}.nodeId`),
    nodeType: expectEnum(raw.nodeType, `${path}.nodeType`, NODE_TYPES),
    action: expectEnum<ResolutionAction>(raw.action, `${path}.action`, ACTIONS),
    taskId: expectNullableString(raw.taskId, `${path}.taskId`),
    taskTitle: expectNullableString(raw.taskTitle, `${path}.taskTitle`),
    goalId: expectNullableString(raw.goalId, `${path}.goalId`),
    goalTitle: expectNullableString(raw.goalTitle, `${path}.goalTitle`),
    xp: expectInteger(raw.xp, `${path}.xp`),
    gold: expectInteger(raw.gold, `${path}.gold`),
    progress: expectInteger(raw.progress, `${path}.progress`),
    lootItem: raw.lootItem === null ? null : validateLootItem(raw.lootItem, `${path}.lootItem`),
    duplicateCatalogId: expectNullableString(
      raw.duplicateCatalogId,
      `${path}.duplicateCatalogId`,
    ),
    duplicateGold: expectInteger(raw.duplicateGold, `${path}.duplicateGold`),
    closingBonus: expectBoolean(raw.closingBonus, `${path}.closingBonus`),
    at: expectString(raw.at, `${path}.at`),
  }
}

function validateDaySummary(value: unknown, path: string): DaySummary {
  const raw = expectRecord(value, path)
  return {
    xp: expectInteger(raw.xp, `${path}.xp`),
    gold: expectInteger(raw.gold, `${path}.gold`),
    loot: expectArray(raw.loot, `${path}.loot`).map((item, index) =>
      validateLootItem(item, `${path}.loot[${index}]`),
    ),
    duplicateGold: expectInteger(raw.duplicateGold, `${path}.duplicateGold`),
    bossCompleted: expectBoolean(raw.bossCompleted, `${path}.bossCompleted`),
    closingBonusXp: expectInteger(raw.closingBonusXp, `${path}.closingBonusXp`),
    closingBonusGold: expectInteger(raw.closingBonusGold, `${path}.closingBonusGold`),
    completed: expectInteger(raw.completed, `${path}.completed`),
    skipped: expectInteger(raw.skipped, `${path}.skipped`),
    objectives: expectArray(raw.objectives, `${path}.objectives`).map((objective, index) => {
      const item = expectRecord(objective, `${path}.objectives[${index}]`)
      return {
        goalId: expectString(item.goalId, `${path}.objectives[${index}].goalId`),
        title: expectString(item.title, `${path}.objectives[${index}].title`),
        before: expectInteger(item.before, `${path}.objectives[${index}].before`),
        after: expectInteger(item.after, `${path}.objectives[${index}].after`),
        target: expectInteger(item.target, `${path}.objectives[${index}].target`, 1),
      }
    }),
  }
}

function validateDay(value: unknown, path: string): Day {
  const raw = expectRecord(value, path)
  const index = expectInteger(raw.index, `${path}.index`)
  if (index >= RUN_DAYS) {
    fail(`${path}.index`, `must be lower than ${RUN_DAYS}`)
  }
  const date = expectString(raw.date, `${path}.date`)
  if (!isDayKey(date)) {
    fail(`${path}.date`, 'must be a valid YYYY-MM-DD date')
  }
  return {
    id: expectString(raw.id, `${path}.id`),
    index,
    date,
    status: expectEnum(raw.status, `${path}.status`, DAY_STATUSES),
    map: raw.map === null ? null : validateGameMap(raw.map, `${path}.map`),
    path: expectArray(raw.path, `${path}.path`).map((entry, entryIndex) =>
      validateResolvedNode(entry, `${path}.path[${entryIndex}]`),
    ),
    rewards: expectArray(raw.rewards, `${path}.rewards`).map((event, eventIndex) =>
      validateRewardEvent(event, `${path}.rewards[${eventIndex}]`),
    ),
    openedAt: expectNullableString(raw.openedAt, `${path}.openedAt`),
    closedAt: expectNullableString(raw.closedAt, `${path}.closedAt`),
    summary: raw.summary === null ? null : validateDaySummary(raw.summary, `${path}.summary`),
  }
}

function validateRunObjective(value: unknown, path: string): RunObjective {
  const raw = expectRecord(value, path)
  const target = expectInteger(raw.target, `${path}.target`, 1)
  if (target > MAX_WEEKLY_OBJECTIVE) {
    fail(`${path}.target`, `must be at most ${MAX_WEEKLY_OBJECTIVE}`)
  }
  return {
    goalId: expectString(raw.goalId, `${path}.goalId`),
    goalTitle: expectString(raw.goalTitle, `${path}.goalTitle`),
    target,
    progress: expectInteger(raw.progress, `${path}.progress`),
  }
}

function validateRunTotals(value: unknown, path: string): RunTotals {
  const raw = expectRecord(value, path)
  return {
    xp: expectInteger(raw.xp, `${path}.xp`),
    gold: expectInteger(raw.gold, `${path}.gold`),
    lootCount: expectInteger(raw.lootCount, `${path}.lootCount`),
    nodesCompleted: expectInteger(raw.nodesCompleted, `${path}.nodesCompleted`),
    nodesSkipped: expectInteger(raw.nodesSkipped, `${path}.nodesSkipped`),
    daysPlayed: expectInteger(raw.daysPlayed, `${path}.daysPlayed`),
    daysMissed: expectInteger(raw.daysMissed, `${path}.daysMissed`),
  }
}

function validateRunSummary(value: unknown, path: string): RunSummary {
  const raw = expectRecord(value, path)
  return {
    closedAt: expectString(raw.closedAt, `${path}.closedAt`),
    objectives: expectArray(raw.objectives, `${path}.objectives`).map((objective, index) => {
      const item = expectRecord(objective, `${path}.objectives[${index}]`)
      return {
        goalId: expectString(item.goalId, `${path}.objectives[${index}].goalId`),
        title: expectString(item.title, `${path}.objectives[${index}].title`),
        target: expectInteger(item.target, `${path}.objectives[${index}].target`, 1),
        progress: expectInteger(item.progress, `${path}.objectives[${index}].progress`),
        met: expectBoolean(item.met, `${path}.objectives[${index}].met`),
        bonusXp: expectInteger(item.bonusXp, `${path}.objectives[${index}].bonusXp`),
        bonusGold: expectInteger(item.bonusGold, `${path}.objectives[${index}].bonusGold`),
        loot: expectArray(item.loot, `${path}.objectives[${index}].loot`).map((loot, lootIndex) =>
          validateLootItem(loot, `${path}.objectives[${index}].loot[${lootIndex}]`),
        ),
      }
    }),
    allComplete: expectBoolean(raw.allComplete, `${path}.allComplete`),
    bonusXp: expectInteger(raw.bonusXp, `${path}.bonusXp`),
    bonusGold: expectInteger(raw.bonusGold, `${path}.bonusGold`),
    loot: expectArray(raw.loot, `${path}.loot`).map((item, index) =>
      validateLootItem(item, `${path}.loot[${index}]`),
    ),
    duplicateGold: expectInteger(raw.duplicateGold, `${path}.duplicateGold`),
    guaranteedRare:
      raw.guaranteedRare === null
        ? null
        : validateLootItem(raw.guaranteedRare, `${path}.guaranteedRare`),
    totals: validateRunTotals(raw.totals, `${path}.totals`),
  }
}

function validateRun(value: unknown, path: string): Run {
  const raw = expectRecord(value, path)
  const startDate = expectString(raw.startDate, `${path}.startDate`)
  if (!isDayKey(startDate)) {
    fail(`${path}.startDate`, 'must be a valid YYYY-MM-DD date')
  }
  const days = expectArray(raw.days, `${path}.days`)
  if (days.length !== RUN_DAYS) {
    fail(`${path}.days`, `must contain ${RUN_DAYS} days`)
  }
  const run: Run = {
    id: expectString(raw.id, `${path}.id`),
    seed: expectString(raw.seed, `${path}.seed`),
    generatorVersion: expectInteger(raw.generatorVersion, `${path}.generatorVersion`, 1),
    startDate,
    status: expectEnum(raw.status, `${path}.status`, RUN_STATUSES),
    objectives: expectArray(raw.objectives, `${path}.objectives`).map((objective, index) =>
      validateRunObjective(objective, `${path}.objectives[${index}]`),
    ),
    days: days.map((day, index) => validateDay(day, `${path}.days[${index}]`)),
    totals: validateRunTotals(raw.totals, `${path}.totals`),
    createdAt: expectString(raw.createdAt, `${path}.createdAt`),
    closedAt: expectNullableString(raw.closedAt, `${path}.closedAt`),
    summary: raw.summary === null ? null : validateRunSummary(raw.summary, `${path}.summary`),
  }

  validateRunIntegrity(run, path)
  return run
}

/**
 * Cross-checks a structurally valid run against itself. A document can pass
 * the field schema and still be unplayable (maps from another day or run,
 * paths pointing at nodes that do not exist), so imports would otherwise
 * accept a save that bricks the next action.
 */
function validateRunIntegrity(run: Run, path: string): void {
  run.days.forEach((day, dayIndex) => {
    const dayPath = `${path}.days[${dayIndex}]`
    const expectedId = `${run.id}:day:${day.index}`
    if (day.id !== expectedId) {
      fail(`${dayPath}.id`, `must belong to this run ("${expectedId}")`)
    }
    if (!day.map) return

    if (day.map.dayIndex !== day.index) {
      fail(`${dayPath}.map.dayIndex`, `must match the day index ${day.index}`)
    }

    const mapValidation = validateMap(day.map)
    if (!mapValidation.ok) {
      fail(`${dayPath}.map`, mapValidation.errors[0] ?? 'is not a playable map')
    }

    const nodeIds = new Set<string>([
      ...day.map.layers.flat().map((node) => node.id),
      day.map.boss.id,
    ])
    day.path.forEach((entry, entryIndex) => {
      if (!nodeIds.has(entry.nodeId)) {
        fail(
          `${dayPath}.path[${entryIndex}].nodeId`,
          `references "${entry.nodeId}", which is not in this map`,
        )
      }
    })
    day.rewards.forEach((event, eventIndex) => {
      if (!nodeIds.has(event.nodeId)) {
        fail(
          `${dayPath}.rewards[${eventIndex}].nodeId`,
          `references "${event.nodeId}", which is not in this map`,
        )
      }
    })
  })
}

/**
 * Drafts are a scratchpad: a user may type an out-of-range weekly target before
 * fixing it. Persisting that intermediate value must not poison the save, so
 * the draft schema accepts any finite number and the final setup validation
 * (`validateSetup`) remains the gate that starts the run.
 */
function validateDraftGoal(value: unknown, path: string): Goal {
  const raw = expectRecord(value, path)
  return {
    id: expectString(raw.id, `${path}.id`),
    title: expectString(raw.title, `${path}.title`),
    category: expectString(raw.category, `${path}.category`),
    icon: expectEnum<GoalIconId>(raw.icon, `${path}.icon`, GOAL_ICON_IDS),
    weeklyObjective: expectNumber(raw.weeklyObjective, `${path}.weeklyObjective`),
    active: expectBoolean(raw.active, `${path}.active`),
    createdAt: expectString(raw.createdAt, `${path}.createdAt`),
  }
}

function validateDraftTask(value: unknown, path: string): Task {
  const raw = expectRecord(value, path)
  return {
    id: expectString(raw.id, `${path}.id`),
    goalId: expectString(raw.goalId, `${path}.goalId`),
    title: expectString(raw.title, `${path}.title`),
    effort: expectEnum(raw.effort, `${path}.effort`, EFFORTS),
    active: expectBoolean(raw.active, `${path}.active`),
    createdAt: expectString(raw.createdAt, `${path}.createdAt`),
  }
}

function validateOnboardingDraft(value: unknown, path: string): OnboardingDraft {
  const raw = expectRecord(value, path)
  return {
    step: expectInteger(raw.step, `${path}.step`),
    mode:
      raw.mode === null ? null : expectEnum(raw.mode, `${path}.mode`, DRAFT_MODES),
    name: expectString(raw.name, `${path}.name`),
    goals: expectArray(raw.goals, `${path}.goals`).map((goal, index) =>
      validateDraftGoal(goal, `${path}.goals[${index}]`),
    ),
    tasks: expectArray(raw.tasks, `${path}.tasks`).map((task, index) =>
      validateDraftTask(task, `${path}.tasks[${index}]`),
    ),
  }
}
