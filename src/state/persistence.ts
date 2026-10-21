import type { PersistStorage } from 'zustand/middleware'
import { SCHEMA_VERSION, STORAGE_KEY } from '../domain/balance'
import { parseDocument, serializeDocument } from '../domain/schema'
import type { GameDocument, StorageIssue } from '../domain/types'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface PersistedSlice {
  document: GameDocument
}

export interface DocumentStorageController {
  storage: PersistStorage<PersistedSlice>
  consumeIssue(): StorageIssue | null
  blockWrites(issue: StorageIssue): void
  unblockWrites(): void
  isBlocked(): boolean
  read(): string | null
  clear(): void
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
 */
export function createDocumentStorage(storage: StorageLike): DocumentStorageController {
  let blocked = false
  let pendingIssue: StorageIssue | null = null

  const block = (issue: StorageIssue): void => {
    blocked = true
    pendingIssue = issue
  }

  const storageAdapter: PersistStorage<PersistedSlice> = {
    getItem: (name) => {
      let raw: string | null
      try {
        raw = storage.getItem(name)
      } catch {
        block({ reason: 'corrupt' })
        return null
      }
      if (raw === null) return null

      const result = parseDocument(raw)
      if (!result.ok) {
        block({
          reason: result.reason === 'future-version' ? 'future-version' : 'corrupt',
        })
        return null
      }

      return { state: { document: result.value }, version: SCHEMA_VERSION }
    },
    setItem: (name, value) => {
      if (blocked) return
      try {
        storage.setItem(name, serializeDocument(value.state.document))
      } catch {
        // A failed write must not crash the app; the in-memory state stays intact.
      }
    },
    removeItem: (name) => {
      if (blocked) return
      try {
        storage.removeItem(name)
      } catch {
        // Ignore unavailable storage.
      }
    },
  }

  return {
    storage: storageAdapter,
    consumeIssue: () => {
      const issue = pendingIssue
      pendingIssue = null
      return issue
    },
    blockWrites: block,
    unblockWrites: () => {
      blocked = false
      pendingIssue = null
    },
    isBlocked: () => blocked,
    read: () => {
      try {
        return storage.getItem(STORAGE_KEY)
      } catch {
        return null
      }
    },
    clear: () => {
      try {
        storage.removeItem(STORAGE_KEY)
      } catch {
        // Ignore unavailable storage.
      }
    },
  }
}

/** Shared browser persistence. Falls back to memory when localStorage is absent. */
export const documentStorage = createDocumentStorage(getDefaultStorage())
