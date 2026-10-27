import { create } from 'zustand'
import { parseDocument } from '@lifespire/core'
import { getDevOffsetDays, getNow } from '@lifespire/app-core/state/clock'
import { createLocalSyncEngine } from '@lifespire/app-core/sync/localEngine'
import type { LocalSyncState } from '@lifespire/app-core/sync/localEngine'
import { sanitizeName } from '@lifespire/app-core/sync/protocol'
import { DEVICE_NAME_KEY, DISCOVERABLE_KEY } from '@lifespire/app-core/sync/storageKeys'
import * as Device from 'expo-device'
import NetInfo from '@react-native-community/netinfo'
import { AppState, Platform } from 'react-native'
import { documentStorage, kv, localSyncMigration } from '../platform/storage'
import { devWarn } from '../lib/devLogger'
import { useAppStore } from '../state/store'
import { androidTransport } from './localTransport'

export const useSyncStore = create<LocalSyncState>(() => ({
  initialized: false,
  available: true,
  phase: 'off',
  device: null,
  discoverable: true,
  nearby: [],
  peers: {},
  conflicts: [],
  pairing: null,
  lastError: null,
}))

function defaultDeviceName(): string {
  const model = Device.modelName?.trim() || 'device'
  return sanitizeName(`${Platform.OS} ${model}`, 'Android device')
}

function storedDeviceName(): string {
  try {
    return kv.getItem(DEVICE_NAME_KEY)?.trim() || defaultDeviceName()
  } catch {
    return defaultDeviceName()
  }
}

function readDiscoverable(): boolean {
  try {
    return kv.getItem(DISCOVERABLE_KEY) !== '0'
  } catch {
    return true
  }
}

let suppressDirty = false

export const localSync = createLocalSyncEngine({
  transport: androidTransport,
  storage: kv,
  getLocalDocument: () => useAppStore.getState().document,
  applyRemoteDocument: (document) => {
    const parsed = parseDocument(document)
    if (!parsed.ok) {
      devWarn('sync', 'remote document rejected by the schema', undefined, {
        reason: parsed.reason,
      })
      return
    }
    suppressDirty = true
    try {
      useAppStore.setState({ document: parsed.value })
      useAppStore.getState().reconcile(getNow())
    } catch (error) {
      devWarn('sync', 'reconcile after a remote apply failed', error)
    } finally {
      queueMicrotask(() => {
        suppressDirty = false
      })
    }
  },
  deviceName: storedDeviceName(),
  initialDiscoverable: readDiscoverable(),
  getDevOffset: () => {
    try {
      return getDevOffsetDays()
    } catch {
      return 0
    }
  },
  onBackup: () => {
    try {
      documentStorage.backup()
    } catch (error) {
      devWarn('sync', 'pre-merge backup failed', error)
    }
  },
  onRemoteApplied: (peerName) => {
    useAppStore.getState().showToast(`Updated from ${peerName}.`)
  },
})

export const syncEngine = localSync

function syncEngineToUi(): void {
  useSyncStore.setState(localSync.getState())
}

export async function setDiscoverable(discoverable: boolean): Promise<void> {
  try {
    kv.setItem(DISCOVERABLE_KEY, discoverable ? '1' : '0')
  } catch {
    // Best-effort preference.
  }
  await localSync.setDiscoverable(discoverable)
}

let initPromise: Promise<() => void> | null = null
let initRefs = 0

async function doInitSync(): Promise<() => void> {
  const stopEngineUi = localSync.subscribe(syncEngineToUi)
  syncEngineToUi()

  const stopDocument = useAppStore.subscribe((state, previous) => {
    if (suppressDirty) return
    if (state.document === (previous as { document?: unknown }).document) return
    localSync.handleDocumentChange()
  })

  await localSync.start()
  syncEngineToUi()

  let appState = AppState.currentState ?? 'active'
  const appStateSubscription = AppState.addEventListener('change', (next) => {
    const becameActive = appState.match(/inactive|background/) && next === 'active'
    appState = next
    if (becameActive) {
      useAppStore.getState().reconcile()
      void localSync.resume().then(() => localSync.refresh())
    } else if (next === 'background') {
      void localSync.pause()
    }
  })

  const netInfoUnsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected !== false) void localSync.refresh()
  })

  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    stopDocument()
    stopEngineUi()
    appStateSubscription.remove()
    netInfoUnsubscribe()
    void localSync.stop()
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

export const migrationNotice = localSyncMigration

export function resetSyncForTests(): void {
  initPromise = null
  initRefs = 0
}
