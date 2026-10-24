import { SyncConflictError } from '@lifespire/api-client'
import type { ApiClient } from '@lifespire/api-client'
import type { GameDocument } from '@lifespire/core'
import { tryAutoMerge } from '@lifespire/core'
import { parseDocument } from '@lifespire/core'
import { checksumDocument } from './checksum'
import { accountBaseKey, accountMetaKey } from './storageKeys'

export type SyncStatus =
  | 'disabled'
  | 'synced'
  | 'dirty'
  | 'pushing'
  | 'pulling'
  | 'offline'
  | 'conflict'
  | 'error'
  | 'paused'

export interface SyncConflict {
  local: GameDocument
  remote: GameDocument
  remoteVersion: string
  remoteUpdatedAt: string
  /** Why auto-merge refused, shown in the dialog so nothing fails silently. */
  conflicts: string[]
}

export interface SyncEngineState {
  status: SyncStatus
  userId: string | null
  serverVersion: string | null
  updatedAt: string | null
  conflict: SyncConflict | null
  lastError: string | null
  lastPushedAt: string | null
  /** Last time disjoint edits were merged automatically (null = never). */
  lastAutoMergeAt: string | null
}

export interface SyncEngineDeps {
  storage: {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
    removeItem(key: string): void
  }
  api: Pick<ApiClient, 'getSync' | 'putSync'>
  userId: string | null
  getLocalDocument: () => GameDocument
  applyRemoteDocument: (document: GameDocument) => void
  getDevOffset?: () => number
  isOnline?: () => boolean
  now?: () => Date
  pushDelayMs?: number
  pollIntervalMs?: number
  useLocks?: boolean
  /**
   * Best-effort hook before an auto-merged document overwrites the cloud
   * copy. The app wires it to a local backup so the pre-merge device copy
   * is never lost.
   */
  onBeforeAutoMergePush?: (local: GameDocument) => void
}

const PUSH_DELAY_MS = 1500
const POLL_INTERVAL_MS = 60_000
const MAX_BACKOFF_MS = 60_000

function newIdempotencyKey(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // Fall through to the counter fallback.
  }
  return `sync-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

function readMeta(
  storage: SyncEngineDeps['storage'],
  userId: string,
): { version: string; updatedAt: string; checksum: string | null } | null {
  try {
    const raw = storage.getItem(accountMetaKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { version?: unknown; updatedAt?: unknown; checksum?: unknown }
    if (typeof parsed.version !== 'string') return null
    return {
      version: parsed.version,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
      checksum: typeof parsed.checksum === 'string' ? parsed.checksum : null,
    }
  } catch {
    return null
  }
}

function writeMeta(
  storage: SyncEngineDeps['storage'],
  userId: string,
  version: string,
  updatedAt: string,
  checksum: string,
): void {
  try {
    storage.setItem(accountMetaKey(userId), JSON.stringify({ version, updatedAt, checksum }))
  } catch {
    // Meta is best-effort; the in-memory version still drives the protocol.
  }
}

/** Last-synced cloud copy, the merge base. Best-effort like the meta. */
function readBaseDocument(
  storage: SyncEngineDeps['storage'],
  userId: string,
): GameDocument | null {
  try {
    const raw = storage.getItem(accountBaseKey(userId))
    if (!raw) return null
    const parsed = parseDocument(JSON.parse(raw))
    return parsed.ok ? parsed.value : null
  } catch {
    return null
  }
}

function writeBaseDocument(
  storage: SyncEngineDeps['storage'],
  userId: string,
  document: unknown,
): void {
  try {
    storage.setItem(accountBaseKey(userId), JSON.stringify(document))
  } catch {
    // Base is best-effort; without it conflicts stay manual.
  }
}

export function createSyncEngine(deps: SyncEngineDeps) {
  const getDevOffset = deps.getDevOffset ?? (() => 0)
  const isOnline =
    deps.isOnline ??
    (() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false))
  const now = deps.now ?? (() => new Date())
  const pushDelay = deps.pushDelayMs ?? PUSH_DELAY_MS

  let state: SyncEngineState = {
    status: deps.userId ? 'synced' : 'disabled',
    userId: deps.userId,
    serverVersion: null,
    updatedAt: null,
    conflict: null,
    lastError: null,
    lastPushedAt: null,
    lastAutoMergeAt: null,
  }
  let baseDocument: GameDocument | null = null
  if (deps.userId) {
    const meta = readMeta(deps.storage, deps.userId)
    if (meta) {
      state = { ...state, serverVersion: meta.version, updatedAt: meta.updatedAt }
    }
    baseDocument = readBaseDocument(deps.storage, deps.userId)
  }

  const listeners = new Set<() => void>()
  const emit = (): void => {
    listeners.forEach((listener) => listener())
  }
  const setState = (patch: Partial<SyncEngineState>): void => {
    state = { ...state, ...patch }
    emit()
  }

  let pushTimer: ReturnType<typeof setTimeout> | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let backoffMs = 2000
  let pushKey: string | null = null
  let pushInFlight = false
  /** Checksum of the last document known to match the server version. */
  let baseChecksum: string | null = deps.userId
    ? (readMeta(deps.storage, deps.userId)?.checksum ?? null)
    : null

  const clearPushTimer = (): void => {
    if (pushTimer !== null) {
      clearTimeout(pushTimer)
      pushTimer = null
    }
  }

  const persistVersion = (version: string, updatedAt: string, checksum: string, document: unknown): void => {
    baseChecksum = checksum
    const userId = state.userId
    if (userId) {
      writeMeta(deps.storage, userId, version, updatedAt, checksum)
      writeBaseDocument(deps.storage, userId, document)
      try {
        const parsed = parseDocument(document)
        baseDocument = parsed.ok ? parsed.value : null
      } catch {
        baseDocument = null
      }
    }
    setState({ serverVersion: version, updatedAt })
  }

  const runWithLock = async <T>(job: () => Promise<T>): Promise<T> => {
    const locks =
      deps.useLocks === false
        ? undefined
        : (navigator as unknown as { locks?: { request: (name: string, fn: () => Promise<T>) => Promise<T> } })
            ?.locks
    if (locks) return locks.request('lifespire-sync', job)
    return job()
  }

  const doPush = async (): Promise<void> => {
    if (pushInFlight) return
    const userId = state.userId
    if (!userId) {
      setState({ status: 'disabled' })
      return
    }
    if (getDevOffset() !== 0) {
      setState({ status: 'paused' })
      return
    }
    if (!isOnline()) {
      setState({ status: 'offline' })
      return
    }
    if (state.status === 'conflict') return

    pushInFlight = true
    setState({ status: 'pushing', lastError: null })
    try {
      const document = deps.getLocalDocument()
      const key = pushKey ?? newIdempotencyKey()
      pushKey = key
      const result = await runWithLock(() =>
        deps.api.putSync(document, {
          ifMatch: state.serverVersion ?? undefined,
          create: state.serverVersion ? undefined : true,
          idempotencyKey: key,
        }),
      )
      pushKey = null
      backoffMs = 2000
      persistVersion(result.version, result.updatedAt, checksumDocument(document), document)
      setState({ status: 'synced', lastError: null, lastPushedAt: now().toISOString() })
    } catch (error) {
      if (error instanceof SyncConflictError) {
        pushKey = null
        await openConflict()
      } else {
        const message = error instanceof Error ? error.message : 'Sync failed.'
        backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS)
        setState({ status: isOnline() ? 'error' : 'offline', lastError: message })
        scheduleRetry()
      }
    } finally {
      pushInFlight = false
    }
  }

  const scheduleRetry = (): void => {
    clearPushTimer()
    pushTimer = setTimeout(() => {
      pushTimer = null
      void doPush()
    }, backoffMs)
  }

  const openConflict = async (): Promise<void> => {
    try {
      const snapshot = await deps.api.getSync()
      if (!snapshot) {
        setState({ status: 'dirty', lastError: 'The cloud save vanished. Pushing again.' })
        scheduleRetry()
        return
      }
      const local = deps.getLocalDocument()
      const remote = snapshot.document as GameDocument
      let conflicts: string[]
      try {
        const merged = tryAutoMerge(baseDocument, local, remote)
        if (merged.ok) {
          await pushMerged(remote, snapshot.version, snapshot.updatedAt, merged.document, local)
          return
        }
        conflicts = merged.conflicts
      } catch {
        conflicts = ['automatic merge failed unexpectedly']
      }
      setState({
        status: 'conflict',
        conflict: {
          local,
          remote,
          remoteVersion: snapshot.version,
          remoteUpdatedAt: snapshot.updatedAt,
          conflicts,
        },
        lastError: null,
      })
    } catch (error) {
      setState({
        status: 'error',
        lastError: error instanceof Error ? error.message : 'Could not read the cloud save.',
      })
      scheduleRetry()
    }
  }

  /**
   * Applies an auto-merged document and pushes it over the remote version it
   * was merged against. A merge that already equals the cloud copy is adopted
   * without a push. Anything unexpected falls back to the manual dialog.
   */
  const pushMerged = async (
    remote: GameDocument,
    remoteVersion: string,
    remoteUpdatedAt: string,
    merged: GameDocument,
    preMergeLocal: GameDocument,
  ): Promise<void> => {
    clearPushTimer()
    if (checksumDocument(merged) === checksumDocument(remote)) {
      deps.applyRemoteDocument(merged)
      persistVersion(remoteVersion, remoteUpdatedAt, checksumDocument(merged), merged)
      setState({ status: 'synced', lastError: null })
      return
    }
    try {
      deps.onBeforeAutoMergePush?.(preMergeLocal)
    } catch {
      // The backup is best-effort; the merge itself is already validated.
    }
    deps.applyRemoteDocument(merged)
    setState({ status: 'pushing' })
    try {
      const document = deps.getLocalDocument()
      const result = await runWithLock(() =>
        deps.api.putSync(document, {
          ifMatch: remoteVersion,
          idempotencyKey: newIdempotencyKey(),
        }),
      )
      pushKey = null
      backoffMs = 2000
      persistVersion(result.version, result.updatedAt, checksumDocument(document), document)
      setState({
        status: 'synced',
        conflict: null,
        lastError: null,
        lastPushedAt: now().toISOString(),
        lastAutoMergeAt: now().toISOString(),
      })
    } catch (error) {
      if (error instanceof SyncConflictError) {
        await openConflict()
      } else {
        setState({
          status: 'error',
          lastError: error instanceof Error ? error.message : 'Push failed.',
        })
        scheduleRetry()
      }
    }
  }

  const engine = {
    getState: () => state,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    setServerVersion: (version: string | null): void => {
      setState({ serverVersion: version })
    },

    setUserId: (userId: string | null): void => {
      clearPushTimer()
      pushKey = null
      backoffMs = 2000
      if (!userId) {
        baseChecksum = null
        baseDocument = null
        state = {
          status: 'disabled',
          userId: null,
          serverVersion: null,
          updatedAt: null,
          conflict: null,
          lastError: null,
          lastPushedAt: null,
          lastAutoMergeAt: null,
        }
        emit()
        return
      }
      const meta = readMeta(deps.storage, userId)
      baseChecksum = meta?.checksum ?? null
      baseDocument = readBaseDocument(deps.storage, userId)
      state = {
        status: 'synced',
        userId,
        serverVersion: meta?.version ?? null,
        updatedAt: meta?.updatedAt ?? null,
        conflict: null,
        lastError: null,
        lastPushedAt: null,
        lastAutoMergeAt: null,
      }
      emit()
    },

    /**
     * Called after an account switch with the current in-memory document.
     * Only marks dirty when the local copy actually differs from the last
     * synced checksum — a clean reload must pull, never conflict.
     */
    adoptLocal: (): void => {
      if (!state.userId) return
      let local: GameDocument
      try {
        local = deps.getLocalDocument()
      } catch {
        void engine.pullNow()
        return
      }
      if (!local || (local as { profile?: unknown }).profile == null) {
        void engine.pullNow()
        return
      }
      if (baseChecksum !== null && checksumDocument(local) === baseChecksum) {
        void engine.pullNow()
        return
      }
      engine.markDirty()
      void engine.pullNow()
    },

    markDirty: (): void => {
      if (!state.userId) return
      if (getDevOffset() !== 0) {
        setState({ status: 'paused' })
        return
      }
      if (!isOnline()) {
        setState({ status: 'offline' })
        return
      }
      if (state.status === 'conflict' || state.status === 'pushing') {
        setState({ status: state.status === 'conflict' ? 'conflict' : state.status })
        return
      }
      setState({ status: 'dirty', lastError: null })
      clearPushTimer()
      pushTimer = setTimeout(() => {
        pushTimer = null
        void doPush()
      }, pushDelay)
    },

    pullNow: async (): Promise<void> => {
      const userId = state.userId
      if (!userId || getDevOffset() !== 0 || !isOnline()) return
      if (state.status === 'conflict' || state.status === 'pushing') return
      const previous = state.status
      setState({ status: 'pulling' })
      try {
        const snapshot = await deps.api.getSync(state.serverVersion ?? undefined)
        const dirtyDuringPull = state.status === 'dirty'
        const wasDirty = previous === 'dirty' || dirtyDuringPull
        if (!snapshot) {
          // 304 or no change: keep the dirty flag if local edits are pending.
          if (!dirtyDuringPull) {
            setState({ status: wasDirty ? 'dirty' : 'synced' })
          }
          if (wasDirty && !dirtyDuringPull) engine.markDirty()
          return
        }
        if (snapshot.version === state.serverVersion) {
          if (!dirtyDuringPull) {
            setState({ status: wasDirty ? 'dirty' : 'synced' })
          }
          return
        }
        if (wasDirty) {
          // Local edits plus a newer cloud save: never auto-merge (ADR-0001).
          await openConflict()
          return
        }
        deps.applyRemoteDocument(snapshot.document as GameDocument)
        persistVersion(snapshot.version, snapshot.updatedAt, checksumDocument(snapshot.document), snapshot.document)
        if (state.status === 'pulling') {
          setState({ status: 'synced', lastError: null })
        }
      } catch (error) {
        if (state.status === 'pulling') {
          setState({
            status: 'error',
            lastError: error instanceof Error ? error.message : 'Pull failed.',
          })
        }
      }
    },

    resolveKeepMine: async (): Promise<void> => {
      const conflict = state.conflict
      if (!conflict || !state.userId) return
      setState({ status: 'pushing' })
      try {
        const document = deps.getLocalDocument()
        const result = await runWithLock(() =>
          deps.api.putSync(document, {
            ifMatch: conflict.remoteVersion,
            idempotencyKey: newIdempotencyKey(),
          }),
        )
        pushKey = null
        backoffMs = 2000
        persistVersion(result.version, result.updatedAt, checksumDocument(document), document)
        setState({ status: 'synced', conflict: null, lastPushedAt: now().toISOString() })
      } catch (error) {
        if (error instanceof SyncConflictError) {
          await openConflict()
        } else {
          setState({
            status: 'error',
            lastError: error instanceof Error ? error.message : 'Push failed.',
          })
        }
      }
    },

    resolveKeepCloud: (): void => {
      const conflict = state.conflict
      if (!conflict || !state.userId) return
      deps.applyRemoteDocument(conflict.remote)
      persistVersion(conflict.remoteVersion, conflict.remoteUpdatedAt, checksumDocument(conflict.remote), conflict.remote)
      pushKey = null
      setState({ status: 'synced', conflict: null, lastError: null })
    },

    discardConflict: (): void => {
      setState({ conflict: null, status: state.serverVersion ? 'synced' : 'dirty' })
    },

    handleOnline: (): void => {
      if (!state.userId) return
      if (state.status === 'offline' || state.status === 'error') {
        setState({ status: 'dirty' })
        void engine.pullNow()
      }
    },

    startPolling: (): void => {
      engine.stopPolling()
      const interval = deps.pollIntervalMs ?? POLL_INTERVAL_MS
      pollTimer = setInterval(() => {
        void engine.pullNow()
      }, interval)
    },

    stopPolling: (): void => {
      if (pollTimer !== null) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    },

    dispose: (): void => {
      clearPushTimer()
      engine.stopPolling()
      listeners.clear()
    },
  }

  return engine
}

export type SyncEngine = ReturnType<typeof createSyncEngine>
