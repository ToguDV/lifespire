import type { PersistStorage } from 'zustand/middleware'
import { SCHEMA_VERSION, STORAGE_BACKUP_KEY, STORAGE_KEY } from '../domain/balance'
import { parseDocument } from '../domain/schema'
import type { GameDocument, StorageIssue } from '../domain/types'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface PersistedSlice {
  document: GameDocument
}

export type StorageWriteWarning = 'write-failed' | null
export type ExternalChangeListener = () => void
export type ConflictListener = () => void

export interface DocumentStorageController {
  storage: PersistStorage<PersistedSlice>
  consumeIssue(): StorageIssue | null
  /** Called when the first write fails and when a later write succeeds again. */
  setWriteStatusListener(listener: ((warning: StorageWriteWarning) => void) | null): void
  /** Called when another tab writes the save key. */
  setExternalChangeListener(listener: ExternalChangeListener | null): void
  /** Called when a write is refused because another tab changed the save first. */
  setConflictListener(listener: ConflictListener | null): void
  blockWrites(issue: StorageIssue): void
  unblockWrites(): void
  isBlocked(): boolean
  read(activeKey?: string): string | null
  /** Copies the current raw save to the backup key, if a save exists. */
  backup(activeKey?: string): void
  clear(activeKey?: string): void
  getActiveKey(): string
  setActiveKey(key: string): void
}

export interface DocumentStorageOptions {
  /**
   * False when the adapter had to fall back to memory because localStorage is
   * unavailable. The app stays usable, but writes are reported as lost.
   */
  persistent?: boolean
}

function createMemoryStorage(): StorageLike {
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

function hasBrowserStorage(): boolean {
  try {
    return typeof window !== 'undefined' && Boolean(window.localStorage)
  } catch {
    // Storage can be unavailable in private or sandboxed contexts.
    return false
  }
}

export function getDefaultStorage(): StorageLike {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage
    }
  } catch {
    // Storage can be unavailable in private or sandboxed contexts.
  }
  return createMemoryStorage()
}

/**
 * Adapter that stores the versioned GameDocument itself (not a Zustand wrapper)
 * and refuses to overwrite unreadable or future-version data until it is reset
 * or replaced by a validated import.
 *
 * A failed write leaves the in-memory document intact and reports it through
 * the write-status listener, so the shell can warn before a reload loses it.
 */
export function createDocumentStorage(
  storage: StorageLike,
  options: DocumentStorageOptions = {},
): DocumentStorageController {
  const persistent = options.persistent ?? true
  let blocked = false
  let pendingIssue: StorageIssue | null = null
  let writeFailed = false
  let writeStatusListener: ((warning: StorageWriteWarning) => void) | null = null
  let externalChangeListener: ExternalChangeListener | null = null
  let conflictListener: ConflictListener | null = null
  let activeKey = STORAGE_KEY
  /** Last raw text per save key (per-account support). */
  const lastWrittenByKey = new Map<string, string | null>()

  const block = (issue: StorageIssue): void => {
    blocked = true
    pendingIssue = issue
  }

  const reportWrite = (failed: boolean): void => {
    if (failed === writeFailed) return
    writeFailed = failed
    writeStatusListener?.(failed ? 'write-failed' : null)
  }

  const storageAdapter: PersistStorage<PersistedSlice> = {
    getItem: (name) => {
      let raw: string | null
      try {
        raw = storage.getItem(name)
        lastWrittenByKey.set(name, raw)
        if (raw === null) return null

        // Parsing and migrations are untrusted: any exception must leave the
        // original raw save untouched instead of falling back to an empty one.
        const result = parseDocument(raw)
        if (!result.ok) {
          block({
            reason: result.reason === 'future-version' ? 'future-version' : 'corrupt',
          })
          return null
        }

        return { state: { document: result.value }, version: SCHEMA_VERSION }
      } catch {
        block({ reason: 'corrupt' })
        return null
      }
    },
    setItem: (name, value) => {
      if (blocked) return

      // Persist the compact document; serializeDocument keeps the readable
      // two-space format for user-facing exports only.
      const next = JSON.stringify(value.state.document)
      const lastWrittenRaw = lastWrittenByKey.get(name) ?? null
      if (next === lastWrittenRaw) return

      let current: string | null
      try {
        current = storage.getItem(name)
      } catch {
        current = lastWrittenRaw
      }

      // Another tab wrote after this controller last read or wrote. Refusing the
      // write avoids a silent last-write-wins overwrite of its progress.
      if (current !== lastWrittenRaw && current !== next) {
        conflictListener?.()
        return
      }

      try {
        storage.setItem(name, next)
        lastWrittenByKey.set(name, next)
        reportWrite(!persistent)
      } catch {
        // The app keeps working from memory; the shell warns that a reload
        // would lose changes until a later write succeeds.
        reportWrite(true)
      }
    },
    removeItem: (name) => {
      if (blocked) return
      try {
        storage.removeItem(name)
        lastWrittenByKey.set(name, null)
      } catch {
        // Ignore unavailable storage.
      }
    },
  }

  const isTrackedSaveKey = (key: string | null): boolean => {
    if (!key) return false
    if (key === STORAGE_KEY) return true
    if (!key.startsWith(`${STORAGE_KEY}:u:`)) return false
    return !key.endsWith(':backup') && !key.endsWith(':meta')
  }

  // Storage events never fire in the tab that wrote them, so this notification
  // is safe against same-tab write loops.
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', (event: StorageEvent) => {
      if (!isTrackedSaveKey(event.key)) return
      if (event.newValue === lastWrittenByKey.get(event.key as string)) return
      externalChangeListener?.()
    })
  }

  const backupKeyForSave = (saveKey: string): string =>
    saveKey === STORAGE_KEY ? STORAGE_BACKUP_KEY : `${saveKey}:backup`

  const backup = (saveKey: string = activeKey): void => {
    try {
      const raw = storage.getItem(saveKey)
      if (raw === null) return
      storage.setItem(backupKeyForSave(saveKey), raw)
    } catch {
      // A backup is best-effort: destructive actions still proceed.
    }
  }

  return {
    storage: storageAdapter,
    consumeIssue: () => {
      const issue = pendingIssue
      pendingIssue = null
      return issue
    },
    setWriteStatusListener: (listener) => {
      writeStatusListener = listener
    },
    setExternalChangeListener: (listener) => {
      externalChangeListener = listener
    },
    setConflictListener: (listener) => {
      conflictListener = listener
    },
    blockWrites: block,
    unblockWrites: () => {
      blocked = false
      pendingIssue = null
    },
    isBlocked: () => blocked,
    read: (saveKey: string = activeKey) => {
      try {
        return storage.getItem(saveKey)
      } catch {
        return null
      }
    },
    backup,
    clear: (saveKey: string = activeKey) => {
      try {
        storage.removeItem(saveKey)
        lastWrittenByKey.set(saveKey, null)
      } catch {
        // Ignore unavailable storage.
      }
    },
    getActiveKey: () => activeKey,
    setActiveKey: (key) => {
      activeKey = key
    },
  }
}

/** Shared browser persistence. Falls back to memory when localStorage is absent. */
export const documentStorage = createDocumentStorage(getDefaultStorage(), {
  persistent: hasBrowserStorage(),
})
