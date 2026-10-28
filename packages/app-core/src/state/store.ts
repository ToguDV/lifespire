import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'
import { persist } from 'zustand/middleware'
import { toUserMessage } from '../ui/userError'
import { createDemoSetup, validateSetup } from '@lifespire/core'
import { SCHEMA_VERSION, STORAGE_KEY } from '@lifespire/core'
import {
  CONTENT_MESSAGES,
  contentFailure,
  contentSuccess,
  goalHasActiveRoutine,
  validateContentConstraints,
  validateGoalInput,
  validateTaskInput,
} from '@lifespire/core'
import type { ContentActionResult } from '@lifespire/core'
import { dayKey } from '@lifespire/core'
import { isGoalIconId, nextGoalIcon } from '@lifespire/core'
import {
  createRun,
  openDay as openDayDocument,
  reconcileDays,
  resetCurrentDay as resetCurrentDayDocument,
  resolveNode as resolveNodeDocument,
  selectNode as selectNodeDocument,
} from '@lifespire/core'
import { finalizeIfNeeded, startNewRun as startNewRunDocument } from '@lifespire/core'
import { createEmptyDocument, parseDocument } from '@lifespire/core'
import { currentDay, levelForXp, resolveNodeById } from '@lifespire/core'
import type {
  GameDocument,
  Goal,
  GoalInput,
  OnboardingDraft,
  OnboardingSetup,
  Profile,
  ResolutionAction,
  RewardEvent,
  Run,
  RunSetup,
  StorageIssue,
  Task,
  TaskInput,
  ThemePreference,
  View,
} from '@lifespire/core'
import { advanceDevDay, deviceTimeZone, getNow, resetDevClock } from './clock'
import { documentStorage } from './persistence'
import type {
  DocumentStorageController,
  PersistedSlice,
  StorageWriteWarning,
} from './persistence'

export interface AppState {
  document: GameDocument
  hydrated: boolean
  storageIssue: StorageIssue | null
  /** Transient: a failed localStorage write while the app keeps running. */
  storageWarning: 'write-failed' | null
  view: View
  history: View[]
  toast: string | null
  /** Rich reward recap shown after a completion. Transient, never persisted. */
  rewardToast: RewardEvent | null

  navigate(view: View): void
  /** Leaves the transient wheel recap without re-adding it to the back stack. */
  finishReward(view: View): void
  back(): void
  updateOnboardingDraft(patch: Partial<OnboardingDraft>): void
  completeOnboarding(setup: OnboardingSetup, now?: Date): void
  beginJourney(setup: OnboardingSetup, now?: Date): boolean
  startRun(setup?: RunSetup, now?: Date): void
  reconcile(now?: Date): void
  openDay(dayId?: string, now?: Date): void
  resetCurrentDay(now?: Date): void
  selectNode(nodeId: string): void
  resolveNode(nodeId: string, action: ResolutionAction, now?: Date): void
  finalizeRun(now?: Date): void
  /**
   * Replaces a closed run with a fresh one. Optional reviewed goals are written
   * in the same transition, so a failed start never leaves half-applied targets.
   */
  startNewRun(now?: Date, goals?: Goal[]): boolean
  saveGoal(input: GoalInput, now?: Date): ContentActionResult
  archiveGoal(goalId: string, now?: Date): ContentActionResult
  saveTask(input: TaskInput, now?: Date): ContentActionResult
  archiveTask(taskId: string, now?: Date): ContentActionResult
  setTheme(theme: ThemePreference): void
  importDocument(nextDocument: GameDocument): boolean
  /** Rehydrates the newest save written by another tab without overwriting it. */
  syncFromStorage(): void
  /** Raw storage text, including a blocked save, for recovery exports. */
  exportRawSave(): string | null
  resetAll(): void
  newId(prefix: string): string
  showToast(message: string | null): void
  showRewardToast(event: RewardEvent | null): void
  clearRewardToast(): void

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
  /** IANA zone pinned on newly created runs. Defaults to the device zone. */
  timeZone?: () => string
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
  return toUserMessage(error, fallback)
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
  if (a.name === 'reward' && b.name === 'reward') return a.nodeId === b.nodeId
  if (a.name === 'day-summary' && b.name === 'day-summary') return a.dayId === b.dayId
  if (a.name === 'recovery' && b.name === 'recovery') return a.reason === b.reason
  return true
}

const EXTERNAL_CHANGE_TOAST =
  'This save changed in another tab. The latest version is now open.'
const EXTERNAL_CHANGE_UNREADABLE_TOAST =
  'This save changed in another tab, but it could not be read. Your current progress is still here.'
const EXTERNAL_RESET_TOAST =
  'Local data was reset in another tab. LifeSpire returned to onboarding.'

export function createAppStore(
  deps: StoreDeps = {},
): UseBoundStore<StoreApi<AppState>> {
  const storage = deps.storage ?? documentStorage
  const nowProvider = deps.now ?? getNow
  const idFactory = deps.idFactory ?? newId
  const zoneProvider = deps.timeZone ?? deviceTimeZone

  /**
   * Applies an in-memory transition while the save key is intentionally absent,
   * so persist cannot recreate it with an empty document. The temporary block
   * is never surfaced: any issue it creates is cleared when writes are unlocked.
   */
  const applyWithEmptyStorage = (apply: () => void): void => {
    storage.blockWrites({ reason: 'corrupt' })
    try {
      apply()
    } finally {
      storage.unblockWrites()
    }
  }

  const store = create<AppState>()(
    persist<AppState, [], [], PersistedSlice>(
      (set, get) => ({
        document: createEmptyDocument(),
        hydrated: false,
        storageIssue: null,
        storageWarning: null,
        view: { name: 'onboarding' },
        history: [],
        toast: null,
        rewardToast: null,

        navigate: (nextView) => {
          const { view, history } = get()
          if (sameView(view, nextView)) return
          set({ view: nextView, history: [...history, view] })
        },

        finishReward: (nextView) => {
          const { history } = get()
          // The recap is a transient step: the node that opened it is already
          // resolved, so neither it nor a stale reward belongs on the back stack.
          let next = history.filter((entry) => entry.name !== 'reward')
          if (next.length > 0 && next[next.length - 1].name === 'node') {
            next = next.slice(0, -1)
          }
          // Avoid a no-op back press when the destination is already on top.
          if (next.length > 0 && sameView(next[next.length - 1], nextView)) {
            next = next.slice(0, -1)
          }
          set({ view: nextView, history: next })
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

        /**
         * Onboarding's single transition: profile, content, the seven-day run,
         * the day-1 map and the cleared draft are written together. Any
         * validation or map-generation failure leaves the document untouched.
         */
        beginJourney: (setup, at = nowProvider()) => {
          const validation = validateSetup(setup.goals, setup.tasks)
          if (!validation.ok) {
            set({ toast: validation.errors[0] ?? 'This path cannot begin yet.' })
            return false
          }

          const current = get().document
          if (current.profile) {
            set({ toast: 'Your journey has already begun.' })
            return false
          }

          const profile: Profile = {
            id: idFactory('profile'),
            name: setup.name.trim() || 'Wayfarer',
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
            timeZone: zoneProvider(),
          })
          const seeded: GameDocument = {
            ...current,
            profile,
            goals: [...setup.goals],
            tasks: [...setup.tasks],
            run,
            onboardingDraft: null,
          }

          let next: GameDocument
          try {
            next = openDayDocument(seeded, { now: at })
          } catch (error) {
            set({ toast: errorMessage(error, 'This path cannot begin yet.') })
            return false
          }

          set({
            document: next,
            view: { name: 'home' },
            history: [],
            toast: null,
          })
          return true
        },

        startRun: (setup, at = nowProvider()) => {
          const current = get().document
          if (!current.profile) {
            set({ toast: 'Finish onboarding before you begin a run.' })
            return
          }
          if (current.run?.status === 'active') {
            set({ toast: 'Finish the current run before starting a new one.' })
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
            timeZone: zoneProvider(),
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
          const run = reconcileDays(current.run, dayKey(at, current.run.timeZone ?? null), at)
          const reconciled = run === current.run ? current : { ...current, run }
          const next = finalizeIfNeeded(reconciled, at)
          if (next !== current) set({ document: next })
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

        resetCurrentDay: (at = nowProvider()) => {
          get().reconcile(at)
          const current = get().document
          try {
            const next = resetCurrentDayDocument(current, at)
            set({
              document: withSyncedLevel(next),
              view: { name: 'home' },
              history: [],
              toast: 'Today is unwritten. Its rewards were taken back.',
            })
          } catch (error) {
            set({ toast: errorMessage(error, 'Today cannot be reset.') })
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
            set({
              document: finalizeIfNeeded(withSyncedLevel(next), at),
              toast: null,
            })
          } catch (error) {
            set({ toast: errorMessage(error, 'That step cannot be recorded.') })
          }
        },

        finalizeRun: (at = nowProvider()) => {
          get().reconcile(at)
          const current = get().document
          const next = finalizeIfNeeded(current, at)
          if (next !== current) set({ document: next })
        },

        startNewRun: (at = nowProvider(), goals) => {
          // Reconcile first so a run that is due to close is sealed (and its
          // weekly bonus granted) before it is replaced. The domain transition
          // itself is atomic and only accepts a closed previous run. Reviewed
          // goals are written together with the run, never before it.
          get().reconcile(at)
          const current = get().document
          const seeded = goals ? { ...current, goals: [...goals] } : current
          try {
            const next = startNewRunDocument(seeded, {
              runId: idFactory('run'),
              now: at,
              timeZone: zoneProvider(),
            })
            set({
              document: next,
              view: { name: 'home' },
              history: [],
              toast: null,
            })
            return true
          } catch (error) {
            set({ toast: errorMessage(error, 'A new run cannot begin yet.') })
            return false
          }
        },

        saveGoal: (input, at = nowProvider()) => {
          get().reconcile(at)
          const current = get().document
          const existing = input.id
            ? current.goals.find((goal) => goal.id === input.id)
            : undefined
          if (input.id && !existing) {
            const failure = contentFailure({ form: CONTENT_MESSAGES.missingGoal })
            set({ toast: failure.errors[0] ?? null })
            return failure
          }

          const goal: Goal = {
            id: existing?.id ?? idFactory('goal'),
            title: input.title.trim(),
            category: input.category?.trim() || existing?.category || 'General',
            description: (input.description ?? existing?.description ?? '').trim(),
            icon: isGoalIconId(input.icon)
              ? input.icon
              : existing?.icon ?? nextGoalIcon(current.goals),
            weeklyObjective: input.weeklyObjective,
            active: input.active,
            createdAt: existing?.createdAt ?? input.createdAt ?? at.toISOString(),
          }

          const fieldErrors = validateGoalInput(goal)
          if (Object.keys(fieldErrors).length > 0) {
            const failure = contentFailure(fieldErrors)
            set({ toast: failure.errors[0] ?? null })
            return failure
          }

          const goals = existing
            ? current.goals.map((candidate) => (candidate.id === goal.id ? goal : candidate))
            : [...current.goals, goal]

          // Archiving a goal archives its routines too, so no active routine
          // can point at an inactive goal.
          const tasks =
            existing?.active && !goal.active
              ? current.tasks.map((task) =>
                  task.goalId === goal.id && task.active ? { ...task, active: false } : task,
                )
              : current.tasks

          const constraint = validateContentConstraints(current, goals, tasks)
          if (!constraint.ok) {
            set({ toast: constraint.errors[0] ?? null })
            return constraint
          }

          set({ document: { ...current, goals, tasks }, toast: null })
          return contentSuccess()
        },

        archiveGoal: (goalId, at = nowProvider()) => {
          get().reconcile(at)
          const current = get().document
          const goal = current.goals.find((candidate) => candidate.id === goalId)
          if (!goal) {
            const failure = contentFailure({ form: CONTENT_MESSAGES.missingGoal })
            set({ toast: failure.errors[0] ?? null })
            return failure
          }
          if (!goal.active) return contentSuccess()

          const goals = current.goals.map((candidate) =>
            candidate.id === goal.id ? { ...candidate, active: false } : candidate,
          )
          const tasks = current.tasks.map((task) =>
            task.goalId === goal.id && task.active ? { ...task, active: false } : task,
          )

          const constraint = validateContentConstraints(current, goals, tasks)
          if (!constraint.ok) {
            set({ toast: constraint.errors[0] ?? null })
            return constraint
          }

          set({ document: { ...current, goals, tasks }, toast: null })
          return contentSuccess()
        },

        saveTask: (input, at = nowProvider()) => {
          get().reconcile(at)
          const current = get().document
          const existing = input.id
            ? current.tasks.find((task) => task.id === input.id)
            : undefined
          if (input.id && !existing) {
            const failure = contentFailure({ form: CONTENT_MESSAGES.missingTask })
            set({ toast: failure.errors[0] ?? null })
            return failure
          }

          const task: Task = {
            id: existing?.id ?? idFactory('task'),
            goalId: input.goalId,
            title: input.title.trim(),
            effort: input.effort,
            active: input.active,
            createdAt: existing?.createdAt ?? input.createdAt ?? at.toISOString(),
          }

          const fieldErrors = validateTaskInput(task, current.goals)
          if (Object.keys(fieldErrors).length > 0) {
            const failure = contentFailure(fieldErrors)
            set({ toast: failure.errors[0] ?? null })
            return failure
          }

          const tasks = existing
            ? current.tasks.map((candidate) => (candidate.id === task.id ? task : candidate))
            : [...current.tasks, task]

          if (
            current.run?.status === 'active' &&
            existing?.active &&
            !(task.active && task.goalId === existing.goalId) &&
            !goalHasActiveRoutine(current.goals, tasks, existing.goalId)
          ) {
            const failure = contentFailure({ tasks: CONTENT_MESSAGES.aimWithoutRoutine })
            set({ toast: failure.errors[0] ?? null })
            return failure
          }

          const constraint = validateContentConstraints(current, current.goals, tasks)
          if (!constraint.ok) {
            set({ toast: constraint.errors[0] ?? null })
            return constraint
          }

          set({ document: { ...current, tasks }, toast: null })
          return contentSuccess()
        },

        archiveTask: (taskId, at = nowProvider()) => {
          get().reconcile(at)
          const current = get().document
          const task = current.tasks.find((candidate) => candidate.id === taskId)
          if (!task) {
            const failure = contentFailure({ form: CONTENT_MESSAGES.missingTask })
            set({ toast: failure.errors[0] ?? null })
            return failure
          }
          if (!task.active) return contentSuccess()

          const tasks = current.tasks.map((candidate) =>
            candidate.id === task.id ? { ...candidate, active: false } : candidate,
          )

          if (
            current.run?.status === 'active' &&
            !goalHasActiveRoutine(current.goals, tasks, task.goalId)
          ) {
            const failure = contentFailure({ tasks: CONTENT_MESSAGES.aimWithoutRoutine })
            set({ toast: failure.errors[0] ?? null })
            return failure
          }

          const constraint = validateContentConstraints(current, current.goals, tasks)
          if (!constraint.ok) {
            set({ toast: constraint.errors[0] ?? null })
            return constraint
          }

          set({ document: { ...current, tasks }, toast: null })
          return contentSuccess()
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

          const imported = withSyncedLevel(parsed.value)
          if (imported.run && !imported.profile) {
            set({ toast: 'That save has a run but no profile.' })
            return false
          }

          // A structurally valid active run can still be unplayable. Reject the
          // import before touching storage so the current document survives.
          if (imported.run?.status === 'active') {
            const constraint = validateContentConstraints(
              imported,
              imported.goals,
              imported.tasks,
            )
            if (!constraint.ok) {
              set({ toast: constraint.errors[0] ?? 'That save cannot continue this run.' })
              return false
            }
          }

          storage.backup()
          storage.unblockWrites()
          set({
            document: imported,
            storageIssue: null,
            toast: 'Save restored.',
          })
          // Reconcile before deriving the view: an imported run may be due to
          // close (and receive its weekly summary) during hydration.
          get().reconcile()
          set({
            view: deriveInitialView(get().document, null),
            history: [],
          })
          return true
        },

        syncFromStorage: () => {
          if (storage.read() === null) {
            // Another tab reset the save. Rebuild the in-memory empty document
            // without writing it back: the storage is already empty and the
            // no-op check cannot cover this transition on its own.
            storage.unblockWrites()
            storage.clear()
            applyWithEmptyStorage(() => {
              set({
                document: withSyncedLevel(createEmptyDocument()),
                storageIssue: null,
                view: { name: 'onboarding' },
                history: [],
                toast: EXTERNAL_RESET_TOAST,
              })
            })
            return
          }
          // Rehydrating reads the remote raw synchronously and updates the
          // adapter's last-written marker, so the following sets are no-ops
          // unless reconciliation genuinely changes the document.
          store.persist.rehydrate()
          const issue = storage.consumeIssue()
          if (issue) {
            set({ toast: EXTERNAL_CHANGE_UNREADABLE_TOAST })
            return
          }

          storage.unblockWrites()
          const synced = withSyncedLevel(get().document)
          const documentChanged = synced !== get().document
          if (documentChanged) set({ document: synced })
          set({ storageIssue: null, toast: EXTERNAL_CHANGE_TOAST })
          get().reconcile()
          set({
            view: deriveInitialView(get().document, get().storageIssue),
            history: [],
          })
        },

        exportRawSave: () => storage.read(),

        resetAll: () => {
          storage.backup()
          storage.unblockWrites()
          storage.clear()
          // Keep the key removed so other tabs observe a real reset (null)
          // instead of an empty document written back by persist.
          applyWithEmptyStorage(() => {
            set({
              document: createEmptyDocument(),
              storageIssue: null,
              view: { name: 'onboarding' },
              history: [],
              toast: null,
            })
          })
        },

        newId: (prefix) => idFactory(prefix),

        showToast: (message) => {
          set({ toast: message })
        },

        showRewardToast: (event) => {
          set({ rewardToast: event })
        },

        clearRewardToast: () => {
          set({ rewardToast: null })
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
            timeZone: zoneProvider(),
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
            timeZone: zoneProvider(),
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
        todayKey: () => dayKey(nowProvider(), get().document.run?.timeZone ?? null),
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

  storage.setWriteStatusListener((warning: StorageWriteWarning) => {
    if (store.getState().storageWarning === warning) return
    store.setState({ storageWarning: warning })
  })

  // Coalesce multiple storage events and let the current synchronous action
  // settle before reading the remote document.
  let syncQueued = false
  const requestStorageSync = (): void => {
    if (syncQueued) return
    syncQueued = true
    queueMicrotask(() => {
      syncQueued = false
      store.getState().syncFromStorage()
    })
  }
  storage.setExternalChangeListener(requestStorageSync)
  storage.setConflictListener(requestStorageSync)

  const issue = storage.consumeIssue()
  const hydratedDocument = withSyncedLevel(store.getState().document)
  store.setState({
    hydrated: store.persist.hasHydrated(),
    storageIssue: issue,
    document: hydratedDocument,
    view: deriveInitialView(hydratedDocument, issue),
    history: [],
  })
  store.getState().reconcile()

  // A run that elapsed while the app was closed is closed and finalized by
  // reconcile. Derive the view again so the player lands on the weekly summary
  // instead of a home screen that can no longer offer today's map.
  const settled = store.getState().document
  const settledView = deriveInitialView(settled, store.getState().storageIssue)
  if (!sameView(store.getState().view, settledView)) {
    store.setState({ view: settledView, history: [] })
  }

  return store
}
