import { validateSetup } from '../content/demo'
import { lootByRarity } from '../content/loot'
import { ALL_OBJECTIVES_BONUS, OBJECTIVE_BONUS, RUN_DAYS } from './balance'
import { computeRunTotals, createRun, DomainError } from './lifecycle'
import { createRng } from './rng'
import { acquireLoot, applyXp, buildLootItem, rollLootItem } from './rewards'
import type {
  GameDocument,
  LootItem,
  Profile,
  Run,
  RunObjective,
  RunSummary,
  RunTotals,
} from './types'

/**
 * Weekly rolls are not tied to a played day, so they use `RUN_DAYS` as their
 * stable day slot. Together with the `weekly:*` node ids and the existing
 * `runId:dayIndex:nodeId:catalogId` instance id this keeps them deterministic
 * and impossible to collide with a map node.
 */
const WEEKLY_LOOT_DAY = RUN_DAYS

function objectiveLootNodeId(goalId: string): string {
  return `weekly:objective:${goalId}`
}

function rollObjectiveLoot(
  run: Run,
  objective: RunObjective,
  rollIndex: number,
  obtainedAt: string,
): LootItem {
  return rollLootItem({
    runId: run.id,
    dayIndex: WEEKLY_LOOT_DAY,
    nodeId: objectiveLootNodeId(objective.goalId),
    rollIndex,
    obtainedAt,
  })
}

/** Guaranteed rare: deterministic uniform pick inside the rare catalog. */
function rollGuaranteedRare(run: Run, obtainedAt: string): LootItem {
  const entry = createRng(`${run.id}:weekly:all:rare:0`).pick(lootByRarity('rare'))
  return buildLootItem(entry, {
    runId: run.id,
    dayIndex: WEEKLY_LOOT_DAY,
    nodeId: 'weekly:all',
    obtainedAt,
  })
}

interface WeeklyTally {
  profile: Profile
  xp: number
  /** Base bonus gold, before duplicate conversions. */
  gold: number
  duplicateGold: number
  loot: LootItem[]
}

/**
 * Seals a closed run and grants the weekly bonus exactly once.
 *
 * Preconditions: a profile exists and the run is already `closed` (the
 * lifecycle closes it when day 7 is resolved or elapsed). Active runs are left
 * untouched, and a run that already has a summary is returned unchanged, so
 * reloading or reconciling again can never grant rewards twice.
 */
export function finalizeRun(document: GameDocument, now: Date): GameDocument {
  const run = document.run
  if (!run || !document.profile) return document
  if (run.summary !== null) return document
  if (run.status !== 'closed') return document

  const closedAt = run.closedAt ?? now.toISOString()
  const baseTotals = computeRunTotals(run)
  const tally: WeeklyTally = {
    profile: document.profile,
    xp: 0,
    gold: 0,
    duplicateGold: 0,
    loot: [],
  }

  const objectives: RunSummary['objectives'] = run.objectives.map((objective) => {
    const met = objective.progress >= objective.target
    if (!met) {
      return {
        goalId: objective.goalId,
        title: objective.goalTitle,
        target: objective.target,
        progress: objective.progress,
        met: false,
        bonusXp: 0,
        bonusGold: 0,
        loot: [],
      }
    }

    tally.xp += OBJECTIVE_BONUS.xp
    tally.gold += OBJECTIVE_BONUS.gold
    const loot: LootItem[] = []

    for (let rollIndex = 0; rollIndex < OBJECTIVE_BONUS.lootRolls; rollIndex += 1) {
      const acquisition = acquireLoot(
        tally.profile,
        rollObjectiveLoot(run, objective, rollIndex, closedAt),
      )
      tally.profile = acquisition.profile
      tally.duplicateGold += acquisition.duplicateGold
      if (acquisition.lootItem) {
        loot.push(acquisition.lootItem)
        tally.loot.push(acquisition.lootItem)
      }
    }

    return {
      goalId: objective.goalId,
      title: objective.goalTitle,
      target: objective.target,
      progress: objective.progress,
      met: true,
      bonusXp: OBJECTIVE_BONUS.xp,
      bonusGold: OBJECTIVE_BONUS.gold,
      loot,
    }
  })

  const allComplete =
    objectives.length > 0 && objectives.every((objective) => objective.met)
  let guaranteedRare: LootItem | null = null

  if (allComplete) {
    tally.xp += ALL_OBJECTIVES_BONUS.xp
    tally.gold += ALL_OBJECTIVES_BONUS.gold
    const acquisition = acquireLoot(
      tally.profile,
      rollGuaranteedRare(run, closedAt),
    )
    tally.profile = acquisition.profile
    tally.duplicateGold += acquisition.duplicateGold
    if (acquisition.lootItem) {
      guaranteedRare = acquisition.lootItem
      tally.loot.push(acquisition.lootItem)
    }
  }

  const bonusGold = tally.gold + tally.duplicateGold
  let profile = applyXp(tally.profile, tally.xp)
  if (tally.gold > 0) {
    profile = { ...profile, gold: profile.gold + tally.gold }
  }

  const totals: RunTotals = {
    ...baseTotals,
    xp: baseTotals.xp + tally.xp,
    gold: baseTotals.gold + bonusGold,
    lootCount: baseTotals.lootCount + tally.loot.length,
  }

  const summary: RunSummary = {
    closedAt,
    objectives,
    allComplete,
    bonusXp: tally.xp,
    bonusGold,
    loot: tally.loot,
    duplicateGold: tally.duplicateGold,
    guaranteedRare,
    totals,
  }

  return {
    ...document,
    profile,
    run: {
      ...run,
      status: 'closed',
      closedAt,
      summary,
      totals,
    },
  }
}

/** Public alias kept for callers that describe the transition as a close. */
export function closeRun(document: GameDocument, now: Date): GameDocument {
  return finalizeRun(document, now)
}

/**
 * Convenience entry point for callers that have already reconciled the run
 * (store reconcile, resolve and hydration). It only applies the weekly bonus
 * when the run is closed without a summary; otherwise it returns the same
 * document.
 */
export function finalizeIfNeeded(document: GameDocument, now: Date): GameDocument {
  return finalizeRun(document, now)
}

export interface StartNewRunOptions {
  runId: string
  now: Date
}

/**
 * Replaces a closed run with a fresh seven-day run while keeping the profile
 * (identity, XP, level, gold and collection), goals, tasks and settings.
 *
 * The previous run is not mutated: the returned document carries a brand-new
 * run whose days, maps, paths, reward events, objectives and summaries start
 * empty. The transition is a single return value, so a reload can only see
 * either the old document or the complete new one. The caller supplies a fresh
 * `runId`, which also derives a new seed.
 */
export function startNewRun(
  document: GameDocument,
  options: StartNewRunOptions,
): GameDocument {
  if (!document.profile) {
    throw new DomainError('Finish onboarding before you begin a run.')
  }

  const previous = document.run
  if (!previous) {
    throw new DomainError('There is no closed run to replace.')
  }
  if (previous.status !== 'closed') {
    throw new DomainError('Finish the current run before starting a new one.')
  }

  const validation = validateSetup(document.goals, document.tasks)
  if (!validation.ok) {
    throw new DomainError(validation.errors[0] ?? 'This path cannot begin yet.')
  }

  const run = createRun({
    setup: { goals: document.goals, tasks: document.tasks },
    now: options.now,
    runId: options.runId,
  })

  return { ...document, run, onboardingDraft: null }
}
