import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDemoSetup } from '../content/demo'
import { STORAGE_KEY } from '../domain/balance'
import { addDays, dayKey } from '../domain/dates'
import { validateMap } from '../domain/generator'
import { createRun } from '../domain/lifecycle'
import { createEmptyDocument, parseDocument } from '../domain/schema'
import { availableNodeIds, currentDay, levelForXp } from '../domain/selectors'
import type { GameDocument, LootItem, Run } from '../domain/types'
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

describe('opening a day and choosing a path node', () => {
  it('opens the current day once and persists the generated map', () => {
    const { store, memory, base } = makeHarness()
    onboardAndStart(store, base)

    store.getState().openDay(undefined, base)
    const opened = store.getState().document.run?.days[0]
    expect(opened?.status).toBe('in_progress')
    expect(opened?.openedAt).toBe(base.toISOString())
    expect(opened?.map).not.toBeNull()
    if (!opened?.map) throw new Error('expected a map')
    expect(validateMap(opened.map)).toEqual({ ok: true })
    expect(store.getState().toast).toBeNull()

    const stored = storedDocument(memory)
    expect(stored.run?.days[0]?.map).toEqual(opened.map)

    const later = new Date(2026, 9, 20, 21, 0, 0)
    store.getState().openDay(undefined, later)
    expect(store.getState().document.run?.days[0]?.map).toEqual(opened.map)
    expect(store.getState().document.run?.days[0]?.openedAt).toBe(base.toISOString())
  })

  it('only opens the current day and rejects future or foreign days', () => {
    const { store, base } = makeHarness()
    const run = onboardAndStart(store, base)
    const futureDayId = run?.days[1]?.id

    store.getState().openDay(futureDayId, base)
    expect(store.getState().toast).toBe('Only today can be opened.')
    expect(store.getState().document.run?.days[1]?.map).toBeNull()
    expect(store.getState().document.run?.days[0]?.map).toBeNull()

    store.getState().openDay('missing-day', base)
    expect(store.getState().toast).toBe('That day does not belong to this run.')

    store.getState().openDay(undefined, new Date(2026, 9, 21, 8, 0, 0))
    const days = store.getState().document.run?.days
    expect(days?.[0]?.status).toBe('missed')
    expect(days?.[1]?.status).toBe('in_progress')
    expect(days?.[1]?.map).not.toBeNull()
    expect(store.getState().toast).toBeNull()
  })

  it('keeps the selected node as the only choice and persists it', () => {
    const { store, memory, base } = makeHarness()
    onboardAndStart(store, base)
    store.getState().openDay(undefined, base)

    const map = store.getState().document.run?.days[0]?.map
    const first = map?.layers[0]?.[0]
    const other = map?.layers[0]?.[1]
    const locked = map?.layers[1]?.[0]
    if (!map || !first || !other || !locked) throw new Error('expected a generated map')

    store.getState().selectNode(locked.id)
    expect(store.getState().toast).toBe('That node is not available from the current path.')
    expect(store.getState().document.run?.days[0]?.map?.currentNodeId).toBeNull()

    store.getState().selectNode(first.id)
    expect(store.getState().document.run?.days[0]?.map?.currentNodeId).toBe(first.id)
    expect(storedDocument(memory).run?.days[0]?.map?.currentNodeId).toBe(first.id)

    store.getState().selectNode(other.id)
    expect(store.getState().toast).toBe('A node is already chosen for this day.')
    expect(store.getState().document.run?.days[0]?.map?.currentNodeId).toBe(first.id)
  })

  it('rejects selection before the day is open', () => {
    const { store, base } = makeHarness()
    onboardAndStart(store, base)
    store.getState().selectNode('n0_0')
    expect(store.getState().toast).toBe('Open the day before choosing a node.')
  })

  it('survives a reload with the same map and current node', () => {
    const first = makeHarness()
    onboardAndStart(first.store, first.base)
    first.store.getState().openDay(undefined, first.base)
    const map = first.store.getState().document.run?.days[0]?.map
    const node = map?.layers[0]?.[0]
    if (!map || !node) throw new Error('expected a generated map')
    first.store.getState().selectNode(node.id)

    const reloaded = createAppStore({
      storage: createDocumentStorage(first.memory),
      now: () => first.base,
    })
    const day = reloaded.getState().document.run?.days[0]
    expect(day?.map?.id).toBe(map.id)
    expect(day?.map?.seed).toBe(map.seed)
    expect(day?.map?.layers).toEqual(map.layers)
    expect(day?.map?.currentNodeId).toBe(node.id)
    expect(day?.status).toBe('in_progress')
  })

  it('does not open a day for a closed run', () => {
    const { store, base } = makeHarness()
    const run = onboardAndStart(store, base)
    if (!run) throw new Error('expected a run')
    store.getState().importDocument({
      ...store.getState().document,
      run: { ...run, status: 'closed' },
    })
    store.getState().openDay(undefined, base)
    expect(store.getState().toast).toBe('There is no active run to open.')
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

  it('reopens the chosen node detail after hydration without persisting the view', () => {
    const { store, memory, base } = makeHarness()
    store.getState().completeOnboarding(createDemoSetup(base), base)
    store.getState().startRun(undefined, base)
    store.getState().openDay(undefined, base)

    const opened = store.getState().document.run
    const nodeId = opened?.days[0]?.map?.layers[0]?.[0]?.id
    expect(nodeId).toBeTruthy()
    if (!nodeId) throw new Error('the demo map must have a first node')
    store.getState().selectNode(nodeId)

    const reopened = createAppStore({
      storage: createDocumentStorage(memory),
      now: () => base,
    })
    expect(reopened.getState().view).toEqual({ name: 'node', nodeId })
    expect(reopened.getState().document.run?.days[0]?.map?.currentNodeId).toBe(nodeId)
    expect(memory.getItem(STORAGE_KEY)).not.toContain('"view"')
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

describe('resolving a node', () => {
  it('persists one complete resolution without navigating', () => {
    const { store, memory, base } = makeHarness()
    onboardAndStart(store, base)
    store.getState().openDay(undefined, base)

    const map = store.getState().document.run?.days[0]?.map
    const node = map?.layers[0]?.find((candidate) => candidate.type === 'task')
    if (!node) throw new Error('expected a layer-0 task node')
    store.getState().selectNode(node.id)

    const viewBefore = store.getState().view
    store.getState().resolveNode(node.id, 'complete', base)

    const document = store.getState().document
    const day = document.run?.days[0]
    expect(store.getState().toast).toBeNull()
    expect(store.getState().view).toBe(viewBefore)
    expect(day?.path).toEqual([
      { nodeId: node.id, action: 'complete', at: base.toISOString() },
    ])
    expect(day?.map?.currentNodeId).toBeNull()
    expect(day?.rewards).toHaveLength(1)
    expect(document.profile?.xp).toBe(node.rewards.xp)
    expect(document.profile?.gold).toBe(node.rewards.gold)

    const stored = storedDocument(memory)
    expect(stored.profile?.xp).toBe(node.rewards.xp)
    expect(stored.run?.days[0]?.path).toEqual(day?.path)
    expect(stored.run?.days[0]?.rewards).toEqual(day?.rewards)
  })

  it('survives a reload between resolutions without duplicating rewards', () => {
    const first = makeHarness()
    onboardAndStart(first.store, first.base)
    first.store.getState().openDay(undefined, first.base)

    const map = first.store.getState().document.run?.days[0]?.map
    const node = map?.layers[0]?.find((candidate) => candidate.type === 'task')
    if (!node) throw new Error('expected a layer-0 task node')
    first.store.getState().selectNode(node.id)
    first.store.getState().resolveNode(node.id, 'complete', first.base)
    const firstEvent = first.store.getState().document.run?.days[0]?.rewards[0]

    const reloaded = createAppStore({
      storage: createDocumentStorage(first.memory),
      now: () => first.base,
    })
    const day = currentDay(reloaded.getState().document.run)
    if (!day?.map) throw new Error('expected an open day after reload')
    const nextId = availableNodeIds(day.map, day)[0]
    if (!nextId) throw new Error('expected a connected node')

    reloaded.getState().selectNode(nextId)
    reloaded.getState().resolveNode(nextId, 'skip', first.base)

    const after = reloaded.getState().document.run?.days[0]
    expect(after?.path).toHaveLength(2)
    expect(after?.rewards).toHaveLength(2)
    expect(after?.rewards[0]).toEqual(firstEvent)
    expect(after?.rewards[1]?.action).toBe('skip')
    expect(after?.rewards[1]?.xp).toBe(0)
    expect(after?.rewards[1]?.gold).toBe(0)
    expect(storedDocument(first.memory).run?.days[0]?.path).toEqual(after?.path)
  })

  it('turns a rejected resolution into a toast and leaves rewards untouched', () => {
    const { store, base } = makeHarness()
    onboardAndStart(store, base)
    store.getState().openDay(undefined, base)

    const map = store.getState().document.run?.days[0]?.map
    const node = map?.layers[0]?.find((candidate) => candidate.type === 'task')
    const locked = map?.layers[1]?.[0]
    if (!node || !locked) throw new Error('expected a generated map')

    store.getState().resolveNode(locked.id, 'complete', base)
    expect(store.getState().toast).toBe(
      'That node is not available from the current path.',
    )

    store.getState().selectNode(node.id)
    store.getState().resolveNode(node.id, 'complete', base)
    const profile = store.getState().document.profile

    store.getState().resolveNode(node.id, 'complete', base)
    expect(store.getState().toast).toBe('That node has already been resolved.')
    expect(store.getState().document.profile).toBe(profile)
    expect(store.getState().document.run?.days[0]?.path).toHaveLength(1)
  })
})

function closedRunAt(base: Date, progress: number[] = [0, 0]): Run {
  const setup = createDemoSetup(base)
  const run = createRun({ setup, now: base, runId: 'run_store_closed' })
  return {
    ...run,
    status: 'closed',
    objectives: run.objectives.map((objective, index) => ({
      ...objective,
      progress: progress[index] ?? 0,
    })),
    days: run.days.map((day) => ({
      ...day,
      status: 'completed' as const,
      closedAt: base.toISOString(),
    })),
    closedAt: base.toISOString(),
  }
}

function closedDocumentAt(base: Date, progress: number[] = [0, 0]): GameDocument {
  const setup = createDemoSetup(base)
  return {
    ...createEmptyDocument(),
    profile: {
      id: 'profile_store_close',
      name: 'Wren',
      xp: 250,
      level: levelForXp(250),
      gold: 90,
      loot: [loot],
      createdAt: base.toISOString(),
    },
    goals: setup.goals,
    tasks: setup.tasks,
    run: closedRunAt(base, progress),
  }
}

describe('run close integration', () => {
  it('closes and finalizes automatically through reconcile after day 7', () => {
    const start = new Date(2026, 9, 20, 9, 0, 0)
    const afterWeek = new Date(2026, 9, 28, 9, 0, 0)
    const harness = makeHarness({ base: afterWeek })
    const setup = createDemoSetup(start)
    const run = createRun({ setup, now: start, runId: 'run_reconcile_close' })
    const document: GameDocument = {
      ...createEmptyDocument(),
      profile: {
        id: 'profile_reconcile',
        name: 'Wren',
        xp: 90,
        level: 1,
        gold: 10,
        loot: [],
        createdAt: start.toISOString(),
      },
      goals: setup.goals,
      tasks: setup.tasks,
      run: {
        ...run,
        objectives: run.objectives.map((objective, index) => ({
          ...objective,
          progress: index === 0 ? objective.target : 0,
        })),
        days: run.days.map((day, index) =>
          index < 6
            ? { ...day, status: 'completed' as const, closedAt: start.toISOString() }
            : day,
        ),
      },
    }

    expect(harness.store.getState().importDocument(document)).toBe(true)

    const closed = harness.store.getState().document
    const closedRun = closed.run
    if (!closedRun?.summary) throw new Error('expected an automatic run close')

    expect(closedRun.status).toBe('closed')
    expect(closedRun.days[6]?.status).toBe('missed')
    expect(closedRun.summary.bonusXp).toBe(50)
    expect(closedRun.summary.bonusGold).toBe(50)
    expect(closedRun.summary.totals.daysPlayed).toBe(6)
    expect(closedRun.summary.totals.daysMissed).toBe(1)
    expect(closedRun.totals).toEqual(closedRun.summary.totals)
    expect(closed.profile).toMatchObject({ xp: 140, level: 2, gold: 60 })
    expect(storedDocument(harness.memory).run?.summary).toEqual(closedRun.summary)

    harness.store.getState().reconcile(afterWeek)
    expect(harness.store.getState().document).toBe(closed)
    harness.store.getState().finalizeRun(afterWeek)
    expect(harness.store.getState().document).toBe(closed)
  })

  it('finalizes immediately after resolving the day-7 boss and only once', () => {
    const start = new Date(2026, 9, 20, 9, 0, 0)
    const daySeven = new Date(2026, 9, 26, 9, 0, 0)
    const harness = makeHarness({ base: daySeven })
    const setup = createDemoSetup(start)
    const run = createRun({ setup, now: start, runId: 'run_resolve_close' })
    const document: GameDocument = {
      ...createEmptyDocument(),
      profile: {
        id: 'profile_resolve',
        name: 'Wren',
        xp: 0,
        level: 1,
        gold: 0,
        loot: [],
        createdAt: start.toISOString(),
      },
      goals: setup.goals,
      tasks: setup.tasks,
      run: {
        ...run,
        objectives: run.objectives.map((objective) => ({
          ...objective,
          progress: objective.target,
        })),
        days: run.days.map((day, index) =>
          index < 6
            ? { ...day, status: 'completed' as const, closedAt: start.toISOString() }
            : day,
        ),
      },
    }

    expect(harness.store.getState().importDocument(document)).toBe(true)
    expect(harness.store.getState().document.run?.status).toBe('active')
    harness.store.getState().openDay(undefined, daySeven)

    for (let step = 0; step < 10; step += 1) {
      const current = harness.store.getState().document.run
      const day = currentDay(current)
      const map = day?.map
      if (!day || !map) break
      const nodeId = map.currentNodeId ?? availableNodeIds(map, day)[0]
      if (!nodeId) break
      if (!map.currentNodeId) harness.store.getState().selectNode(nodeId)
      harness.store.getState().resolveNode(nodeId, 'complete', daySeven)
    }

    const finished = harness.store.getState().document
    const finishedRun = finished.run
    const summary = finishedRun?.summary
    if (!finishedRun || !summary) throw new Error('expected a finalized run')

    const dayEventXp = (finishedRun.days[6]?.rewards ?? []).reduce(
      (total, event) => total + event.xp,
      0,
    )
    const dayEventGold = (finishedRun.days[6]?.rewards ?? []).reduce(
      (total, event) => total + event.gold,
      0,
    )

    expect(finishedRun.status).toBe('closed')
    expect(finishedRun.days[6]?.status).toBe('completed')
    expect(finishedRun.days[6]?.summary?.bossCompleted).toBe(true)
    expect(summary.allComplete).toBe(true)
    expect(summary.bonusXp).toBe(200)
    expect(summary.totals.xp).toBe(dayEventXp + 200)
    expect(summary.totals.gold).toBe(dayEventGold + summary.bonusGold)
    expect(finishedRun.totals).toEqual(summary.totals)
    expect(finished.profile?.xp).toBe(summary.totals.xp)
    expect(finished.profile?.gold).toBe(summary.totals.gold)
    expect(finished.profile?.level).toBe(
      levelForXp(finished.profile?.xp ?? 0),
    )
    expect(storedDocument(harness.memory).run?.summary).toEqual(summary)

    const profile = finished.profile
    harness.store.getState().finalizeRun(daySeven)
    expect(harness.store.getState().document).toBe(finished)
    expect(harness.store.getState().document.profile).toBe(profile)
  })
})

describe('starting a new run from the store', () => {
  it('keeps the profile and resets the run, then survives a reload', () => {
    const start = new Date(2026, 9, 20, 9, 0, 0)
    const afterWeek = new Date(2026, 9, 28, 9, 0, 0)
    const harness = makeHarness({ base: afterWeek })
    const document = closedDocumentAt(start)

    expect(harness.store.getState().importDocument(document)).toBe(true)
    const closed = harness.store.getState().document
    const previousRun = closed.run
    const previousProfile = closed.profile
    if (!previousRun?.summary || !previousProfile) {
      throw new Error('expected a finalized closed run')
    }

    harness.store.getState().startNewRun(afterWeek)

    const next = harness.store.getState().document
    const run = next.run
    if (!run) throw new Error('expected a new run')

    expect(harness.store.getState().toast).toBeNull()
    expect(harness.store.getState().view).toEqual({ name: 'home' })
    expect(harness.store.getState().history).toEqual([])
    expect(next.profile).toEqual(previousProfile)
    expect(next.goals).toEqual(closed.goals)
    expect(next.tasks).toEqual(closed.tasks)
    expect(next.onboardingDraft).toBeNull()
    expect(run.id).not.toBe(previousRun.id)
    expect(run.seed).not.toBe(previousRun.seed)
    expect(run.status).toBe('active')
    expect(run.startDate).toBe(dayKey(afterWeek))
    expect(run.days[0]?.date).toBe(dayKey(afterWeek))
    expect(run.days.map((day) => day.status)).toEqual([
      'available',
      'locked',
      'locked',
      'locked',
      'locked',
      'locked',
      'locked',
    ])
    expect(run.days.every((day) => day.map === null)).toBe(true)
    expect(run.totals).toEqual({
      xp: 0,
      gold: 0,
      lootCount: 0,
      nodesCompleted: 0,
      nodesSkipped: 0,
      daysPlayed: 0,
      daysMissed: 0,
    })
    expect(storedDocument(harness.memory).run?.id).toBe(run.id)

    const reloaded = createAppStore({
      storage: createDocumentStorage(harness.memory),
      now: () => afterWeek,
    })
    expect(reloaded.getState().document.profile).toEqual(previousProfile)
    expect(reloaded.getState().document.run?.id).toBe(run.id)
    expect(reloaded.getState().document.run?.status).toBe('active')
    expect(reloaded.getState().document.run?.days[0]?.status).toBe('available')
    expect(reloaded.getState().view).toEqual({ name: 'home' })
  })

  it('rejects an active run and an invalid setup without changing the run', () => {
    const { store, base } = makeHarness()
    onboardAndStart(store, base)

    const active = store.getState().document
    store.getState().startNewRun(base)
    expect(store.getState().toast).toBe(
      'Finish the current run before starting a new one.',
    )
    expect(store.getState().document).toBe(active)

    const invalid = {
      ...closedDocumentAt(base),
      profile: store.getState().document.profile,
      tasks: [],
    }
    expect(store.getState().importDocument(invalid)).toBe(true)
    const closed = store.getState().document
    const closedRunId = closed.run?.id
    if (!closedRunId) throw new Error('expected a closed run')

    store.getState().startNewRun(base)
    expect(store.getState().toast).toBe(
      'Add at least 4 routines to light the week.',
    )
    expect(store.getState().document).toBe(closed)
    expect(store.getState().document.run?.id).toBe(closedRunId)
  })
})
