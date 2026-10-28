import { describe, expect, it } from 'vitest'
import { createDemoSetup } from '../content/demo.js'
import { createLootItem, LOOT_CATALOG } from '../content/loot.js'
import {
  ALL_OBJECTIVES_BONUS,
  DUPLICATE_GOLD,
  OBJECTIVE_BONUS,
  RUN_DAYS,
  XP_PER_LEVEL,
} from './balance.js'
import { addDays, dayKey } from './dates.js'
import { computeRunTotals, createRun, DomainError } from './lifecycle.js'
import {
  closeRun,
  finalizeIfNeeded,
  finalizeRun,
  startNewRun,
} from './runClose.js'
import { createEmptyDocument, parseDocument, serializeDocument } from './schema.js'
import { levelForXp } from './selectors.js'
import type {
  Day,
  GameDocument,
  LootItem,
  OnboardingDraft,
  Profile,
  RewardEvent,
  Run,
  RunObjective,
  RunTotals,
} from './types.js'

const start = new Date(2026, 9, 20, 9, 0, 0)
const end = new Date(2026, 9, 26, 9, 0, 0)
const startIso = start.toISOString()
const endIso = end.toISOString()

const ZERO_TOTALS: RunTotals = {
  xp: 0,
  gold: 0,
  lootCount: 0,
  nodesCompleted: 0,
  nodesSkipped: 0,
  daysPlayed: 0,
  daysMissed: 0,
}

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  const merged: Profile = {
    id: 'profile_close',
    name: 'Wren',
    xp: 0,
    level: 1,
    gold: 0,
    loot: [],
    createdAt: startIso,
    ...overrides,
  }
  return {
    ...merged,
    level: overrides.level ?? levelForXp(merged.xp),
  }
}

function missedDay(day: Day): Day {
  return { ...day, status: 'missed', closedAt: startIso }
}

interface RunOptions {
  runId?: string
  progress?: number[]
  objectives?: RunObjective[]
  days?: Day[]
}

function makeRun(options: RunOptions = {}): Run {
  const run = createRun({
    setup: createDemoSetup(start),
    now: start,
    runId: options.runId ?? 'run_close',
  })
  const objectives =
    options.objectives ??
    run.objectives.map((objective, index) => ({
      ...objective,
      progress: options.progress?.[index] ?? 0,
    }))
  const days = options.days ?? run.days.map(missedDay)
  return {
    ...run,
    status: 'closed',
    objectives,
    days,
    closedAt: endIso,
  }
}

function makeDocument(
  run: Run,
  profile: Profile = makeProfile(),
  overrides: Partial<GameDocument> = {},
): GameDocument {
  const setup = createDemoSetup(start)
  return {
    ...createEmptyDocument(),
    profile,
    goals: setup.goals,
    tasks: setup.tasks,
    run,
    ...overrides,
  }
}

function rewardEvent(overrides: Partial<RewardEvent> = {}): RewardEvent {
  return {
    id: 'event_base',
    dayIndex: 0,
    nodeId: 'n0_0',
    nodeType: 'task',
    action: 'complete',
    taskId: 'demo-task-walk-north-trail',
    taskTitle: 'Walk the north trail',
    goalId: 'demo-goal-wayfarer',
    goalTitle: 'Wayfarer',
    xp: 40,
    gold: 40,
    progress: 1,
    lootItem: null,
    duplicateCatalogId: null,
    duplicateGold: 0,
    closingBonus: false,
    at: startIso,
    ...overrides,
  }
}

function ownedLoot(catalogId: string, id = `owned:${catalogId}`): LootItem {
  const entry = LOOT_CATALOG.find((candidate) => candidate.id === catalogId)
  if (!entry) throw new Error(`missing catalog entry: ${catalogId}`)
  return createLootItem(entry, id, startIso)
}

function allCatalogLoot(): LootItem[] {
  return LOOT_CATALOG.map((entry) =>
    createLootItem(entry, `owned:${entry.id}`, startIso),
  )
}

function runWithPlayedDay(runId = 'run_events'): {
  run: Run
  event: RewardEvent
  item: LootItem
} {
  const run = makeRun({ runId })
  const item = ownedLoot('wayfarers-compass', 'base-loot')
  const event = rewardEvent({
    xp: 40,
    gold: 50,
    lootItem: item,
    duplicateGold: DUPLICATE_GOLD.common,
  })
  const days = run.days.map((day, index) =>
    index === 0
      ? { ...day, status: 'completed' as const, closedAt: startIso, rewards: [event] }
      : missedDay(day),
  )
  return { run: { ...run, days }, event, item }
}

function finalized(document: GameDocument): GameDocument {
  const next = finalizeRun(document, end)
  if (!next.run?.summary) throw new Error('expected a finalized run')
  return next
}

describe('finalizeRun no-ops', () => {
  it('leaves empty, active, profile-less and already-summarized documents alone', () => {
    const empty = createEmptyDocument()
    expect(finalizeRun(empty, end)).toBe(empty)

    const active = makeDocument({
      ...makeRun({ progress: [4, 3] }),
      status: 'active',
      closedAt: null,
    })
    expect(finalizeRun(active, end)).toBe(active)

    const profileLess = makeDocument(makeRun({ progress: [4, 3] }), makeProfile())
    profileLess.profile = null
    expect(finalizeRun(profileLess, end)).toBe(profileLess)

    const once = finalized(makeDocument(makeRun({ progress: [4, 3] })))
    expect(finalizeRun(once, end)).toBe(once)
    expect(closeRun(once, end)).toBe(once)
    expect(finalizeIfNeeded(once, end)).toBe(once)
  })
})

const CLOSE_CASES: Array<{
  label: string
  options: RunOptions
  met: number
  bonusXp: number
  baseGold: number
  allComplete: boolean
}> = [
  {
    label: 'no objectives',
    options: { objectives: [] },
    met: 0,
    bonusXp: 0,
    baseGold: 0,
    allComplete: false,
  },
  {
    label: 'objectives but none met',
    options: { progress: [0, 0] },
    met: 0,
    bonusXp: 0,
    baseGold: 0,
    allComplete: false,
  },
  {
    label: 'one of two met',
    options: { progress: [4, 1] },
    met: 1,
    bonusXp: OBJECTIVE_BONUS.xp,
    baseGold: OBJECTIVE_BONUS.gold,
    allComplete: false,
  },
  {
    label: 'both met',
    options: { progress: [4, 3] },
    met: 2,
    bonusXp: 2 * OBJECTIVE_BONUS.xp + ALL_OBJECTIVES_BONUS.xp,
    baseGold: 2 * OBJECTIVE_BONUS.gold + ALL_OBJECTIVES_BONUS.gold,
    allComplete: true,
  },
]

describe('finalizeRun weekly bonus', () => {
  it.each(CLOSE_CASES)(
    'closes with $label and a summary that matches the persisted totals',
    ({ options, met, bonusXp, baseGold, allComplete }) => {
      const document = makeDocument(makeRun(options))
      const before = document.profile as Profile
      const after = finalized(document)
      const run = after.run as Run
      const summary = run.summary
      if (!summary) throw new Error('expected a summary')
      const baseTotals = computeRunTotals(document.run as Run)

      expect(run.status).toBe('closed')
      expect(run.closedAt).toBe(endIso)
      expect(summary.closedAt).toBe(endIso)
      expect(summary.objectives).toHaveLength(run.objectives.length)
      expect(summary.objectives.filter((objective) => objective.met)).toHaveLength(met)
      expect(summary.allComplete).toBe(allComplete)
      expect(summary.bonusXp).toBe(bonusXp)
      expect(summary.bonusGold).toBe(baseGold + summary.duplicateGold)
      expect(summary.duplicateGold).toBeGreaterThanOrEqual(0)

      for (const objective of summary.objectives) {
        expect(objective.progress).toBeGreaterThanOrEqual(0)
        expect(objective.met).toBe(objective.progress >= objective.target)
        expect(objective.bonusXp).toBe(objective.met ? OBJECTIVE_BONUS.xp : 0)
        expect(objective.bonusGold).toBe(objective.met ? OBJECTIVE_BONUS.gold : 0)
      }

      const objectiveLoot = summary.objectives.reduce(
        (total, objective) => total + objective.loot.length,
        0,
      )
      expect(summary.loot).toHaveLength(
        objectiveLoot + (summary.guaranteedRare ? 1 : 0),
      )
      if (summary.guaranteedRare) {
        expect(summary.guaranteedRare.rarity).toBe('rare')
        expect(summary.loot).toContainEqual(summary.guaranteedRare)
      }

      expect(run.totals).toEqual(summary.totals)
      expect(summary.totals.xp).toBe(baseTotals.xp + bonusXp)
      expect(summary.totals.gold).toBe(baseTotals.gold + summary.bonusGold)
      expect(summary.totals.lootCount).toBe(
        baseTotals.lootCount + summary.loot.length,
      )

      const profile = after.profile as Profile
      expect(profile.xp - before.xp).toBe(summary.bonusXp)
      expect(profile.gold - before.gold).toBe(summary.bonusGold)
      expect(profile.loot.length - before.loot.length).toBe(summary.loot.length)
      expect(profile.level).toBe(levelForXp(profile.xp))
      for (const item of summary.loot) expect(profile.loot).toContainEqual(item)

      const parsed = parseDocument(serializeDocument(after))
      expect(parsed.ok).toBe(true)
      if (parsed.ok) expect(parsed.value).toEqual(after)
    },
  )

  it('folds base reward events into the same totals and profile deltas', () => {
    const { run, item } = runWithPlayedDay()
    const document = makeDocument(
      { ...run, objectives: run.objectives.map((objective, index) => ({
        ...objective,
        progress: index === 0 ? objective.target : 0,
      })) },
      makeProfile({ xp: 90, gold: 10, loot: [item] }),
    )
    const baseTotals = computeRunTotals(document.run as Run)
    expect(baseTotals).toEqual({
      ...ZERO_TOTALS,
      xp: 40,
      gold: 50,
      lootCount: 1,
      nodesCompleted: 1,
      daysPlayed: 1,
      daysMissed: 6,
    })

    const before = document.profile as Profile
    const after = finalized(document)
    const summary = after.run?.summary
    if (!summary) throw new Error('expected a summary')
    const profile = after.profile as Profile

    expect(summary.bonusXp).toBe(OBJECTIVE_BONUS.xp)
    expect(summary.totals.xp).toBe(baseTotals.xp + summary.bonusXp)
    expect(summary.totals.gold).toBe(baseTotals.gold + summary.bonusGold)
    expect(summary.totals.lootCount).toBe(
      baseTotals.lootCount + summary.loot.length,
    )
    expect(profile.xp - before.xp).toBe(summary.bonusXp)
    expect(profile.gold - before.gold).toBe(summary.bonusGold)
    expect(profile.level).toBe(levelForXp(profile.xp))
    expect(after.run?.totals).toEqual(summary.totals)
  })

  it('reports missed and zero played days without failing', () => {
    const zeroDays = finalized(
      makeDocument(makeRun({ progress: [0, 0] })),
    )
    const zeroSummary = zeroDays.run?.summary
    if (!zeroSummary) throw new Error('expected a summary')
    expect(zeroSummary.bonusXp).toBe(0)
    expect(zeroSummary.bonusGold).toBe(0)
    expect(zeroSummary.loot).toEqual([])
    expect(zeroSummary.allComplete).toBe(false)
    expect(zeroSummary.totals.daysPlayed).toBe(0)
    expect(zeroSummary.totals.daysMissed).toBe(RUN_DAYS)
    expect(zeroDays.profile).toEqual(makeProfile())

    const { run } = runWithPlayedDay('run_missed')
    const mixed = finalized(makeDocument(run))
    const mixedSummary = mixed.run?.summary
    if (!mixedSummary) throw new Error('expected a summary')
    expect(mixedSummary.totals.daysPlayed).toBe(1)
    expect(mixedSummary.totals.daysMissed).toBe(RUN_DAYS - 1)
    expect(mixedSummary.totals.nodesCompleted).toBe(1)

    const parsed = parseDocument(serializeDocument(mixed))
    expect(parsed.ok).toBe(true)
  })

  it('grants a deterministic guaranteed rare when every objective is met', () => {
    const document = makeDocument(
      makeRun({ runId: 'run_rare_0', progress: [4, 3] }),
    )
    const first = finalized(document)
    const second = finalized(
      makeDocument(makeRun({ runId: 'run_rare_0', progress: [4, 3] })),
    )
    const summary = first.run?.summary
    if (!summary?.guaranteedRare) throw new Error('expected a rare item')

    expect(summary.guaranteedRare.rarity).toBe('rare')
    expect(summary.loot).toContainEqual(summary.guaranteedRare)
    expect(first.profile?.loot).toContainEqual(summary.guaranteedRare)
    expect(summary.duplicateGold).toBe(0)
    expect(summary.bonusXp).toBe(2 * OBJECTIVE_BONUS.xp + ALL_OBJECTIVES_BONUS.xp)
    expect(summary.totals.lootCount).toBe(summary.loot.length)
    expect(second.run?.summary?.guaranteedRare).toEqual(summary.guaranteedRare)
  })

  it('keeps a single met objective and its deterministic loot stable', () => {
    const first = finalized(makeDocument(makeRun({ progress: [4, 0] }), makeProfile(), {}))
    const second = finalized(makeDocument(makeRun({ progress: [4, 0] }), makeProfile(), {}))

    expect(second.run?.summary).toEqual(first.run?.summary)
    expect(second.profile).toEqual(first.profile)
    expect(first.run?.summary?.objectives[0]?.loot).toHaveLength(
      OBJECTIVE_BONUS.lootRolls,
    )
    expect(first.run?.summary?.objectives[1]?.loot).toEqual([])
    expect(first.run?.summary?.guaranteedRare).toBeNull()
  })
})

describe('finalizeRun duplicates', () => {
  it('converts duplicate objective loot into recorded gold', () => {
    const baseline = finalized(
      makeDocument(makeRun({ runId: 'run_duplicate_weekly', progress: [4, 0] })),
    )
    const baselineSummary = baseline.run?.summary
    const rolled = baselineSummary?.objectives[0]?.loot[0]
    if (!baselineSummary || !rolled) throw new Error('expected objective loot')

    const replay = finalized(
      makeDocument(
        makeRun({ runId: 'run_duplicate_weekly', progress: [4, 0] }),
        makeProfile({ loot: [{ ...rolled, id: 'already-owned' }] }),
      ),
    )
    const summary = replay.run?.summary
    if (!summary) throw new Error('expected a summary')

    expect(summary.objectives[0]?.loot).toEqual([])
    expect(summary.loot).toEqual([])
    expect(summary.guaranteedRare).toBeNull()
    expect(summary.duplicateGold).toBe(DUPLICATE_GOLD[rolled.rarity])
    expect(summary.bonusGold).toBe(
      OBJECTIVE_BONUS.gold + DUPLICATE_GOLD[rolled.rarity],
    )
    expect(replay.profile?.gold).toBe(summary.bonusGold)
    expect(replay.profile?.loot).toHaveLength(1)
    expect(replay.profile?.loot[0]?.id).toBe('already-owned')
  })

  it('turns a duplicate guaranteed rare into gold and reports it as null', () => {
    const owned = allCatalogLoot()
    const document = makeDocument(
      makeRun({ runId: 'run_all_owned', progress: [4, 3] }),
      makeProfile({ gold: 5, loot: owned }),
    )
    const after = finalized(document)
    const summary = after.run?.summary
    if (!summary) throw new Error('expected a summary')

    expect(summary.allComplete).toBe(true)
    expect(summary.guaranteedRare).toBeNull()
    expect(summary.loot).toEqual([])
    expect(summary.duplicateGold).toBeGreaterThanOrEqual(DUPLICATE_GOLD.rare)
    expect(summary.bonusGold).toBe(
      2 * OBJECTIVE_BONUS.gold +
        ALL_OBJECTIVES_BONUS.gold +
        summary.duplicateGold,
    )
    expect(after.profile?.gold).toBe(5 + summary.bonusGold)
    expect(after.profile?.loot).toEqual(owned)
    expect(after.run?.totals.lootCount).toBe(0)
  })
})

describe('finalizeRun idempotency and levels', () => {
  it('grants rewards exactly once across repeated closes and a reload', () => {
    const first = finalized(
      makeDocument(
        makeRun({ progress: [4, 3] }),
        makeProfile({ xp: XP_PER_LEVEL - 10, gold: 7 }),
      ),
    )
    const profile = first.profile
    const run = first.run
    const summary = run?.summary
    if (!profile || !run || !summary) throw new Error('expected a close')

    expect(profile.level).toBe(levelForXp(profile.xp))

    expect(finalizeRun(first, end)).toBe(first)
    expect(closeRun(first, end)).toBe(first)
    expect(finalizeIfNeeded(first, end)).toBe(first)

    const parsed = parseDocument(serializeDocument(first))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.error)
    const reloaded = finalizeRun(parsed.value, end)
    expect(reloaded.profile).toEqual(profile)
    expect(reloaded.run?.summary).toEqual(summary)
    expect(reloaded.run?.totals).toEqual(summary.totals)
  })
})

describe('startNewRun', () => {
  function closedDocument(): GameDocument {
    const draft: OnboardingDraft = {
      step: 2,
      mode: 'custom',
      name: 'Wren',
      goals: [],
      tasks: [],
    }
    return finalized(
      makeDocument(
        makeRun({ progress: [0, 0] }),
        makeProfile({
          xp: 250,
          gold: 90,
          loot: [ownedLoot('lantern-of-the-long-road')],
        }),
        { onboardingDraft: draft },
      ),
    )
  }

  it('preserves the profile, goals, tasks and settings, and resets the run', () => {
    const document = closedDocument()
    const previousRun = document.run
    const previousProfile = document.profile
    if (!previousRun || !previousProfile) throw new Error('expected a closed run')

    const next = startNewRun(document, { runId: 'run_next', now: end })
    const run = next.run
    if (!run) throw new Error('expected a new run')

    expect(next.profile).toBe(previousProfile)
    expect(next.profile).toEqual(previousProfile)
    expect(next.goals).toBe(document.goals)
    expect(next.tasks).toBe(document.tasks)
    expect(next.settings).toEqual(document.settings)
    expect(next.onboardingDraft).toBeNull()

    expect(run).not.toBe(previousRun)
    expect(run.id).toBe('run_next')
    expect(run.seed).not.toBe(previousRun.seed)
    expect(run.status).toBe('active')
    expect(run.startDate).toBe(dayKey(end))
    expect(run.createdAt).toBe(endIso)
    expect(run.closedAt).toBeNull()
    expect(run.summary).toBeNull()
    expect(run.totals).toEqual(ZERO_TOTALS)
    expect(run.objectives.map((objective) => objective.target)).toEqual([4, 3])
    expect(run.objectives.every((objective) => objective.progress === 0)).toBe(true)

    expect(run.days).toHaveLength(RUN_DAYS)
    expect(run.days.map((day) => day.date)).toEqual(
      Array.from({ length: RUN_DAYS }, (_, index) => addDays(dayKey(end), index)),
    )
    expect(run.days.map((day) => day.status)).toEqual([
      'available',
      'locked',
      'locked',
      'locked',
      'locked',
      'locked',
      'locked',
    ])
    for (const day of run.days) {
      expect(day.map).toBeNull()
      expect(day.path).toEqual([])
      expect(day.rewards).toEqual([])
      expect(day.summary).toBeNull()
      expect(day.openedAt).toBeNull()
      expect(day.closedAt).toBeNull()
    }
  })

  it('round-trips after the transition, as a reload would', () => {
    const next = startNewRun(closedDocument(), { runId: 'run_reload', now: end })
    const parsed = parseDocument(serializeDocument(next))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.error)

    expect(parsed.value).toEqual(next)
    expect(parsed.value.run?.id).toBe('run_reload')
    expect(parsed.value.run?.status).toBe('active')
    expect(parsed.value.profile).toEqual(next.profile)
  })

  it('rejects missing profile, missing or active run and invalid setup', () => {
    const document = closedDocument()
    const run = document.run
    if (!run) throw new Error('expected a closed run')

    expect(() =>
      startNewRun({ ...document, profile: null }, { runId: 'run_x', now: end }),
    ).toThrow(DomainError)
    expect(() =>
      startNewRun({ ...document, profile: null }, { runId: 'run_x', now: end }),
    ).toThrow(/onboarding/i)

    expect(() =>
      startNewRun({ ...document, run: null }, { runId: 'run_x', now: end }),
    ).toThrow(/no closed run/i)

    expect(() =>
      startNewRun(
        { ...document, run: { ...run, status: 'active' } },
        { runId: 'run_x', now: end },
      ),
    ).toThrow(/finish the current run/i)

    const unsealed = { ...document, run: { ...run, summary: null } }
    expect(() =>
      startNewRun(unsealed, { runId: 'run_x', now: end }),
    ).toThrow(/seal this week/i)
    expect(unsealed.run?.summary).toBeNull()
    expect(unsealed.run?.id).toBe(run.id)

    const invalid = { ...document, tasks: [] }
    expect(() =>
      startNewRun(invalid, { runId: 'run_x', now: end }),
    ).toThrow(/at least 4 routines/i)
    expect(invalid.run).toBe(run)
    expect(invalid.tasks).toEqual([])

    expect(() =>
      startNewRun({ ...document, goals: [] }, { runId: 'run_x', now: end }),
    ).toThrow(/at least one goal/i)
  })
})