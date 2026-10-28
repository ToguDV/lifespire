import type { GameDocument } from '@lifespire/core'
import { parseDocument, tryAutoMerge } from '@lifespire/core'
import { checksumDocument } from './checksum'
import { SyncConflictError, isNetworkUnreachable, toUserSyncError } from './errors'
import type { LocalPeerApi, PeerSnapshot } from './protocol'
import { peerBaseKey, peerMetaKey } from './storageKeys'

export type PeerSyncStatus =
  | 'disabled'
  | 'synced'
  | 'dirty'
  | 'pushing'
  | 'pulling'
  | 'offline'
  | 'conflict'
  | 'error'
  | 'paused'

export interface PeerConflict {
  local: GameDocument
  remote: GameDocument
  remoteVersion: string
  remoteUpdatedAt: string
  /** Why auto-merge refused, shown in the dialog so nothing fails silently. */
  conflicts: string[]
}

export interface PeerEngineState {
  status: PeerSyncStatus
  peerId: string | null
  peerVersion: string | null
  updatedAt: string | null
  conflict: PeerConflict | null
  lastError: string | null
  lastSyncedAt: string | null
  /** Last time disjoint edits were merged automatically (null = never). */
  lastAutoMergeAt: string | null
  /** A conflict survived a restart and still needs a user decision. */
  needsReview: boolean
}

interface LikeStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface PeerEngineDeps {
  storage: LikeStorage
  api: LocalPeerApi
  peerId: string | null
  getLocalDocument: () => GameDocument
  applyRemoteDocument: (document: GameDocument) => void
  /** Another device's document was applied without a merge. */
  onRemoteApplied?: () => void
  /** Any remote document was applied (pull, merge or keep-peer). */
  onDocumentApplied?: (document: GameDocument) => void
  /** Development clock offset: sync pauses while a fake day is active. */
  getDevOffset?: () => number
  /** Whether the peer is currently discovered on the LAN. */
  isAvailable?: () => boolean
  now?: () => Date
  pushDelayMs?: number
  useLocks?: boolean
  /** Best-effort backup before an auto-merged document overwrites the peer. */
  onBeforeAutoMergePush?: (local: GameDocument) => void
}

const PUSH_DELAY_MS = 1500
const MAX_BACKOFF_MS = 60_000

interface StoredMeta {
  version: string
  updatedAt: string
  checksum: string | null
  conflict: boolean
}

function readMeta(storage: LikeStorage, peerId: string): StoredMeta | null {
  try {
    const raw = storage.getItem(peerMetaKey(peerId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { version?: unknown; updatedAt?: unknown; checksum?: unknown }
    if (typeof parsed.version !== 'string') return null
    return {
      version: parsed.version,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
      checksum: typeof parsed.checksum === 'string' ? parsed.checksum : null,
      conflict: (parsed as { conflict?: unknown }).conflict === true,
    }
  } catch {
    return null
  }
}

function writeMeta(
  storage: LikeStorage,
  peerId: string,
  version: string,
  updatedAt: string,
  checksum: string | null,
  conflict = false,
): void {
  try {
    storage.setItem(peerMetaKey(peerId), JSON.stringify({ version, updatedAt, checksum, conflict }))
  } catch {
    // Meta is best-effort; the in-memory version still drives the protocol.
  }
}

function readBaseDocument(storage: LikeStorage, peerId: string): GameDocument | null {
  try {
    const raw = storage.getItem(peerBaseKey(peerId))
    if (!raw) return null
    const parsed = parseDocument(JSON.parse(raw))
    return parsed.ok ? parsed.value : null
  } catch {
    return null
  }
}

function writeBaseDocument(storage: LikeStorage, peerId: string, document: unknown): void {
  try {
    storage.setItem(peerBaseKey(peerId), JSON.stringify(document))
  } catch {
    // Base is best-effort; without it conflicts stay manual.
  }
}

export function createPeerSyncEngine(deps: PeerEngineDeps) {
  const getDevOffset = deps.getDevOffset ?? (() => 0)
  const isNearby = deps.isAvailable ?? (() => true)
  let forceAvailable = false
  const isAvailable = (): boolean => forceAvailable || isNearby()
  const now = deps.now ?? (() => new Date())
  const pushDelay = deps.pushDelayMs ?? PUSH_DELAY_MS

  let state: PeerEngineState = {
    status: deps.peerId ? 'synced' : 'disabled',
    peerId: deps.peerId,
    peerVersion: null,
    updatedAt: null,
    conflict: null,
    lastError: null,
    lastSyncedAt: null,
    lastAutoMergeAt: null,
    needsReview: false,
  }
  let baseDocument: GameDocument | null = null
  let baseChecksum: string | null = null
  if (deps.peerId) {
    const meta = readMeta(deps.storage, deps.peerId)
    if (meta) {
      state = {
        ...state,
        status: meta.conflict ? 'conflict' : state.status,
        peerVersion: meta.version,
        updatedAt: meta.updatedAt,
        lastSyncedAt: meta.updatedAt || null,
        lastError: meta.conflict ? 'A previous conflict needs review.' : null,
        needsReview: meta.conflict,
      }
    }
    baseChecksum = meta?.checksum ?? null
    baseDocument = readBaseDocument(deps.storage, deps.peerId)
  }

  const listeners = new Set<() => void>()
  const emit = (): void => {
    listeners.forEach((listener) => listener())
  }
  const setState = (patch: Partial<PeerEngineState>): void => {
    state = { ...state, ...patch }
    emit()
  }

  let pushTimer: ReturnType<typeof setTimeout> | null = null
  let backoffMs = 2000
  let pushInFlight = false
  let mergeRetries = 0
  let autoEnabled = true
  let reviewInFlight = false
  let pullInFlight = false
  let pullAgain = false
  let pullAgainAnnounce = false
  let pendingPull = false
  let pendingAnnounce = false
  /** Invalidates in-flight pulls across peer switches. */
  let pullGeneration = 0

  const clearPushTimer = (): void => {
    if (pushTimer !== null) {
      clearTimeout(pushTimer)
      pushTimer = null
    }
  }

  const persistVersion = (
    version: string,
    updatedAt: string,
    checksum: string,
    document: unknown,
  ): void => {
    baseChecksum = checksum
    const peerId = state.peerId
    if (peerId) {
      writeMeta(deps.storage, peerId, version, updatedAt, checksum, false)
      writeBaseDocument(deps.storage, peerId, document)
      try {
        const parsed = parseDocument(document)
        baseDocument = parsed.ok ? parsed.value : null
      } catch {
        baseDocument = null
      }
    }
    setState({ peerVersion: version, updatedAt, needsReview: false })
  }

  /**
   * Advances the peer cursor without changing the merge base. Used when a
   * pushed document is accepted but the merged local copy still needs to be
   * pushed back: the CAS expects the peer's new version, while the 3-way base
   * must remain the old common ancestor.
   */
  const persistCursor = (version: string, updatedAt: string, conflict = false): void => {
    const peerId = state.peerId
    if (peerId) {
      writeMeta(deps.storage, peerId, version, updatedAt, baseChecksum, conflict)
    }
    setState({ peerVersion: version, updatedAt, needsReview: conflict })
  }

  const runWithLock = async <T>(job: () => Promise<T>): Promise<T> => {
    const locks =
      deps.useLocks === false || typeof navigator === 'undefined'
        ? undefined
        : (
            navigator as unknown as {
              locks?: { request: (name: string, fn: () => Promise<T>) => Promise<T> }
            }
          )?.locks
    if (locks) return locks.request('lifespire-sync', job)
    return job()
  }

  const localDiffersFromBase = (): boolean => {
    try {
      const local = deps.getLocalDocument()
      if (!local || (local as { profile?: unknown }).profile == null) return false
      return baseChecksum === null || checksumDocument(local) !== baseChecksum
    } catch {
      return false
    }
  }

  const flushPendingPull = (): void => {
    if (!pendingPull) return
    if (pullInFlight || state.status === 'pushing' || state.status === 'conflict') return
    const announce = pendingAnnounce
    pendingPull = false
    pendingAnnounce = false
    void engine.pullNow({ announce })
  }

  const scheduleRetry = (): void => {
    clearPushTimer()
    if (!autoEnabled) return
    if (!state.peerId || !isAvailable()) return
    pushTimer = setTimeout(() => {
      pushTimer = null
      void doPush()
    }, backoffMs)
  }

  const doPush = async (): Promise<void> => {
    if (pushInFlight) return
    const peerId = state.peerId
    if (!peerId) {
      setState({ status: 'disabled' })
      return
    }
    if (getDevOffset() !== 0) {
      setState({ status: 'paused' })
      return
    }
    if (!isAvailable()) {
      setState({ status: 'offline' })
      return
    }
    if (state.status === 'conflict') return

    pushInFlight = true
    setState({ status: 'pushing', lastError: null })
    try {
      const document = deps.getLocalDocument()
      const result = await runWithLock(() =>
        deps.api.putSync(document, {
          ifMatch: state.peerVersion ?? undefined,
          create: state.peerVersion ? undefined : true,
        }),
      )
      backoffMs = 2000
      persistVersion(result.version, result.updatedAt, checksumDocument(document), document)
      mergeRetries = 0
      const changedDuringPush = localDiffersFromBase()
      setState({
        status: changedDuringPush ? 'dirty' : 'synced',
        lastError: null,
        lastSyncedAt: now().toISOString(),
      })
      if (changedDuringPush) engine.markDirty()
    } catch (error) {
      if (error instanceof SyncConflictError) {
        await openConflict()
      } else {
        const unreachable = isNetworkUnreachable(error)
        backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS)
        setState({
          status: unreachable || !isAvailable() ? 'offline' : 'error',
          lastError: toUserSyncError(error, 'Sync failed.'),
        })
        scheduleRetry()
      }
    } finally {
      pushInFlight = false
      flushPendingPull()
    }
  }

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
      setState({ status: 'synced', lastError: null, lastSyncedAt: now().toISOString() })
      return
    }
    try {
      deps.onBeforeAutoMergePush?.(preMergeLocal)
    } catch {
      // The backup is best-effort; the merge itself is already validated.
    }
    deps.applyRemoteDocument(merged)
    deps.onDocumentApplied?.(merged)
    setState({ status: 'pushing' })
    try {
      const document = deps.getLocalDocument()
      const result = await runWithLock(() =>
        deps.api.putSync(document, { ifMatch: remoteVersion }),
      )
      backoffMs = 2000
      persistVersion(result.version, result.updatedAt, checksumDocument(document), document)
      mergeRetries = 0
      const changedDuringPush = localDiffersFromBase()
      setState({
        status: changedDuringPush ? 'dirty' : 'synced',
        conflict: null,
        lastError: null,
        lastSyncedAt: now().toISOString(),
        lastAutoMergeAt: now().toISOString(),
      })
      if (changedDuringPush) engine.markDirty()
      flushPendingPull()
    } catch (error) {
      if (error instanceof SyncConflictError) {
        mergeRetries += 1
        if (mergeRetries <= 3) {
          await new Promise((resolve) => setTimeout(resolve, 150))
          await openConflict()
        } else {
          setState({
            status: 'conflict',
            conflict: {
              local: deps.getLocalDocument(),
              remote,
              remoteVersion,
              remoteUpdatedAt,
              conflicts: ['the other device changed repeatedly; choose a copy'],
            },
            lastError: null,
          })
        }
      } else {
        const unreachable = isNetworkUnreachable(error)
        setState({
          status: unreachable ? 'offline' : 'error',
          lastError: toUserSyncError(error, 'Push failed.'),
        })
        scheduleRetry()
      }
    }
  }

  const openConflictInner = async (): Promise<void> => {
    const generation = pullGeneration
    const peerId = state.peerId
    if (!peerId) return
    if (!isAvailable()) {
      setState({ status: 'offline' })
      return
    }
    try {
      const snapshot: PeerSnapshot | null = await deps.api.getSync()
      if (generation !== pullGeneration || state.peerId !== peerId) return
      if (!snapshot) {
        // The peer has no save (fresh install or cleared data). Drop the stale
        // cursor/base so the next push creates it instead of looping on 409.
        try {
          deps.storage.removeItem(peerMetaKey(peerId))
          deps.storage.removeItem(peerBaseKey(peerId))
        } catch {
          // Best-effort; the in-memory reset below still creates the save.
        }
        baseChecksum = null
        baseDocument = null
        setState({
          status: 'dirty',
          peerVersion: null,
          updatedAt: null,
          conflict: null,
          lastError: 'The other device has no save yet. Pushing this one.',
          needsReview: false,
        })
        engine.markDirty()
        return
      }
      const local = deps.getLocalDocument()
      const parsed = parseDocument(snapshot.document)
      if (!parsed.ok) {
        setState({ status: 'error', lastError: 'The other device sent an invalid save.' })
        return
      }
      const remote = parsed.value
      let conflicts: string[]
      try {
        const merged = tryAutoMerge(baseDocument, local, remote)
        if (merged.ok) {
          const validated = parseDocument(merged.document)
          if (validated.ok) {
            await pushMerged(remote, snapshot.version, snapshot.updatedAt, validated.value, local)
            return
          }
          conflicts = ['the merged document is not valid']
        } else {
          conflicts = merged.conflicts
        }
      } catch {
        conflicts = ['automatic merge failed unexpectedly']
      }
      persistCursor(snapshot.version, snapshot.updatedAt, true)
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
        needsReview: true,
      })
    } catch (error) {
      setState({
        status: 'conflict',
        lastError: toUserSyncError(error, 'Could not read the other device.'),
        needsReview: true,
      })
    }
  }

  const openConflict = async (): Promise<void> => {
    if (reviewInFlight) return
    reviewInFlight = true
    try {
      await openConflictInner()
    } finally {
      reviewInFlight = false
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

    setPeerId: (peerId: string | null): void => {
      clearPushTimer()
      pullGeneration += 1
      pullAgain = false
      pullAgainAnnounce = false
      pendingPull = false
      pendingAnnounce = false
      backoffMs = 2000
      mergeRetries = 0
      forceAvailable = false
      if (!peerId) {
        baseChecksum = null
        baseDocument = null
        state = {
          status: 'disabled',
          peerId: null,
          peerVersion: null,
          updatedAt: null,
          conflict: null,
          lastError: null,
          lastSyncedAt: null,
          lastAutoMergeAt: null,
          needsReview: false,
        }
        emit()
        return
      }
      const meta = readMeta(deps.storage, peerId)
      baseChecksum = meta?.checksum ?? null
      baseDocument = readBaseDocument(deps.storage, peerId)
      const needsReview = meta?.conflict === true
      state = {
        status: needsReview ? 'conflict' : 'synced',
        peerId,
        peerVersion: meta?.version ?? null,
        updatedAt: meta?.updatedAt ?? null,
        conflict: null,
        lastError: needsReview ? 'A previous conflict needs review.' : null,
        lastSyncedAt: meta?.updatedAt ?? null,
        lastAutoMergeAt: null,
        needsReview,
      }
      emit()
    },

    /**
     * Called after an account switch / app start with the current in-memory
     * document. Only marks dirty when the local copy actually differs from the
     * last synced checksum; a clean reload must pull, never conflict.
     */
    adoptLocal: (): void => {
      if (!state.peerId) return
      if (state.needsReview) {
        void openConflict()
        return
      }
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

    /** The peer pushed a document and the app already applied it locally. */
    adoptIncoming: (document: GameDocument, version: string, updatedAt: string): void => {
      if (!state.peerId) return
      if (!parseDocument(document).ok) return
      clearPushTimer()
      persistVersion(version, updatedAt, checksumDocument(document), document)
      setState({
        status: 'synced',
        conflict: null,
        lastError: null,
        lastSyncedAt: now().toISOString(),
        needsReview: false,
      })
      flushPendingPull()
    },

    /**
     * Applies a document pushed by a peer, merging it with the local copy
     * instead of overwriting unsynced local work. The caller acks the inbox
     * item afterwards; a conflict is acked too so the peer's copy is the
     * mirror, while the local copy waits for the user's decision.
     */
    receiveRemote: async (
      document: GameDocument,
      updatedAt: string,
    ): Promise<'applied' | 'conflict' | 'rejected'> => {
      if (!state.peerId) return 'rejected'
      const parsed = parseDocument(document)
      if (!parsed.ok) return 'rejected'
      const incoming = parsed.value
      const local = deps.getLocalDocument()
      const incomingHash = checksumDocument(incoming)
      if (incomingHash === checksumDocument(local)) {
        engine.adoptIncoming(incoming, incomingHash, updatedAt)
        return 'applied'
      }
      try {
        deps.onBeforeAutoMergePush?.(local)
      } catch {
        // A backup is best-effort; the document is already validated.
      }
      const base = baseDocument
      if (!base) {
        if (!local.profile) {
          deps.applyRemoteDocument(incoming)
          deps.onDocumentApplied?.(incoming)
          engine.adoptIncoming(incoming, incomingHash, updatedAt)
          return 'applied'
        }
        if (!incoming.profile) {
          persistCursor(incomingHash, updatedAt)
          setState({ status: 'dirty', lastError: null })
          engine.markDirty()
          return 'applied'
        }
        persistCursor(incomingHash, updatedAt, true)
        setState({
          status: 'conflict',
          conflict: {
            local,
            remote: incoming,
            remoteVersion: incomingHash,
            remoteUpdatedAt: updatedAt,
            conflicts: ['first sync: both devices have different saves'],
          },
          lastError: null,
          needsReview: true,
        })
        return 'conflict'
      }
      if (checksumDocument(local) === checksumDocument(base)) {
        deps.applyRemoteDocument(incoming)
        deps.onDocumentApplied?.(incoming)
        engine.adoptIncoming(incoming, incomingHash, updatedAt)
        return 'applied'
      }
      let mergeResult: ReturnType<typeof tryAutoMerge>
      try {
        mergeResult = tryAutoMerge(base, local, incoming)
      } catch {
        mergeResult = { ok: false, conflicts: ['automatic merge failed unexpectedly'] }
      }
      if (mergeResult.ok) {
        const validated = parseDocument(mergeResult.document)
        if (!validated.ok) {
          setState({ status: 'error', lastError: 'The merged document is not valid.' })
          return 'rejected'
        }
        deps.applyRemoteDocument(validated.value)
        deps.onDocumentApplied?.(validated.value)
        // Keep the old common base for the merge; the merged local is dirty and
        // will be pushed back against the sender's new version.
        persistCursor(incomingHash, updatedAt, false)
        setState({
          status: 'dirty',
          conflict: null,
          lastError: null,
          lastSyncedAt: now().toISOString(),
          needsReview: false,
        })
        engine.markDirty()
        return 'applied'
      }
      persistCursor(incomingHash, updatedAt, true)
      setState({
        status: 'conflict',
        conflict: {
          local,
          remote: incoming,
          remoteVersion: incomingHash,
          remoteUpdatedAt: updatedAt,
          conflicts: mergeResult.conflicts,
        },
        lastError: null,
        needsReview: true,
      })
      return 'conflict'
    },

    markDirty: (): void => {
      if (!autoEnabled) return
      if (!state.peerId) return
      if (getDevOffset() !== 0) {
        setState({ status: 'paused' })
        return
      }
      if (!isAvailable()) {
        setState({ status: 'offline' })
        return
      }
      if (state.status === 'conflict' || state.status === 'pushing') return
      setState({ status: 'dirty', lastError: null })
      clearPushTimer()
      pushTimer = setTimeout(() => {
        pushTimer = null
        void doPush()
      }, pushDelay)
    },

    pullNow: async (options: { announce?: boolean } = {}): Promise<void> => {
      const peerId = state.peerId
      if (!peerId || getDevOffset() !== 0 || !isAvailable()) return
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
      let localAtStart: string
      try {
        localAtStart = checksumDocument(deps.getLocalDocument())
      } catch {
        return
      }
      pullInFlight = true
      setState({ status: 'pulling' })
      try {
        const snapshot = await deps.api.getSync(state.peerVersion ?? undefined)
        if (generation !== pullGeneration || state.peerId !== peerId) return
        const dirtyDuringPull = state.status === 'dirty'
        const wasDirty = previous === 'dirty' || dirtyDuringPull
        if (!snapshot) {
          if (!dirtyDuringPull) {
            setState({ status: wasDirty ? 'dirty' : 'synced' })
          }
          if (wasDirty && !dirtyDuringPull) engine.markDirty()
          return
        }
        if (snapshot.version === state.peerVersion) {
          if (!dirtyDuringPull) {
            setState({ status: wasDirty ? 'dirty' : 'synced' })
          }
          return
        }
        if (wasDirty) {
          await openConflict()
          return
        }
        const parsed = parseDocument(snapshot.document)
        if (!parsed.ok) {
          setState({ status: 'error', lastError: 'The other device sent an invalid save.' })
          return
        }
        const remote = parsed.value
        if (checksumDocument(deps.getLocalDocument()) !== localAtStart) {
          // A local edit landed while the snapshot was in flight; merge instead
          // of overwriting it.
          await openConflict()
          return
        }
        deps.applyRemoteDocument(remote)
        deps.onDocumentApplied?.(remote)
        persistVersion(
          snapshot.version,
          snapshot.updatedAt,
          checksumDocument(remote),
          remote,
        )
        if (state.status === 'pulling') {
          setState({ status: 'synced', lastError: null, lastSyncedAt: now().toISOString() })
        }
        if (options.announce) deps.onRemoteApplied?.()
      } catch (error) {
        if (state.status === 'pulling') {
          const unreachable = isNetworkUnreachable(error)
          setState({
            status: unreachable || !isAvailable() ? 'offline' : 'error',
            lastError: toUserSyncError(error, 'Pull failed.'),
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
          flushPendingPull()
        }
      }
    },

    resolveKeepMine: async (): Promise<void> => {
      const conflict = state.conflict
      if (!conflict || !state.peerId) return
      setState({ status: 'pushing' })
      try {
        const document = deps.getLocalDocument()
        const result = await runWithLock(() =>
          deps.api.putSync(document, { ifMatch: conflict.remoteVersion }),
        )
        backoffMs = 2000
        persistVersion(result.version, result.updatedAt, checksumDocument(document), document)
        mergeRetries = 0
        const changedDuringPush = localDiffersFromBase()
        setState({
          status: changedDuringPush ? 'dirty' : 'synced',
          conflict: null,
          lastSyncedAt: now().toISOString(),
          needsReview: false,
        })
        if (changedDuringPush) engine.markDirty()
        flushPendingPull()
      } catch (error) {
        if (error instanceof SyncConflictError) {
          await openConflict()
        } else {
          const unreachable = isNetworkUnreachable(error)
          setState({
            status: unreachable ? 'offline' : 'error',
            lastError: toUserSyncError(error, 'Push failed.'),
          })
        }
      }
    },

    resolveKeepPeer: (): void => {
      const conflict = state.conflict
      if (!conflict || !state.peerId) return
      deps.applyRemoteDocument(conflict.remote)
      deps.onDocumentApplied?.(conflict.remote)
      persistVersion(
        conflict.remoteVersion,
        conflict.remoteUpdatedAt,
        checksumDocument(conflict.remote),
        conflict.remote,
      )
      setState({
        status: 'synced',
        conflict: null,
        lastError: null,
        lastSyncedAt: now().toISOString(),
        needsReview: false,
      })
      flushPendingPull()
    },


    /**
     * Manual sync: bypasses the auto-sync/discovery gate and tries the last
     * known address, so a pairing still works on networks where UDP discovery
     * is blocked.
     */
    syncNow: async (): Promise<void> => {
      if (!state.peerId) return
      if (state.needsReview && !state.conflict) {
        forceAvailable = true
        try {
          await openConflict()
        } finally {
          forceAvailable = false
        }
        return
      }
      forceAvailable = true
      try {
        if (localDiffersFromBase()) {
          setState({ status: 'dirty', lastError: null })
          await engine.pullNow({ announce: true })
          if (state.status !== 'conflict') {
            clearPushTimer()
            await doPush()
          }
        } else {
          await engine.pullNow({ announce: true })
        }
      } catch (error) {
        const unreachable = isNetworkUnreachable(error)
        setState({
          status: unreachable || !isAvailable() ? 'offline' : 'error',
          lastError: toUserSyncError(error, 'Sync failed.'),
        })
      } finally {
        forceAvailable = false
      }
    },

    discardConflict: (): void => {
      // Conflicts are blocking: closing the dialog must not pretend the two
      // copies are in sync. Keep the state until the user picks a side.
      if (!state.conflict) return
      setState({ status: 'conflict', needsReview: true })
    },

    /**
     * The coordinator calls this whenever discovery reports the peer as
     * present or gone. Coming online re-runs the dirty/pull decision.
     */
    setAvailable: (available: boolean): void => {
      if (!state.peerId) return
      if (available) {
        if (state.needsReview) {
          void openConflict()
          return
        }
        if (!autoEnabled) return
        if (state.status === 'offline' || state.status === 'error') {
          setState({ status: localDiffersFromBase() ? 'dirty' : 'synced', lastError: null })
          void engine.pullNow()
        }
        return
      }
      if (state.status === 'conflict' || state.status === 'pushing' || state.status === 'pulling') {
        return
      }
      setState({ status: 'offline' })
    },

    setAutoSync: (enabled: boolean): void => {
      autoEnabled = enabled
      if (!enabled) clearPushTimer()
    },

    dispose: (): void => {
      clearPushTimer()
      listeners.clear()
    },
  }

  return engine
}

export type PeerSyncEngine = ReturnType<typeof createPeerSyncEngine>
