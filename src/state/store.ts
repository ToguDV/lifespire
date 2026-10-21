import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'
import { persist } from 'zustand/middleware'
import { createDemoSetup, validateSetup } from '../content/demo'
import { SCHEMA_VERSION, STORAGE_KEY } from '../domain/balance'
import { dayKey } from '../domain/dates'
import {
  createRun,
  openDay as openDayDocument,
  reconcileDays,
  resolveNode as resolveNodeDocument,
  selectNode as selectNodeDocument,
} from '../domain/lifecycle'
import { createEmptyDocument, parseDocument } from '../domain/schema'
import { currentDay, levelForXp, resolveNodeById } from '../domain/selectors'
import type {
  GameDocument,
  Goal,
  OnboardingDraft,
  OnboardingSetup,
  Profile,
  ResolutionAction,
  Run,
  RunSetup,
  StorageIssue,
  Task,
  ThemePreference,
  View,
} from '../domain/types'
import { advanceDevDay, getNow, resetDevClock } from './clock'
import { documentStorage } from './persistence'
import type { DocumentStorageController, PersistedSlice } from './persistence'

export interface AppState {
  document: GameDocument
  hydrated: boolean
  storageIssue: StorageIssue | null
  view: View
  history: View[]
  toast: string | null

  navigate(view: View): void
  back(): void
  updateOnboardingDraft(patch: Partial<OnboardingDraft>): void
  completeOnboarding(setup: OnboardingSetup, now?: Date): void
  startRun(setup?: RunSetup, now?: Date): void
  reconcile(now?: Date): void
  openDay(dayId?: string, now?: Date): void
  selectNode(nodeId: string): void
  resolveNode(nodeId: string, action: ResolutionAction, now?: Date): void
  setTheme(theme: ThemePreference): void
  importDocument(nextDocument: GameDocument): boolean
  resetAll(): void
  newId(prefix: string): string
  showToast(message: string | null): void

  devStartDemoRun(now?: Date): void
  devRestartRun(now?: Date): void
  devAdvanceDay(days?: number): void
  devResetAll(): void

  profile(): Profile | null
  run(): Run | null
  todayKey(): string
  activeGoals(): Goal[]
  activeTasks(): Task[]
}

export interface StoreDeps {
  storage?: DocumentStorageController
  now?: () => Date
  idFactory?: (prefix: string) => string
}

let fallbackIdCounter = 0

function fallbackUuid(): string {
  fallbackIdCounter += 1
  const stamp =
    typeof globalThis.performance?.now === 'function'
      ? Math.floor(globalThis.performance.now()).toString(36)
      : fallbackIdCounter.toString(36)
  return `${stamp}-${fallbackIdCounter.toString(36)}`
}

export function newId(prefix: string): string {
  const uuid =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : fallbackUuid()
  return `${prefix}_${uuid}`
}

function withSyncedLevel(document: GameDocument): GameDocument {
  if (!document.profile) return document
  const level = levelForXp(document.profile.xp)
  if (document.profile.level === level) return document
  return { ...document, profile: { ...document.profile, level } }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

/** First view after hydration. Recovery wins over every other flow. */
export function deriveInitialView(
  document: GameDocument,
  storageIssue: StorageIssue | null,
): View {
  if (storageIssue) {
    return { name: 'recovery', reason: storageIssue.reason }
  }
  if (!document.profile) {
    return { name: 'onboarding' }
  }
  if (document.run?.status === 'closed') {
    return { name: 'run-summary' }
  }
  // The chosen node survives a reload through the persisted map. The view is
  // still transient: it is derived from the document, never written to storage.
  const day = currentDay(document.run)
  const selectedId = day?.status === 'in_progress' ? day.map?.currentNodeId : null
  if (day?.map && selectedId && resolveNodeById(day.map, selectedId)) {
    return { name: 'node', nodeId: selectedId }
  }
  return { name: 'home' }
}

function sameView(a: View, b: View): boolean {
  if (a.name !== b.name) return false
  if (a.name === 'node' && b.name === 'node') return a.nodeId === b.nodeId
  if (a.name === 'day-summary' && b.name === 'day-summary') return a.dayId === b.dayId
  if (a.name === 'recovery' && b.name === 'recovery') return a.reason === b.reason
  return true
}

export function createAppStore(
  deps: StoreDeps = {},
): UseBoundStore<StoreApi<AppState>> {
  const storage = deps.storage ?? documentStorage
  const nowProvider = deps.now ?? getNow
  const idFactory = deps.idFactory ?? newId

  const store = create<AppState>()(
    persist<AppState, [], [], PersistedSlice>(
      (set, get) => ({
        document: createEmptyDocument(),
        hydrated: false,
        storageIssue: null,
        view: { name: 'onboarding' },
        history: [],
        toast: null,

        navigate: (nextView) => {
          const { view, history } = get()
          if (sameView(view, nextView)) return
          set({ view: nextView, history: [...history, view] })
        },

        back: () => {
          const { history } = get()
          if (history.length === 0) return
          const previous = history[history.length - 1]
          set({ view: previous, history: history.slice(0, -1) })
        },

        updateOnboardingDraft: (patch) => {
          const current = get().document
          const draft: OnboardingDraft = current.onboardingDraft ?? {
            step: 0,
            mode: null,
            name: '',
            goals: [],
            tasks: [],
          }
          set({
            document: {
              ...current,
              onboardingDraft: { ...draft, ...patch },
            },
          })
        },

        completeOnboarding: (setup, at = nowProvider()) => {
          const validation = validateSetup(setup.goals, setup.tasks)
          if (!validation.ok) {
            set({ toast: validation.errors[0] ?? 'This path cannot begin yet.' })
            return
          }

          const current = get().document
          const profile: Profile = {
            id: idFactory('profile'),
            name: setup.name.trim() || 'Wayfarer',
            xp: 0,
            level: levelForXp(0),
            gold: 0,
            loot: [],
            createdAt: at.toISOString(),
          }

          set({
            document: {
              ...current,
              profile,
              goals: [...setup.goals],
              tasks: [...setup.tasks],
              run: null,
              onboardingDraft: null,
            },
            toast: null,
          })
        },

        startRun: (setup, at = nowProvider()) => {
          const current = get().document
          if (!current.profile) {
            set({ toast: 'Finish onboarding before you begin a run.' })
            return
          }

          const goals = setup ? setup.goals : current.goals
          const tasks = setup ? setup.tasks : current.tasks
          const validation = validateSetup(goals, tasks)
          if (!validation.ok) {
            set({ toast: validation.errors[0] ?? 'This path cannot begin yet.' })
            return
          }

          const run = createRun({
            setup: { goals, tasks },
            now: at,
            runId: idFactory('run'),
          })

          set({
            document: {
              ...current,
              goals: [...goals],
              tasks: [...tasks],
              run,
              onboardingDraft: null,
            },
            toast: null,
          })
        },

        reconcile: (at = nowProvider()) => {
          const current = get().document
          if (!current.run) return
          const run = reconcileDays(current.run, dayKey(at), at)
          if (run !== current.run) {
            set({ document: { ...current, run } })
          }
        },

        openDay: (dayId, at = nowProvider()) => {
          get().reconcile(at)
          const current = get().document
          try {
            const next = openDayDocument(current, { dayId, now: at })
            set({ document: next, toast: null })
          } catch (error) {
            set({ toast: errorMessage(error, 'This day cannot be opened.') })
          }
        },

        selectNode: (nodeId) => {
          const at = nowProvider()
          get().reconcile(at)
          const current = get().document
          try {
            const next = selectNodeDocument(current, nodeId)
            set({ document: next, toast: null })
          } catch (error) {
            set({ toast: errorMessage(error, 'That node cannot be chosen.') })
          }
        },

        resolveNode: (nodeId, action, at = nowProvider()) => {
          get().reconcile(at)
          const current = get().document
          try {
            const next = resolveNodeDocument(current, { nodeId, action, now: at })
            set({ document: withSyncedLevel(next), toast: null })
          } catch (error) {
            set({ toast: errorMessage(error, 'That step cannot be recorded.') })
          }
        },

        setTheme: (theme) => {
          const current = get().document
          if (current.settings.theme === theme) return
          set({
            document: {
              ...current,
              settings: { ...current.settings, theme },
            },
          })
        },

        importDocument: (nextDocument) => {
          const parsed = parseDocument(nextDocument)
          if (!parsed.ok) {
            set({
              toast:
                parsed.reason === 'future-version'
                  ? 'That save comes from a newer version of LifeSpire.'
                  : 'That file is not a valid LifeSpire save.',
            })
            return false
          }

          storage.unblockWrites()
          const imported = withSyncedLevel(parsed.value)
          set({
            document: imported,
            storageIssue: null,
            view: deriveInitialView(imported, null),
            history: [],
            toast: 'Save restored.',
          })
          get().reconcile()
          return true
        },

        resetAll: () => {
          storage.unblockWrites()
          storage.clear()
          set({
            document: createEmptyDocument(),
            storageIssue: null,
            view: { name: 'onboarding' },
            history: [],
            toast: null,
          })
        },

        newId: (prefix) => idFactory(prefix),

        showToast: (message) => {
          set({ toast: message })
        },

        devStartDemoRun: (at = nowProvider()) => {
          const setup = createDemoSetup(at)
          const profile: Profile = {
            id: idFactory('profile'),
            name: setup.name,
            xp: 0,
            level: levelForXp(0),
            gold: 0,
            loot: [],
            createdAt: at.toISOString(),
          }
          const run = createRun({
            setup: { goals: setup.goals, tasks: setup.tasks },
            now: at,
            runId: idFactory('run'),
          })
          const current = get().document

          set({
            document: {
              ...current,
              profile,
              goals: [...setup.goals],
              tasks: [...setup.tasks],
              run,
              onboardingDraft: null,
            },
            toast: 'Demo run ready.',
          })
        },

        devRestartRun: (at = nowProvider()) => {
          const current = get().document
          if (!current.profile) {
            set({ toast: 'Finish onboarding before you begin a run.' })
            return
          }

          const validation = validateSetup(current.goals, current.tasks)
          if (!validation.ok) {
            set({ toast: validation.errors[0] ?? 'This path cannot begin yet.' })
            return
          }

          const run = createRun({
            setup: { goals: current.goals, tasks: current.tasks },
            now: at,
            runId: idFactory('run'),
          })

          set({
            document: { ...current, run, onboardingDraft: null },
            toast: 'A new run begins.',
          })
        },

        devAdvanceDay: (days = 1) => {
          advanceDevDay(days)
          get().reconcile()
        },

        devResetAll: () => {
          resetDevClock()
          get().resetAll()
        },

        profile: () => get().document.profile,
        run: () => get().document.run,
        todayKey: () => dayKey(nowProvider()),
        activeGoals: () => get().document.goals.filter((goal) => goal.active),
        activeTasks: () => {
          const goalIds = new Set(
            get()
              .document.goals.filter((goal) => goal.active)
              .map((goal) => goal.id),
          )
          return get().document.tasks.filter(
            (task) => task.active && goalIds.has(task.goalId),
          )
        },
      }),
      {
        name: STORAGE_KEY,
        version: SCHEMA_VERSION,
        storage: storage.storage,
        partialize: (state) => ({ document: state.document }),
      },
    ),
  )

  const issue = storage.consumeIssue()
  const hydratedDocument = withSyncedLevel(store.getState().document)
  store.setState({
    hydrated: true,
    storageIssue: issue,
    document: hydratedDocument,
    view: deriveInitialView(hydratedDocument, issue),
    history: [],
  })
  store.getState().reconcile()

  return store
}

export const useAppStore = createAppStore()
