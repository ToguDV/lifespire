import { GUEST_COPY_KEY, saveKeyForUser } from './storageKeys'

interface LikeStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

interface ManagerDeps {
  storage: LikeStorage
  auth: {
    getState(): { user: { id: string } | null }
    subscribe(listener: () => void): () => void
  }
  appStore: {
    getState(): { document: { profile: unknown } }
    persist: { setOptions(opts: { name: string }): void; rehydrate(): void }
    subscribe(listener: (state: { document: unknown }, prev: { document: unknown }) => void): () => void
  }
  documentStorage: {
    getActiveKey(): string
    setActiveKey(key: string): void
    backup(key?: string): void
  }
  engine: {
    setUserId(userId: string | null): void
    markDirty(): void
    adoptLocal(): void
  }
}

/**
 * Coordinates per-account local keys, guest adoption and the sync engine.
 * The web store owns the document; the engine owns the server version.
 */
export function createSyncManager(deps: ManagerDeps) {
  const { storage, appStore, documentStorage, engine } = deps
  let suppressNextDirty = false

  const currentUserId = (): string | null => {
    try {
      return deps.auth.getState().user?.id ?? null
    } catch {
      return null
    }
  }

  async function switchToAccount(userId: string | null): Promise<void> {
    const targetKey = saveKeyForUser(userId)
    const previousKey = documentStorage.getActiveKey()

    if (userId) {
      // Guest adoption: a fresh account inherits the guest save so signing in
      // never discards local progress. Existing account saves win.
      try {
        const accountRaw = storage.getItem(targetKey)
        if (!accountRaw) {
          const guestRaw = storage.getItem(previousKey === targetKey ? 'lifespire:mvp0' : previousKey)
            ?? (previousKey !== 'lifespire:mvp0' ? storage.getItem('lifespire:mvp0') : null)
          if (guestRaw) {
            try {
              const parsed = JSON.parse(guestRaw) as { profile?: unknown }
              if (parsed.profile) {
                storage.setItem(targetKey, guestRaw)
                storage.setItem(GUEST_COPY_KEY, guestRaw)
              }
            } catch {
              // A corrupt guest save never blocks sign-in; the cloud wins.
            }
          }
        }
      } catch {
        // Storage may be unavailable; the in-memory document still switches.
      }
    }

    documentStorage.setActiveKey(targetKey)
    try {
      appStore.persist.setOptions({ name: targetKey })
      appStore.persist.rehydrate()
    } catch {
      // Rehydration is best-effort in tests and private-mode browsers.
    }
    engine.setUserId(userId)

    // Let the engine decide from its last-synced checksum: unsynced local
    // work pushes (and conflicts if the cloud moved), clean reloads pull.
    try {
      if (userId) engine.adoptLocal()
    } catch {
      // Pull failures leave the engine in error/offline with backoff.
    }
  }

  function handleDocumentChange(document: unknown, previous: unknown): void {
    if (suppressNextDirty) return
    if (document === previous) return
    // Remote applies go through applyRemoteDocument, which sets this flag.
    if (!currentUserId()) return
    engine.markDirty()
  }

  return {
    switchToAccount,
    suppressRemoteApply<T>(apply: () => T): T {
      suppressNextDirty = true
      try {
        return apply()
      } finally {
        // Keep suppression for the synchronous subscribe notification, then release.
        queueMicrotask(() => {
          suppressNextDirty = false
        })
      }
    },
    handleDocumentChange,
    start(): () => void {
      const unsubAuth = deps.auth.subscribe(() => {
        void switchToAccount(currentUserId())
      })
      const unsubDoc = appStore.subscribe((state, prev) => {
        handleDocumentChange(state.document, (prev as { document: unknown }).document)
      })
      return () => {
        unsubAuth()
        unsubDoc()
      }
    },
  }
}

export type SyncManager = ReturnType<typeof createSyncManager>
