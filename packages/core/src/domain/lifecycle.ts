import { BOSS_CLOSING_BONUS, GENERATOR_VERSION, RUN_DAYS, WHEEL_GOLD, WHEEL_OUTCOME_WEIGHTS, WHEEL_PENDING_WEIGHT, WHEEL_REST_XP, WHEEL_SECTORS, WHEEL_XP } from './balance.js'
import { addDays, dayKey, isValidTimeZone, parseDayKey } from './dates.js'
import { buildTaskPool, generateMap } from './generator.js'
import { createRng } from './rng.js'
import { acquireLoot, applyXp, rewardsForNode, rollLootItem } from './rewards.js'
import { availableNodeIds, currentDay, resolveNodeById } from './selectors.js'
import type {
  Day,
  DaySummary,
  GameDocument,
  Goal,
  LootItem,
  MapNode,
  Profile,
  ResolutionAction,
  ResolvedNode,
  RewardEvent,
  Run,
  RunObjective,
  RunSetup,
  RunTotals,
  Task,
  TaskSnapshot,
  WheelOutcome,
} from './types.js'

/** A rejected lifecycle transition with a message that can be shown to the player. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DomainError'
  }
}

export interface OpenDayOptions {
  dayId?: string
  now: Date
}

export interface CreateRunInput {
  setup: RunSetup
  now: Date
  runId: string
  /** IANA zone for day boundaries; null keeps legacy device-local behavior. */
  timeZone?: string | null
}

export interface ResolveNodeOptions {
  dayId?: string
  nodeId: string
  action: ResolutionAction
  now: Date
  /** Overrides the id used for stable reward/loot ids; defaults to `run.id`. */
  runId?: string
}

const EMPTY_TOTALS: RunTotals = {
  xp: 0,
  gold: 0,
  lootCount: 0,
  nodesCompleted: 0,
  nodesSkipped: 0,
  daysPlayed: 0,
  daysMissed: 0,
}

function objectivesFromGoals(setup: RunSetup): RunObjective[] {
  return setup.goals
    .filter((goal) => goal.active)
    .map((goal) => ({
      goalId: goal.id,
      goalTitle: goal.title,
      target: goal.weeklyObjective,
      progress: 0,
    }))
}

function createDays(runId: string, startDate: string): Day[] {
  return Array.from({ length: RUN_DAYS }, (_, index) => ({
    id: `${runId}:day:${index}`,
    index,
    date: addDays(startDate, index),
    status: index === 0 ? 'available' : 'locked',
    map: null,
    path: [],
    rewards: [],
    openedAt: null,
    closedAt: null,
    summary: null,
  }))
}

/** Creates a fresh 7-day run. All dates and ids are injected for determinism. */
export function createRun({ setup, now, runId, timeZone = null }: CreateRunInput): Run {
  if (timeZone !== null && timeZone !== undefined && !isValidTimeZone(timeZone)) {
    throw new DomainError(`Invalid time zone: "${timeZone}"`)
  }
  const zone = timeZone ?? null
  const startDate = dayKey(now, zone)
  return {
    id: runId,
    seed: `run:${runId}`,
    generatorVersion: GENERATOR_VERSION,
    startDate,
    timeZone: zone,
    status: 'active',
    objectives: objectivesFromGoals(setup),
    days: createDays(runId, startDate),
    totals: { ...EMPTY_TOTALS },
    createdAt: now.toISOString(),
    closedAt: null,
    summary: null,
  }
}

/**
 * Recomputes totals from the persisted path events. Reward events are the
 * source of truth, so duplicate conversions (already folded into `event.gold`)
 * and skipped nodes cannot drift from the profile.
 */
export function computeRunTotals(run: Run): RunTotals {
  const totals: RunTotals = { ...EMPTY_TOTALS }

  for (const day of run.days) {
    if (day.status === 'completed') totals.daysPlayed += 1
    if (day.status === 'missed') totals.daysMissed += 1

    for (const event of day.rewards) {
      totals.xp += event.xp
      totals.gold += event.gold
      if (event.lootItem) totals.lootCount += 1
      if (event.action === 'complete') totals.nodesCompleted += 1
      else totals.nodesSkipped += 1
    }
  }

  return totals
}

function sameTotals(a: RunTotals, b: RunTotals): boolean {
  return (
    a.xp === b.xp &&
    a.gold === b.gold &&
    a.lootCount === b.lootCount &&
    a.nodesCompleted === b.nodesCompleted &&
    a.nodesSkipped === b.nodesSkipped &&
    a.daysPlayed === b.daysPlayed &&
    a.daysMissed === b.daysMissed
  )
}

/**
 * Builds the sealed-day view from the events persisted on that day. `before`
 * is derived as `after - progress gained today`, so the summary can be rebuilt
 * after a reload without storing extra snapshots. Missed days keep
 * `summary: null`; only a resolved boss produces one.
 */
export function computeDaySummary(run: Run, day: Day): DaySummary {
  let xp = 0
  let gold = 0
  let duplicateGold = 0
  let completed = 0
  let skipped = 0
  let bossCompleted = false
  const loot: LootItem[] = []
  const gainedByGoal = new Map<string, number>()

  for (const event of day.rewards) {
    xp += event.xp
    gold += event.gold
    duplicateGold += event.duplicateGold
    if (event.action === 'complete') completed += 1
    else skipped += 1
    if (event.lootItem) loot.push(event.lootItem)
    if (event.progress > 0 && event.goalId) {
      gainedByGoal.set(
        event.goalId,
        (gainedByGoal.get(event.goalId) ?? 0) + event.progress,
      )
    }
    if (event.nodeType === 'boss') bossCompleted = event.action === 'complete'
  }

  const objectives = run.objectives.map((objective) => {
    const gained = gainedByGoal.get(objective.goalId) ?? 0
    return {
      goalId: objective.goalId,
      title: objective.goalTitle,
      before: Math.max(0, objective.progress - gained),
      after: objective.progress,
      target: objective.target,
    }
  })

  return {
    xp,
    gold,
    loot,
    duplicateGold,
    bossCompleted,
    closingBonusXp: bossCompleted ? BOSS_CLOSING_BONUS.xp : 0,
    closingBonusGold: bossCompleted ? BOSS_CLOSING_BONUS.gold : 0,
    completed,
    skipped,
    objectives,
  }
}

/** Local midnight after a missed day, used only when no injected clock is given. */
function cutoffAfter(date: string, timeZone?: string | null): string {
  if (timeZone === undefined || timeZone === null) {
    const midnight = parseDayKey(date)
    midnight.setDate(midnight.getDate() + 1)
    return midnight.toISOString()
  }
  if (!isValidTimeZone(timeZone)) {
    throw new DomainError(`Invalid time zone: "${timeZone}"`)
  }
  return zonedMidnightAfter(date, timeZone)
}

/**
 * Midnight after `date` in `timeZone`, as a UTC instant. Iterates from a UTC
 * guess because the offset itself depends on the instant (DST).
 */
function zonedMidnightAfter(date: string, timeZone: string): string {
  const [year, month, day] = date.split('-').map(Number)
  let guess = Date.UTC(year, month - 1, day) + 86_400_000
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const wall = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(new Date(guess))
    const get = (type: string): string => wall.find((p) => p.type === type)?.value ?? ''
    const wallMs =
      Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day')), Number(get('hour')), Number(get('minute')), Number(get('second'))) -
      guess
    // `wallMs` is zoneOffset applied to guess; midnight target minus wall gives the correction.
    const targetWall = Date.UTC(year, month - 1, day + 1)
    const correction = targetWall - (guess + wallMs)
    if (correction === 0) break
    guess += correction
  }
  return new Date(guess).toISOString()
}

function latestDayClosedAt(run: Run): string | null {
  for (let index = run.days.length - 1; index >= 0; index -= 1) {
    const closedAt = run.days[index]?.closedAt
    if (closedAt) return closedAt
  }
  return null
}

/**
 * Marks elapsed days as missed, keeps today available or in progress, and locks
 * the future. Missed days are sealed with `closedAt` but keep `summary: null`
 * and are never recoverable. Totals are recomputed, and the run closes itself
 * once every day is completed or missed (or day 7 has passed). No weekly bonus
 * is granted here: that belongs to the run-closing milestone. Repeated calls
 * are idempotent and completed/missed days are never rewritten.
 */
export function reconcileDays(run: Run, todayKey: string, now?: Date): Run {
  if (run.status === 'closed') return run

  const stamp = now?.toISOString() ?? null
  let changed = false

  const days = run.days.map((day): Day => {
    if (day.status === 'completed' || day.status === 'missed') {
      return day
    }

    if (day.date < todayKey) {
      changed = true
      return {
        ...day,
        status: 'missed',
        closedAt: day.closedAt ?? stamp ?? cutoffAfter(day.date, run.timeZone),
      }
    }

    if (day.date === todayKey) {
      const status = day.map ? 'in_progress' : 'available'
      if (day.status === status) return day
      changed = true
      return { ...day, status }
    }

    if (day.status === 'locked') return day
    changed = true
    return { ...day, status: 'locked' }
  })

  const totals = computeRunTotals({ ...run, days })
  const totalsChanged = !sameTotals(totals, run.totals)
  const allClosed =
    days.length > 0 &&
    days.every((day) => day.status === 'completed' || day.status === 'missed')
  const lastDate = days[days.length - 1]?.date
  const daySevenPassed = lastDate !== undefined && lastDate < todayKey

  if (!changed && !totalsChanged && !allClosed && !daySevenPassed) {
    return run
  }

  let next: Run = { ...run, days, totals }
  if (allClosed || daySevenPassed) {
    next = {
      ...next,
      status: 'closed',
      closedAt:
        stamp ??
        latestDayClosedAt(next) ??
        (lastDate ? cutoffAfter(lastDate, run.timeZone) : next.createdAt),
      summary: null,
    }
  }

  return next
}

/**
 * Opens the current day exactly once. Only the first day that is neither
 * completed nor missed can be opened, and only when its local date is today.
 * Existing maps are never regenerated; repeated calls return the same document.
 */
export function openDay(document: GameDocument, options: OpenDayOptions): GameDocument {
  const run = document.run
  if (!run || run.status !== 'active') {
    throw new DomainError('There is no active run to open.')
  }

  const today = dayKey(options.now, run.timeZone ?? null)
  const day = currentDay(run)
  if (!day) {
    throw new DomainError('Every day in this run is already closed.')
  }
  if (day.date > today) {
    throw new DomainError('That day has not arrived yet.')
  }
  if (day.date < today) {
    throw new DomainError('That day has already passed.')
  }

  if (options.dayId !== undefined && options.dayId !== day.id) {
    const requested = run.days.find((candidate) => candidate.id === options.dayId)
    if (!requested) throw new DomainError('That day does not belong to this run.')
    throw new DomainError('Only today can be opened.')
  }

  if (day.map) return document

  const map = generateMap({
    runId: run.id,
    runSeed: run.seed,
    dayIndex: day.index,
    generatorVersion: GENERATOR_VERSION,
    goals: document.goals,
    tasks: document.tasks,
    objectives: run.objectives,
    now: options.now.toISOString(),
  })

  const days = run.days.map((candidate): Day =>
    candidate.id === day.id
      ? {
          ...candidate,
          map,
          status: 'in_progress',
          openedAt: options.now.toISOString(),
        }
      : candidate,
  )

  return { ...document, run: { ...run, days } }
}

/**
 * Selects the current node. Before a selection only layer 0 is available; once
 * a node is current it is the only node that can be picked again (as a no-op).
 * The selection cannot be cancelled or swapped for another node.
 */
export function selectNode(document: GameDocument, nodeId: string): GameDocument {
  const run = document.run
  if (!run || run.status !== 'active') {
    throw new DomainError('There is no active run.')
  }

  const day = currentDay(run)
  if (!day) throw new DomainError('Every day in this run is already closed.')
  if (day.status !== 'in_progress' || !day.map) {
    throw new DomainError('Open the day before choosing a node.')
  }

  const map = day.map
  if (!resolveNodeById(map, nodeId)) {
    throw new DomainError('That node is not part of today’s map.')
  }

  const available = availableNodeIds(map, day)
  if (!available.includes(nodeId)) {
    if (map.currentNodeId !== null && map.currentNodeId !== nodeId) {
      throw new DomainError('A node is already chosen for this day.')
    }
    throw new DomainError('That node is not available from the current path.')
  }

  if (map.currentNodeId === nodeId) return document

  const nextMap = { ...map, currentNodeId: nodeId }
  const days = run.days.map((candidate): Day =>
    candidate.id === day.id ? { ...candidate, map: nextMap } : candidate,
  )

  return { ...document, run: { ...run, days } }
}

interface ResolutionResult {
  profile: Profile | null
  xp: number
  gold: number
  progress: number
  lootItem: LootItem | null
  duplicateCatalogId: string | null
  duplicateGold: number
  closingBonus: boolean
  objectives: RunObjective[]
  wheelOutcome: WheelOutcome | null
  wheelTask: TaskSnapshot | null
}

// The visual sector layout lives in balance.ts next to the outcome weights.
export { WHEEL_SECTORS }

/**
 * Applies a completed node. Gold in the returned event total includes any
 * duplicate conversion; `profile.gold` is credited once for each part.
 */

export function rollWheelOutcome(input: {
  runId: string
  dayIndex: number
  nodeId: string
  goals: readonly Goal[]
  tasks: readonly Task[]
  objectives: readonly RunObjective[]
}): {
  outcome: WheelOutcome
  task: TaskSnapshot | null
  xp: number
  gold: number
  progress: number
  objectives: RunObjective[]
  segmentIndex: number
} {
  const objectivesByGoal = new Map(input.objectives.map((o) => [o.goalId, o] as const))
  const pool = buildTaskPool(input.goals, input.tasks)
  const seed = `${input.runId}:day:${input.dayIndex}:node:${input.nodeId}:wheel`
  const rng = createRng(seed)
  const category = rng.weightedPick(
    ['task', 'gold', 'xp', 'rest'] as const,
    (outcome) => WHEEL_OUTCOME_WEIGHTS[outcome],
  )

  if (category === 'gold') {
    return { outcome: 'gold', task: null, xp: 0, gold: WHEEL_GOLD, progress: 0, objectives: [...input.objectives], segmentIndex: 5 + rng.int(2) }
  }
  if (category === 'xp') {
    return { outcome: 'xp', task: null, xp: WHEEL_XP, gold: 0, progress: 0, objectives: [...input.objectives], segmentIndex: 7 + rng.int(2) }
  }
  if (category === 'rest') {
    return { outcome: 'rest', task: null, xp: WHEEL_REST_XP, gold: 0, progress: 0, objectives: [...input.objectives], segmentIndex: 9 }
  }

  // task
  if (pool.length === 0) {
    return { outcome: 'rest', task: null, xp: WHEEL_REST_XP, gold: 0, progress: 0, objectives: [...input.objectives], segmentIndex: 9 }
  }

  const pendingWeight = (choice: (typeof pool)[number]): number => {
    const objective = objectivesByGoal.get(choice.task.goalId)
    const pending =
      !objective || objective.progress < objective.target
        ? WHEEL_PENDING_WEIGHT
        : 1
    return pending
  }
  const choice = rng.weightedPick(pool, pendingWeight)

  const effort = choice.task.effort
  const baseRewards = rewardsForNode('task', effort)

  const wheelTask = {
    taskId: choice.task.id,
    title: choice.task.title,
    goalId: choice.task.goalId,
    goalTitle: choice.goalTitle,
    effort,
  }

  const goalId = choice.task.goalId
  const objectiveIndex = input.objectives.findIndex((o) => o.goalId === goalId)
  const progress = objectiveIndex >= 0 ? 1 : 0
  const objectives =
    progress === 1
      ? input.objectives.map((objective, index) =>
          index === objectiveIndex
            ? { ...objective, progress: objective.progress + 1 }
            : objective,
        )
      : [...input.objectives]

  return {
    outcome: 'task',
    task: wheelTask,
    xp: baseRewards.xp,
    gold: baseRewards.gold,
    progress,
    objectives,
    segmentIndex: rng.int(5),
  }
}

function applyCompletion(input: {
  profile: Profile | null
  run: Run
  dayIndex: number
  node: MapNode
  idBase: string
  obtainedAt: string
  goals: readonly Goal[]
  tasks: readonly Task[]
}): ResolutionResult {
  const startingProfile = input.profile
  if (!startingProfile) {
    throw new DomainError('A profile is required to record rewards.')
  }

  const { node } = input

  // Wheel: resolve a random outcome at completion time.
  if (node.type === 'wheel') {
    const rolled = rollWheelOutcome({
      runId: input.idBase,
      dayIndex: input.dayIndex,
      nodeId: node.id,
      goals: input.goals,
      tasks: input.tasks,
      objectives: input.run.objectives,
    })

    let profile = applyXp(startingProfile, rolled.xp)
    profile = { ...profile, gold: profile.gold + rolled.gold }

    return {
      profile,
      xp: rolled.xp,
      gold: rolled.gold,
      progress: rolled.progress,
      lootItem: null,
      duplicateCatalogId: null,
      duplicateGold: 0,
      closingBonus: false,
      objectives: rolled.objectives,
      wheelOutcome: rolled.outcome,
      wheelTask: rolled.task,
    }
  }

  let profile = applyXp(startingProfile, node.rewards.xp)
  profile = { ...profile, gold: profile.gold + node.rewards.gold }

  let lootItem: LootItem | null = null
  let duplicateCatalogId: string | null = null
  let duplicateGold = 0

  for (let rollIndex = 0; rollIndex < node.rewards.lootRolls; rollIndex += 1) {
    const rolled = rollLootItem({
      runId: input.idBase,
      dayIndex: input.dayIndex,
      nodeId: node.id,
      rollIndex,
      obtainedAt: input.obtainedAt,
    })
    const acquisition = acquireLoot(profile, rolled)
    profile = acquisition.profile
    if (acquisition.lootItem && !lootItem) lootItem = acquisition.lootItem
    if (acquisition.duplicateCatalogId) {
      duplicateCatalogId ??= acquisition.duplicateCatalogId
      duplicateGold += acquisition.duplicateGold
    }
  }

  const goalId = node.task?.goalId ?? null
  const objectiveIndex =
    goalId && node.rewards.progress === 1
      ? input.run.objectives.findIndex((objective) => objective.goalId === goalId)
      : -1
  const progress = objectiveIndex >= 0 ? 1 : 0
  const objectives =
    progress === 1
      ? input.run.objectives.map((objective, index) =>
          index === objectiveIndex
            ? { ...objective, progress: objective.progress + 1 }
            : objective,
        )
      : input.run.objectives

  return {
    profile,
    xp: node.rewards.xp,
    gold: node.rewards.gold + duplicateGold,
    progress,
    lootItem,
    duplicateCatalogId,
    duplicateGold,
    closingBonus: node.type === 'boss',
    objectives,
    wheelOutcome: null,
    wheelTask: null,
  }
}

function applySkip(profile: Profile | null, objectives: RunObjective[]): ResolutionResult {
  return {
    profile,
    xp: 0,
    gold: 0,
    progress: 0,
    lootItem: null,
    duplicateCatalogId: null,
    duplicateGold: 0,
    closingBonus: false,
    objectives,
    wheelOutcome: null,
    wheelTask: null,
  }
}

function closeRunIfFinished(run: Run, closedAt: string): Run {
  if (run.status !== 'active') return run
  const allClosed =
    run.days.length > 0 &&
    run.days.every((day) => day.status === 'completed' || day.status === 'missed')
  if (!allClosed) return run
  return { ...run, status: 'closed', closedAt, summary: null }
}

/**
 * Resolves one node of the current day. `complete` grants the persisted node
 * total, weekly progress and loot; `skip` grants nothing but still advances.
 * Resolving the boss seals the day and, once no day remains open, closes the
 * run with `summary: null` (the weekly closing bonus belongs to M3).
 *
 * Resolution is pure and idempotent by construction: a resolved node can never
 * be resolved again, so a reload or a repeated click cannot duplicate rewards.
 */
export function resolveNode(
  document: GameDocument,
  options: ResolveNodeOptions,
): GameDocument {
  const run = document.run
  if (!run || run.status !== 'active') {
    throw new DomainError('There is no active run.')
  }

  const day = currentDay(run)
  if (!day) throw new DomainError('Every day in this run is already closed.')

  if (options.dayId !== undefined && options.dayId !== day.id) {
    const requested = run.days.find((candidate) => candidate.id === options.dayId)
    if (!requested) throw new DomainError('That day does not belong to this run.')
    throw new DomainError('Only today can be played.')
  }

  const today = dayKey(options.now, run.timeZone ?? null)
  if (day.date < today) throw new DomainError('That day has already passed.')
  if (day.date > today) throw new DomainError('That day has not arrived yet.')
  if (day.status !== 'in_progress' || !day.map) {
    throw new DomainError('Open the day before resolving a node.')
  }

  const map = day.map
  const node = resolveNodeById(map, options.nodeId)
  if (!node) throw new DomainError('That node is not part of today’s map.')
  if (day.path.some((entry) => entry.nodeId === node.id)) {
    throw new DomainError('That node has already been resolved.')
  }
  if (map.currentNodeId !== null && map.currentNodeId !== node.id) {
    throw new DomainError('A node is already chosen for this day.')
  }
  if (
    map.currentNodeId === null &&
    !availableNodeIds(map, day).includes(node.id)
  ) {
    throw new DomainError('That node is not available from the current path.')
  }

  const at = options.now.toISOString()
  const idBase = options.runId ?? run.id
  const resolution =
    options.action === 'complete'
      ? applyCompletion({
          profile: document.profile,
          run,
          dayIndex: day.index,
          node,
          idBase,
          obtainedAt: at,
          goals: document.goals,
          tasks: document.tasks,
        })
      : applySkip(document.profile, run.objectives)

  const pathEntry: ResolvedNode = {
    nodeId: node.id,
    action: options.action,
    at,
  }

  const event: RewardEvent = {
    id: `${idBase}:day:${day.index}:reward:${node.id}`,
    dayIndex: day.index,
    nodeId: node.id,
    nodeType: node.type,
    action: options.action,
    taskId: (node.task ?? resolution.wheelTask)?.taskId ?? null,
    taskTitle: (node.task ?? resolution.wheelTask)?.title ?? null,
    goalId: (node.task ?? resolution.wheelTask)?.goalId ?? null,
    goalTitle: (node.task ?? resolution.wheelTask)?.goalTitle ?? null,
    xp: resolution.xp,
    gold: resolution.gold,
    progress: resolution.progress,
    lootItem: resolution.lootItem,
    duplicateCatalogId: resolution.duplicateCatalogId,
    duplicateGold: resolution.duplicateGold,
    closingBonus: resolution.closingBonus,
    wheelOutcome: resolution.wheelOutcome,
    at,
  }

  const resolvedDay: Day = {
    ...day,
    map: { ...map, currentNodeId: null },
    path: [...day.path, pathEntry],
    rewards: [...day.rewards, event],
  }

  let finalDay = resolvedDay
  if (node.type === 'boss') {
    const closedDay: Day = {
      ...resolvedDay,
      status: 'completed',
      closedAt: at,
    }
    const summary = computeDaySummary(
      { ...run, objectives: resolution.objectives },
      closedDay,
    )
    finalDay = { ...closedDay, summary }
  }

  const days = run.days.map((candidate) => (candidate.id === day.id ? finalDay : candidate))
  const withDays: Run = { ...run, objectives: resolution.objectives, days }
  const nextRun: Run = {
    ...withDays,
    totals: computeRunTotals(withDays),
  }

  return {
    ...document,
    profile: resolution.profile,
    run: node.type === 'boss' ? closeRunIfFinished(nextRun, at) : nextRun,
  }
}
