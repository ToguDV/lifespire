import { create } from 'zustand'
import { parseDocument } from '../domain/schema'
import { getDevOffsetDays, getNow } from '../state/clock'
import { documentStorage } from '../state/persistence'
import { useAppStore } from '../state/store'
import { syncApi } from './api'
import { useAuthStore } from './authStore'
import { createSyncEngine } from './syncEngine'
import type { SyncEngineState } from './syncEngine'
import { createSyncManager } from './manager'

interface SyncUiState extends SyncEngineState {
  initialized: boolean
}

export const useSyncStore = create<SyncUiState>(() => ({
  status: 'disabled',
  userId: null,
  serverVersion: null,
  updatedAt: null,
  conflict: null,
  lastError: null,
  lastPushedAt: null,
  initialized: false,
}))

/**
 * Re-entrant init: React StrictMode mounts, unmounts and remounts before the
 * first async init settles. A plain `started` flag discards the run that did
 * the work while the surviving run early-returns with no subscriptions.
 * Refcounting keeps one shared init alive until every holder releases it.
 */
let initPromise: Promise<() => void> | null = null
let initRefs = 0

function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine !== false
}

function memoryLike(): { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
  }
}

function browserStorage(): { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    // Private mode falls back to memory.
  }
  return memoryLike()
}

export const syncEngine = createSyncEngine({
  storage: browserStorage(),
  api: syncApi,
  userId: null,
  getLocalDocument: () => useAppStore.getState().document,
  applyRemoteDocument: (document) => {
    const parsed = parseDocument(document)
    if (!parsed.ok) return
    syncManager.suppressRemoteApply(() => {
      useAppStore.setState({ document: parsed.value })
    })
    try {
      useAppStore.getState().reconcile(getNow())
    } catch {
      // Reconcile is best-effort after a remote apply.
    }
  },
  getDevOffset: () => {
    try {
      return getDevOffsetDays()
    } catch {
      return 0
    }
  },
  isOnline,
})

export const syncManager = createSyncManager({
  storage: browserStorage(),
  auth: useAuthStore as never,
  appStore: useAppStore as never,
  documentStorage,
  engine: syncEngine,
})

function syncEngineToUi(): void {
  const state = syncEngine.getState()
  useSyncStore.setState({ ...state, initialized: true })
}

async function doInitSync(): Promise<() => void> {
  const stopEngineUi = syncEngine.subscribe(syncEngineToUi)
  syncEngineToUi()

  // Subscribe before the first switch so edits made while restore/pull is in
  // flight (e.g. demo onboarding right after reload) are not missed.
  const stopManager = syncManager.start()

  try {
    await useAuthStore.getState().restore()
  } catch {
    // Guest mode when the backend is unreachable.
  }
  const userId = useAuthStore.getState().user?.id ?? null
  await syncManager.switchToAccount(userId)
  syncEngineToUi()

  syncEngine.startPolling()

  const handleOnline = (): void => {
    syncEngine.handleOnline()
  }
  const handleFocus = (): void => {
    void syncEngine.pullNow()
  }
  const handleVisibility = (): void => {
    if (document.visibilityState === 'visible') void syncEngine.pullNow()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
  }

  const unsubscribeAuth = useAuthStore.subscribe((state, previous) => {
    const nextId = state.user?.id ?? null
    const prevId = (previous as { user?: { id?: string } | null }).user?.id ?? null
    if (nextId !== prevId) {
      void syncManager.switchToAccount(nextId).then(syncEngineToUi)
    }
  })

  return () => {
    stopManager()
    unsubscribeAuth()
    stopEngineUi()
    syncEngine.stopPolling()
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }
}

export async function initSync(): Promise<() => void> {
  initRefs += 1
  if (!initPromise) {
    initPromise = doInitSync().catch(() => () => undefined)
  }
  const stop = await initPromise
  let released = false
  return () => {
    if (released) return
    released = true
    initRefs = Math.max(0, initRefs - 1)
    if (initRefs === 0) {
      initPromise = null
      stop()
    }
  }
}

export function resetSyncForTests(): void {
  initPromise = null
  initRefs = 0
}

if (typeof window !== 'undefined') {
  ;(window as unknown as { __lifespireSync?: unknown }).__lifespireSync = {
    engine: syncEngine,
    manager: syncManager,
    stores: { auth: useAuthStore, sync: useSyncStore, app: useAppStore },
  }
}
