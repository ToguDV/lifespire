import { create } from 'zustand'
import { parseDocument } from '@lifespire/core'
import { defaultDeviceName } from '@lifespire/app-core/sync/protocol'
import { createLocalSyncEngine } from '@lifespire/app-core/sync/localEngine'
import type { LocalSyncState } from '@lifespire/app-core/sync/localEngine'
import { DISCOVERABLE_KEY, DEVICE_NAME_KEY } from '@lifespire/app-core/sync/storageKeys'
import { getDevOffsetDays, getNow } from '../state/clock'
import { documentStorage, localSyncMigration } from '../state/persistence'
import { useAppStore } from '../state/store'
import { localTransport } from './localTransport'

type SyncUiState = LocalSyncState

const EMPTY: LocalSyncState = {
  initialized: false,
  available: true,
  phase: 'off',
  device: null,
  discoverable: false,
  nearby: [],
  peers: {},
  conflicts: [],
  pairing: null,
  lastError: null,
}

export const useSyncStore = create<SyncUiState>(() => ({
  ...EMPTY,
  initialized: false,
}))

function memoryLike(): {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
} {
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

function browserStorage(): {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
} {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    // Private mode falls back to memory.
  }
  return memoryLike()
}

function readDeviceName(): string {
  try {
    const stored = localStorage.getItem(DEVICE_NAME_KEY)
    if (stored && stored.trim()) return stored.trim().slice(0, 120)
  } catch {
    // Storage may be unavailable.
  }
  const desktop =
    typeof window !== 'undefined' && window.lifespireDesktop?.isDesktop === true
  const platform =
    typeof navigator === 'undefined'
      ? 'device'
      : typeof window !== 'undefined' && window.lifespireDesktop?.platform
        ? window.lifespireDesktop.platform
        : navigator.userAgent
  return defaultDeviceName(
    desktop ? `Desktop ${platform}` : `Web ${platform}`,
    'LifeSpire device',
  )
}

function readDiscoverable(): boolean {
  try {
    return localStorage.getItem(DISCOVERABLE_KEY) !== '0'
  } catch {
    return true
  }
}

let suppressDirty = false

export const localSync = createLocalSyncEngine({
  transport: localTransport,
  storage: browserStorage(),
  getLocalDocument: () => useAppStore.getState().document,
  applyRemoteDocument: (document) => {
    const parsed = parseDocument(document)
    if (!parsed.ok) return
    suppressDirty = true
    try {
      useAppStore.setState({ document: parsed.value })
      useAppStore.getState().reconcile(getNow())
    } finally {
      queueMicrotask(() => {
        suppressDirty = false
      })
    }
  },
  deviceName: readDeviceName(),
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
    } catch {
      // Backup is best-effort; the merge itself is already validated.
    }
  },
  onRemoteApplied: (peerName) => {
    useAppStore.getState().showToast(`Updated from ${peerName}.`)
  },
})

/** Kept for callers that used the old engine name (conflict dialog/tests). */
export const syncEngine = localSync

function syncEngineToUi(): void {
  const state = localSync.getState()
  useSyncStore.setState({ ...state, initialized: true })
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

  const refresh = (): void => {
    void localSync.refresh()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('online', refresh)
    window.addEventListener('focus', refresh)
  }
  const handleVisibility = (): void => {
    if (document.visibilityState === 'visible') refresh()
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibility)
  }

  return () => {
    stopDocument()
    stopEngineUi()
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', refresh)
      window.removeEventListener('focus', refresh)
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
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

export async function setDiscoverable(discoverable: boolean): Promise<void> {
  try {
    localStorage.setItem(DISCOVERABLE_KEY, discoverable ? '1' : '0')
  } catch {
    // Best-effort preference.
  }
  await localSync.setDiscoverable(discoverable)
}

export function setDeviceName(name: string): void {
  const clean = name.trim().slice(0, 120)
  if (!clean) return
  try {
    localStorage.setItem(DEVICE_NAME_KEY, clean)
  } catch {
    // Best-effort preference; the running node keeps its current name.
  }
}

export const migrationNotice = localSyncMigration

export function resetSyncForTests(): void {
  initPromise = null
  initRefs = 0
}

if (typeof window !== 'undefined') {
  ;(window as unknown as { __lifespireSync?: unknown }).__lifespireSync = {
    engine: localSync,
    stores: { sync: useSyncStore, app: useAppStore },
  }
}
