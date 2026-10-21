import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDemoSetup } from '../content/demo'
import { STORAGE_KEY } from '../domain/balance'
import { addDays, dayKey } from '../domain/dates'
import { createRun } from '../domain/lifecycle'
import { createEmptyDocument, parseDocument } from '../domain/schema'
import type { GameDocument, LootItem } from '../domain/types'
import { devNow, getDevOffsetDays, resetDevClock } from './clock'
import { createDocumentStorage } from './persistence'
import type { StorageLike } from './persistence'
import { createAppStore, newId } from './store'

const baseNow = new Date(2026, 9, 20, 9, 0, 0)

const loot: LootItem = {
  id: 'loot_1',
  catalogId: 'lantern-of-the-long-road',
  name: 'Lantern of the Long Road',
  rarity: 'rare',
  description: 'Its small flame never hurries.',
  obtainedAt: baseNow.toISOString(),
}

function createMemoryStorage(initial?: Record<string, string>): StorageLike & {
  values: Map<string, string>
} {
  const values = new Map(Object.entries(initial ?? {}))
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
  }
}

function makeHarness(options: { raw?: string; base?: Date } = {}) {
  const base = options.base ?? baseNow
  const memory = createMemoryStorage(options.raw ? { [STORAGE_KEY]: options.raw } : undefined)
  const controller = createDocumentStorage(memory)
  const store = createAppStore({
    storage: controller,
    now: () => devNow(base, getDevOffsetDays()),
  })
  return { store, memory, controller, base }
}

function onboardAndStart(store: ReturnType<typeof makeHarness>['store'], base: Date) {
  store.getState().completeOnboarding(createDemoSetup(base), base)
  store.getState().startRun(undefined, base)
  return store.getState().document.run
}

function storedDocument(storage: StorageLike): GameDocument {
  const raw = storage.getItem(STORAGE_KEY)
  expect(raw).toBeTruthy()
  const parsed = parseDocument(raw)
  expect(parsed.ok).toBe(true)
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.value
}

beforeEach(() => {
  resetDevClock()
})

afterEach(() => {
  resetDevClock()
})

describe('store hydration', () => {
  it('hydrates an empty document and marks itself ready', () => {
    const { store } = makeHarness()
    expect(store.getState().hydrated).toBe(true)
    expect(store.getState().storageIssue).toBeNull()
    expect(store.getState().document).toEqual(createEmptyDocument())
  })

  it('hydrates a valid saved document and drops transient state', () => {
    const first = makeHarness()
    onboardAndStart(first.store, first.base)
    first.store.getState().setTheme('dark')
    first.store.getState().showToast('Temporary message')

    const raw = first.memory.getItem(STORAGE_KEY) as string
    expect(raw).not.toContain('hydrated')
    expect(raw).not.toContain('toast')
    expect(raw).not.toContain('storageIssue')

    const second = createAppStore({
      storage: createDocumentStorage(first.memory),
      now: () => first.base,
    })
    expect(second.getState().hydrated).toBe(true)
    expect(second.getState().toast).toBeNull()
    expect(second.getState().document).toEqual(first.store.getState().document)
  })
})

describe('onboarding', () => {
  it('creates the profile and content without a run', () => {
    const { store, memory, base } = makeHarness()
    const setup = createDemoSetup(base)
    store.getState().completeOnboarding(setup, base)

    const document = store.getState().document
    expect(document.profile).toMatchObject({
      name: 'Wren',
      xp: 0,
      level: 1,
      gold: 0,
      loot: [],
      createdAt: base.toISOString(),
    })
    expect(document.goals).toHaveLength(2)
    expect(document.tasks).toHaveLength(5)
    expect(document.run).toBeNull()
    expect(document.onboardingDraft).toBeNull()
    expect(storedDocument(memory)).toEqual(document)
  })

  it('rejects an invalid setup with a plain-language message', () => {
    const { store, base } = makeHarness()
    const setup = createDemoSetup(base)
    store.getState().completeOnboarding({ ...setup, goals: [], tasks: [] }, base)
    expect(store.getState().document.profile).toBeNull()
    expect(store.getState().toast).toBe('Choose at least one aim to begin.')
  })

  it('updates and clears the onboarding draft', () => {
    const { store, base } = makeHarness()
    store.getState().updateOnboardingDraft({ step: 2, name: 'Ari', mode: 'custom' })

    const draft = store.getState().document.onboardingDraft
    expect(draft).toMatchObject({ step: 2, name: 'Ari', mode: 'custom', goals: [], tasks: [] })

    store.getState().completeOnboarding(createDemoSetup(base), base)
    store.getState().updateOnboardingDraft({ name: 'Wren' })
    store.getState().startRun(undefined, base)
    expect(store.getState().document.onboardingDraft).toBeNull()
  })
})

describe('starting a run', () => {
  it('creates seven days from the local date and snapshots objectives', () => {
    const { store, memory, base } = makeHarness()
    store.getState().completeOnboarding(createDemoSetup(base), base)
    const run = onboardAndStart(store, base)

    expect(run).not.toBeNull()
    expect(run?.days).toHaveLength(7)
    expect(run?.startDate).toBe(dayKey(base))
    expect(run?.days[0]?.date).toBe(dayKey(base))
    expect(run?.days[6]?.date).toBe(addDays(dayKey(base), 6))
    expect(run?.days.map((day) => day.status)).toEqual([
      'available',
      'locked',
      'locked',
      'locked',
      'locked',
      'locked',
      'locked',
    ])
    expect(run?.objectives.map((objective) => objective.target)).toEqual([4, 3])
    expect(run?.totals.xp).toBe(0)
    expect(storedDocument(memory).run?.id).toBe(run?.id)
  })

  it('requires a profile first', () => {
    const { store, base } = makeHarness()
    store.getState().startRun(undefined, base)
    expect(store.getState().document.run).toBeNull()
    expect(store.getState().toast).toBe('Finish onboarding before you begin a run.')
  })

  it('rejects a new run with too few routines', () => {
    const { store, base } = makeHarness()
    store.getState().completeOnboarding(createDemoSetup(base), base)
    const goals = store.getState().document.goals
    store.getState().startRun({ goals, tasks: [] }, base)
    expect(store.getState().document.run).toBeNull()
    expect(store.getState().toast).toBe('Add at least 4 routines to light the week.')
  })
})

describe('day reconciliation', () => {
  it('marks three absent days as missed and is idempotent', () => {
    const { store, base } = makeHarness()
    onboardAndStart(store, base)

    const threeDaysLater = new Date(2026, 9, 23, 9, 0, 0)
    store.getState().reconcile(threeDaysLater)

    const run = store.getState().document.run
    expect(run?.days.map((day) => day.status)).toEqual([
      'missed',
      'missed',
      'missed',
      'available',
      'locked',
      'locked',
      'locked',
    ])

    store.getState().reconcile(threeDaysLater)
    expect(store.getState().document.run).toBe(run)
  })

  it('advances the dev clock and reconciles the run', () => {
    const { store, base } = makeHarness()
    onboardAndStart(store, base)

    store.getState().devAdvanceDay()
    store.getState().devAdvanceDay()
    store.getState().devAdvanceDay()

    expect(getDevOffsetDays()).toBe(3)
    expect(store.getState().todayKey()).toBe(addDays(dayKey(base), 3))
    expect(store.getState().document.run?.days.map((day) => day.status)).toEqual([
      'missed',
      'missed',
      'missed',
      'available',
      'locked',
      'locked',
      'locked',
    ])
  })
})

describe('development actions', () => {
  it('starts a demo profile, content and run from scratch', () => {
    const { store, base } = makeHarness()
    store.getState().devStartDemoRun(base)

    const document = store.getState().document
    expect(document.profile?.name).toBe('Wren')
    expect(document.profile?.level).toBe(1)
    expect(document.goals).toHaveLength(2)
    expect(document.tasks).toHaveLength(5)
    expect(document.run?.days).toHaveLength(7)
    expect(document.onboardingDraft).toBeNull()
    expect(store.getState().toast).toBe('Demo run ready.')
  })

  it('restarts the run while keeping the profile, XP, gold and loot', () => {
    const { store, base } = makeHarness()
    store.getState().completeOnboarding(createDemoSetup(base), base)

    const document = structuredClone(store.getState().document)
    document.profile = {
      ...document.profile!,
      xp: 250,
      level: 1,
      gold: 90,
      loot: [loot],
    }
    expect(store.getState().importDocument(document)).toBe(true)
    expect(store.getState().document.profile?.level).toBe(3)

    store.getState().startRun(undefined, base)
    const oldRunId = store.getState().document.run?.id
    const oldProfile = store.getState().document.profile

    store.getState().devRestartRun()
    const newRun = store.getState().document.run

    expect(newRun?.id).not.toBe(oldRunId)
    expect(newRun?.days).toHaveLength(7)
    expect(newRun?.status).toBe('active')
    expect(store.getState().document.profile).toEqual(oldProfile)
    expect(store.getState().document.profile?.loot).toHaveLength(1)
  })

  it('resets the clock and all data', () => {
    const { store, base } = makeHarness()
    store.getState().devStartDemoRun(base)
    store.getState().devAdvanceDay()
    store.getState().devResetAll()

    expect(getDevOffsetDays()).toBe(0)
    expect(store.getState().document).toEqual(createEmptyDocument())
  })
})

describe('import, recovery and reset', () => {
  it('imports a valid document and recalculates the level', () => {
    const { store, memory, base } = makeHarness()
    const document = createEmptyDocument()
    document.profile = {
      id: 'profile_imported',
      name: 'Ari',
      xp: 250,
      level: 1,
      gold: 40,
      loot: [loot],
      createdAt: base.toISOString(),
    }
    document.settings = { theme: 'light' }

    expect(store.getState().importDocument(document)).toBe(true)
    expect(store.getState().document.profile?.level).toBe(3)
    expect(store.getState().document.settings.theme).toBe('light')
    expect(store.getState().storageIssue).toBeNull()
    expect(storedDocument(memory).profile?.level).toBe(3)
  })

  it('rejects an invalid or future import without changing the document', () => {
    const { store } = makeHarness()
    const before = store.getState().document

    expect(
      store.getState().importDocument({ schemaVersion: 2 } as unknown as GameDocument),
    ).toBe(false)
    expect(store.getState().document).toBe(before)
    expect(store.getState().toast).toBe('That save comes from a newer version of LifeSpire.')

    expect(
      store.getState().importDocument({ schemaVersion: 1 } as unknown as GameDocument),
    ).toBe(false)
    expect(store.getState().toast).toBe('That file is not a valid LifeSpire save.')
  })

  it('does not overwrite corrupt storage and recovers through import', () => {
    const raw = '{broken'
    const { store, memory } = makeHarness({ raw })

    expect(store.getState().storageIssue).toEqual({ reason: 'corrupt' })
    expect(store.getState().document).toEqual(createEmptyDocument())

    store.getState().setTheme('dark')
    expect(memory.getItem(STORAGE_KEY)).toBe(raw)

    const imported = createEmptyDocument()
    imported.settings = { theme: 'light' }
    expect(store.getState().importDocument(imported)).toBe(true)
    expect(store.getState().storageIssue).toBeNull()
    expect(storedDocument(memory).settings.theme).toBe('light')

    store.getState().setTheme('dark')
    expect(storedDocument(memory).settings.theme).toBe('dark')
  })

  it('rejects a future schema version on load without touching the save', () => {
    const raw = JSON.stringify({ schemaVersion: 2 })
    const { store, memory } = makeHarness({ raw })

    expect(store.getState().storageIssue).toEqual({ reason: 'future-version' })
    expect(store.getState().view).toEqual({ name: 'recovery', reason: 'future-version' })
    store.getState().setTheme('dark')
    expect(memory.getItem(STORAGE_KEY)).toBe(raw)
  })

  it('resetAll clears corrupt storage, unlocks writes and returns to onboarding', () => {
    const { store, memory } = makeHarness({ raw: 'nonsense' })
    expect(store.getState().storageIssue).toEqual({ reason: 'corrupt' })

    store.getState().resetAll()

    expect(store.getState().storageIssue).toBeNull()
    expect(store.getState().document).toEqual(createEmptyDocument())
    expect(storedDocument(memory)).toEqual(createEmptyDocument())

    store.getState().setTheme('light')
    expect(storedDocument(memory).settings.theme).toBe('light')
  })
})

describe('view navigation', () => {
  it('derives onboarding, home and run-summary after hydration', () => {
    const empty = makeHarness()
    expect(empty.store.getState().view).toEqual({ name: 'onboarding' })

    empty.store.getState().completeOnboarding(createDemoSetup(empty.base), empty.base)
    const profileOnly = createAppStore({
      storage: createDocumentStorage(empty.memory),
      now: () => empty.base,
    })
    expect(profileOnly.getState().view).toEqual({ name: 'home' })

    const closedDocument = structuredClone(profileOnly.getState().document)
    closedDocument.run = {
      ...createRun({
        setup: { goals: closedDocument.goals, tasks: closedDocument.tasks },
        now: empty.base,
        runId: 'run_closed',
      }),
      status: 'closed',
      closedAt: empty.base.toISOString(),
    }
    const closed = createAppStore({
      storage: createDocumentStorage(empty.memory),
      now: () => empty.base,
    })
    expect(closed.getState().importDocument(closedDocument)).toBe(true)
    expect(closed.getState().view).toEqual({ name: 'run-summary' })

    const hydratedClosed = createAppStore({
      storage: createDocumentStorage(empty.memory),
      now: () => empty.base,
    })
    expect(hydratedClosed.getState().view).toEqual({ name: 'run-summary' })
  })

  it('opens recovery when storage is blocked', () => {
    const { store } = makeHarness({ raw: '{broken' })
    expect(store.getState().view).toEqual({ name: 'recovery', reason: 'corrupt' })
  })

  it('pushes and pops transient history without persisting it', () => {
    const { store, memory, base } = makeHarness()
    store.getState().completeOnboarding(createDemoSetup(base), base)
    store.getState().startRun(undefined, base)
    store.getState().navigate({ name: 'home' })

    store.getState().navigate({ name: 'map' })
    store.getState().navigate({ name: 'goals' })
    expect(store.getState().view).toEqual({ name: 'goals' })
    expect(store.getState().history.map((item) => item.name)).toEqual(['onboarding', 'home', 'map'])
    expect(memory.getItem(STORAGE_KEY)).not.toContain('"view"')
    expect(memory.getItem(STORAGE_KEY)).not.toContain('"history"')

    store.getState().back()
    expect(store.getState().view).toEqual({ name: 'map' })
    store.getState().back()
    expect(store.getState().view).toEqual({ name: 'home' })
  })
})

describe('convenience selectors', () => {
  it('exposes profile, run, today and active content', () => {
    const { store, base } = makeHarness()
    expect(store.getState().profile()).toBeNull()
    expect(store.getState().run()).toBeNull()
    expect(store.getState().todayKey()).toBe(dayKey(base))
    expect(store.getState().activeGoals()).toEqual([])
    expect(store.getState().activeTasks()).toEqual([])

    onboardAndStart(store, base)
    expect(store.getState().profile()?.name).toBe('Wren')
    expect(store.getState().run()?.days).toHaveLength(7)
    expect(store.getState().activeGoals().map((goal) => goal.title)).toEqual([
      'Wayfarer',
      'Craft',
    ])
    expect(store.getState().activeTasks()).toHaveLength(5)
  })

  it('creates prefixed unique ids', () => {
    const first = newId('run')
    const second = newId('run')
    expect(first.startsWith('run_')).toBe(true)
    expect(first).not.toBe(second)
  })
})
