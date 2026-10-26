import { SyncConflictError } from '@lifespire/api-client'
import { ApiRequestError } from '@lifespire/api-client'
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
  api: Pick<ApiClient, 'getSync' | 'putSync' | 'watchSync'>
  userId: string | null
  getLocalDocument: () => GameDocument
  applyRemoteDocument: (document: GameDocument) => void
  /**
   * Called when a watch notification led to a direct remote apply (not an
   * auto-merge or a conflict resolution). The UI uses it for a discreet
   * "updated from another device" notice.
   */
  onRemoteApplied?: () => void
  /** The cloud save was deleted from another device. */
  onCloudDeleted?: () => void
  getDevOffset?: () => number
  isOnline?: () => boolean
  now?: () => Date
  pushDelayMs?: number
  pollIntervalMs?: number
  /** Minimum delay before retrying an immediate, unchanged watch response. */
  watchIdleDelayMs?: number
  /** Aborts a zombie long-poll so the loop can retry (default 40 s). */
  watchRequestTimeoutMs?: number
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
const WATCH_BACKOFF_START_MS = 2_000
const WATCH_BACKOFF_MAX_MS = 30_000
const WATCH_IDLE_DELAY_MS = 1_000
// Longer than the server's 30 s maximum wait, short enough to free a zombie
// socket (laptop sleep, NAT rebind, proxy holding the response).
const WATCH_REQUEST_TIMEOUT_MS = 40_000

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

  // Long-poll state. The cursor is independent from `serverVersion`: it must
  // advance even when the client cannot pull immediately (push or conflict),
  // otherwise the server would return the same pending version in a tight loop.
  let watching = false
  let watchUnsupported = false
  let watchSince: string | null = null
  let watchAbort: AbortController | null = null
  let watchBackoffMs = WATCH_BACKOFF_START_MS
  let watchSleepCancel: (() => void) | null = null
  let pullInFlight = false
  let pullAgain = false
  let pullAgainAnnounce = false
  let pendingPull = false
  let pendingAnnounce = false
  /** Invalidates in-flight pulls across account switches and sign-outs. */
  let pullGeneration = 0

  const clearPushTimer = (): void => {
    if (pushTimer !== null) {
      clearTimeout(pushTimer)
      pushTimer = null
    }
  }

  const clearWatchSleep = (): void => {
    if (watchSleepCancel) {
      const cancel = watchSleepCancel
      watchSleepCancel = null
      cancel()
    }
  }

  const watchSleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      const timer = setTimeout(() => {
        watchSleepCancel = null
        resolve()
      }, ms)
      watchSleepCancel = () => {
        clearTimeout(timer)
        resolve()
      }
    })

  const isWatchUnsupported = (error: unknown): boolean =>
    error instanceof ApiRequestError && [404, 405, 501].includes(error.status)

  const isNewerVersion = (candidate: string, current: string | null): boolean => {
    if (current === null) return true
    try {
      return BigInt(candidate) > BigInt(current)
    } catch {
      return candidate !== current
    }
  }

  /** Runs a deferred pull as soon as the engine is idle again. */
  const flushPendingPull = (): void => {
    if (!pendingPull) return
    if (pullInFlight || state.status === 'pushing' || state.status === 'conflict') return
    const announce = pendingAnnounce
    pendingPull = false
    pendingAnnounce = false
    void engine.pullNow({ announce })
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

    // A long-poll pull may still be in flight. The CAS + If-Match serialize the
    // write and openConflict re-reads the version, so the worst case here is a
    // redundant round trip, never a lost update.
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
      flushPendingPull()
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
    const generation = pullGeneration
    const userId = state.userId
    try {
      const snapshot = await deps.api.getSync()
      if (generation !== pullGeneration || state.userId !== userId) return
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
      flushPendingPull()
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

  function clearCloudState(userId: string): void {
    try {
      deps.storage.removeItem(accountMetaKey(userId))
      deps.storage.removeItem(accountBaseKey(userId))
    } catch {
      // Best-effort, like the rest of the sync meta.
    }
    baseChecksum = null
    baseDocument = null
    watchSince = null
    pushKey = null
    setState({
      serverVersion: null,
      updatedAt: null,
      conflict: null,
      status: 'dirty',
      lastError: null,
    })
    deps.onCloudDeleted?.()
  }

  /**
   * Runs the long-poll loop until stopped, the account changes or the server
   * does not know the endpoint. The cursor advances on every notification even
   * when the pull is deferred, so the server is never asked for the same
   * pending version in a tight loop.
   */
  async function runWatchLoop(userId: string): Promise<void> {
    while (watching && state.userId === userId) {
      if (getDevOffset() !== 0) {
        await watchSleep(5_000)
        continue
      }
      if (!isOnline()) {
        watching = false
        setState({ status: 'offline' })
        return
      }

      const since = watchSince ?? state.serverVersion ?? undefined
      const controller = new AbortController()
      watchAbort = controller
      const startedAt = Date.now()
      let timedOut = false
      const watchdog = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, deps.watchRequestTimeoutMs ?? WATCH_REQUEST_TIMEOUT_MS)
      try {
        const result = await deps.api.watchSync(since, { signal: controller.signal })
        clearTimeout(watchdog)
        if (!watching || state.userId !== userId) return
        if (controller.signal.aborted && !timedOut) return
        watchBackoffMs = WATCH_BACKOFF_START_MS

        if (result.version === null) {
          // No cloud copy. Only react when this device previously had one;
          // a fresh account simply keeps waiting for its first upload.
          if (state.serverVersion !== null) clearCloudState(userId)
          if (Date.now() - startedAt < 100) {
            await watchSleep(deps.watchIdleDelayMs ?? WATCH_IDLE_DELAY_MS)
          }
        } else {
          // The server's current version is authoritative: accept a lower one
          // too (delete + recreate) instead of keeping a cursor it can never
          // satisfy again.
          if (result.version !== watchSince) watchSince = result.version
          if (result.version !== state.serverVersion) {
            if (state.status === 'conflict' || state.status === 'pushing' || pullInFlight) {
              pendingPull = true
              pendingAnnounce = true
            } else {
              await engine.pullNow({ announce: true })
              if (
                state.serverVersion !== null &&
                isNewerVersion(state.serverVersion, watchSince)
              ) {
                watchSince = state.serverVersion
              }
            }
          } else if (Date.now() - startedAt < 100) {
            // A proxy or buggy server answered an unchanged cursor instantly;
            // do not spin.
            await watchSleep(deps.watchIdleDelayMs ?? WATCH_IDLE_DELAY_MS)
          }
        }
      } catch (error) {
        clearTimeout(watchdog)
        if (!watching || state.userId !== userId) return
        // An abort from stopWatching ends the loop; a watchdog abort retries.
        if (controller.signal.aborted && !timedOut) return
        if (isWatchUnsupported(error)) {
          // Older server: keep the app syncing with the legacy poll.
          watchUnsupported = true
          watching = false
          engine.startPolling()
          return
        }
        setState({
          status: isOnline() ? 'error' : 'offline',
          lastError: error instanceof Error ? error.message : 'Sync watch failed.',
        })
        watchBackoffMs = Math.min(watchBackoffMs * 2, WATCH_BACKOFF_MAX_MS)
        await watchSleep(watchBackoffMs)
      } finally {
        clearTimeout(watchdog)
        if (watchAbort === controller) watchAbort = null
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
      engine.stopWatching()
      engine.stopPolling()
      pullGeneration += 1
      pullAgain = false
      pullAgainAnnounce = false
      pendingPull = false
      pendingAnnounce = false
      watchUnsupported = false
      watchSince = null
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
      watchSince = meta?.version ?? null
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

    pullNow: async (options: { announce?: boolean } = {}): Promise<void> => {
      const userId = state.userId
      if (!userId || getDevOffset() !== 0 || !isOnline()) return
      if (pullInFlight) {
        pullAgain = true
        if (options.announce) pullAgainAnnounce = true
        return
      }
      if (state.status === 'conflict' || state.status === 'pushing') {
        pendingPull = true
        if (options.announce) pendingAnnounce = true
        return
      }
      pendingPull = false
      pendingAnnounce = false
      const previous = state.status
      const generation = pullGeneration
      pullInFlight = true
      setState({ status: 'pulling' })
      try {
        const snapshot = await deps.api.getSync(state.serverVersion ?? undefined)
        if (generation !== pullGeneration || state.userId !== userId) return
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
          // Local edits plus a newer cloud save: openConflict still tries the
          // conservative 3-way merge before showing the dialog (ADR-0004).
          await openConflict()
          return
        }
        deps.applyRemoteDocument(snapshot.document as GameDocument)
        persistVersion(snapshot.version, snapshot.updatedAt, checksumDocument(snapshot.document), snapshot.document)
        if (state.status === 'pulling') {
          setState({ status: 'synced', lastError: null })
        }
        if (options.announce) deps.onRemoteApplied?.()
      } catch (error) {
        if (state.status === 'pulling') {
          setState({
            status: 'error',
            lastError: error instanceof Error ? error.message : 'Pull failed.',
          })
        }
      } finally {
        pullInFlight = false
        if (pullAgain) {
          const announce = pullAgainAnnounce
          pullAgain = false
          pullAgainAnnounce = false
          void engine.pullNow({ announce })
        } else {
          // A watch notification may have arrived while this pull ran.
          flushPendingPull()
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
        flushPendingPull()
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
      flushPendingPull()
    },

    discardConflict: (): void => {
      setState({ conflict: null, status: state.serverVersion ? 'synced' : 'dirty' })
      flushPendingPull()
    },

    handleOnline: (): void => {
      if (!state.userId) return
      if (state.status === 'offline' || state.status === 'error') {
        setState({ status: 'dirty' })
        void engine.pullNow()
      }
      engine.startWatching()
    },

    /**
     * Starts the authenticated change feed. Falls back to the legacy 60 s
     * poll when the server predates /v1/sync/watch.
     */
    startWatching: (): void => {
      if (watchUnsupported) {
        // The server predates the feed (or rejected it): keep the legacy poll
        // alive across background/resume and network changes.
        engine.startPolling()
        return
      }
      if (watching) return
      const userId = state.userId
      if (!userId) return
      watching = true
      watchBackoffMs = WATCH_BACKOFF_START_MS
      if (watchSince === null) watchSince = state.serverVersion
      engine.stopPolling()
      void runWatchLoop(userId)
    },

    stopWatching: (): void => {
      watching = false
      if (watchAbort) {
        watchAbort.abort()
        watchAbort = null
      }
      clearWatchSleep()
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
      engine.stopWatching()
      engine.stopPolling()
      listeners.clear()
    },
  }

  return engine
}

export type SyncEngine = ReturnType<typeof createSyncEngine>
