import { parseDocument } from '@lifespire/core'
import { getDevOffsetDays, getNow } from '@lifespire/app-core/state/clock'
import { createSyncEngine } from '@lifespire/app-core/sync/syncEngine'
import type { SyncEngineState } from '@lifespire/app-core/sync/syncEngine'
import { createSyncManager } from '@lifespire/app-core/sync/manager'
import NetInfo from '@react-native-community/netinfo'
import { AppState } from 'react-native'
import { create } from 'zustand'
import { documentStorage, kv } from '../platform/storage'
import { useAppStore } from '../state/store'
import { engineApi } from './api'
import { useAuthStore } from './auth'
import { loadRefreshToken, setRefreshToken } from './tokenStore'

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
  lastAutoMergeAt: null,
  initialized: false,
}))

let online = true

export const syncEngine = createSyncEngine({
  storage: kv,
  api: engineApi,
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
  isOnline: () => online,
  useLocks: false,
  onBeforeAutoMergePush: () => {
    try {
      documentStorage.backup()
    } catch {
      // Backup is best-effort; the merge itself is already validated.
    }
  },
})

export const syncManager = createSyncManager({
  storage: kv,
  auth: useAuthStore as never,
  appStore: useAppStore as never,
  documentStorage,
  engine: syncEngine,
})

function syncEngineToUi(): void {
  const state = syncEngine.getState()
  useSyncStore.setState({ ...state, initialized: true })
}

/**
 * Starts auth restore, per-account storage switching, sync polling and the
 * foreground/network hooks. Returns an idempotent cleanup.
 */
export async function initSync(): Promise<() => void> {
  await loadRefreshToken()

  const stopEngineUi = syncEngine.subscribe(syncEngineToUi)
  syncEngineToUi()
  const stopManager = syncManager.start()

  try {
    await useAuthStore.getState().restore()
  } catch {
    // Guest mode when the backend is unreachable.
  }
  const restoredUser = useAuthStore.getState().user
  if (!restoredUser) setRefreshToken(null)
  const userId = restoredUser?.id ?? null
  await syncManager.switchToAccount(userId)
  syncEngineToUi()
  syncEngine.startPolling()

  const netInfoUnsubscribe = NetInfo.addEventListener((state) => {
    const wasOnline = online
    online = state.isConnected !== false
    if (!wasOnline && online) syncEngine.handleOnline()
  })
  void NetInfo.fetch().then((state) => {
    online = state.isConnected !== false
  })

  let appState = AppState.currentState ?? 'active'
  const appStateSubscription = AppState.addEventListener('change', (next) => {
    const becameActive = appState.match(/inactive|background/) && next === 'active'
    appState = next
    if (becameActive) {
      useAppStore.getState().reconcile()
      void syncEngine.pullNow()
      syncEngine.startPolling()
    } else if (next === 'background') {
      syncEngine.stopPolling()
    }
  })

  let previousUserId = useAuthStore.getState().user?.id ?? null
  const unsubscribeAuth = useAuthStore.subscribe((state) => {
    const nextId = state.user?.id ?? null
    if (nextId === previousUserId) return
    previousUserId = nextId
    void syncManager.switchToAccount(nextId).then(syncEngineToUi)
  })

  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    stopManager()
    unsubscribeAuth()
    appStateSubscription.remove()
    netInfoUnsubscribe()
    stopEngineUi()
    syncEngine.stopPolling()
  }
}
