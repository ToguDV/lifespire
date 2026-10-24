import { parseDocument } from '@lifespire/core'
import { getDevOffsetDays, getNow } from '@lifespire/app-core/state/clock'
import { createSyncEngine } from '@lifespire/app-core/sync/syncEngine'
import type { SyncEngineState } from '@lifespire/app-core/sync/syncEngine'
import { createSyncManager } from '@lifespire/app-core/sync/manager'
import NetInfo from '@react-native-community/netinfo'
import { AppState } from 'react-native'
import { create } from 'zustand'
import { documentStorage, kv } from '../platform/storage'
import { devError, devWarn } from '../lib/devLogger'
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
    if (!parsed.ok) {
      devWarn('sync', 'remote document rejected by the schema', undefined, {
        reason: parsed.reason,
      })
      return
    }
    syncManager.suppressRemoteApply(() => {
      useAppStore.setState({ document: parsed.value })
    })
    try {
      useAppStore.getState().reconcile(getNow())
    } catch (error) {
      devWarn('sync', 'reconcile after a remote apply failed', error)
    }
  },
  getDevOffset: () => {
    try {
      return getDevOffsetDays()
    } catch (error) {
      devWarn('sync', 'could not read the development clock offset', error)
      return 0
    }
  },
  isOnline: () => online,
  useLocks: false,
  onBeforeAutoMergePush: () => {
    try {
      documentStorage.backup()
    } catch (error) {
      devWarn('sync', 'pre-merge backup failed', error)
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
  } catch (error) {
    devError('auth', 'session restore failed; continuing as guest', error)
  }
  const restoredUser = useAuthStore.getState().user
  if (!restoredUser) setRefreshToken(null)
  const userId = restoredUser?.id ?? null
  try {
    await syncManager.switchToAccount(userId)
  } catch (error) {
    devError('sync', 'account switch failed; the local save is still usable', error, {
      signedIn: userId !== null,
    })
  }
  syncEngineToUi()
  syncEngine.startPolling()

  const netInfoUnsubscribe = NetInfo.addEventListener((state) => {
    const wasOnline = online
    online = state.isConnected !== false
    if (!wasOnline && online) syncEngine.handleOnline()
  })
  void NetInfo.fetch()
    .then((state) => {
      online = state.isConnected !== false
    })
    .catch((error: unknown) => {
      devWarn('sync', 'could not read the initial network state', error)
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
    void syncManager
      .switchToAccount(nextId)
      .then(syncEngineToUi)
      .catch((error: unknown) => {
        devError('sync', 'account switch after an auth change failed', error, { nextId })
      })
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
