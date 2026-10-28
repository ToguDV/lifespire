import type { GameDocument } from '@lifespire/core'
import { parseDocument } from '@lifespire/core'
import { checksumDocument } from './checksum'
import { createPeerSyncEngine } from './peerEngine'
import type { PeerConflict, PeerEngineState, PeerSyncEngine, PeerSyncStatus } from './peerEngine'
import { SyncConflictError, toUserSyncError } from './errors'
import type {
  DeviceIdentity,
  IncomingDocument,
  LocalPeerApi,
  LocalTransport,
  NearbyPeer,
  PairingPayload,
  PeerRecord,
  PeerResponse,
  PeerSnapshot,
} from './protocol'
import { peerBaseKey, peerMetaKey } from './storageKeys'

export type LocalSyncPhase = 'off' | 'idle' | 'syncing' | 'error'

export interface LocalPeerView extends PeerRecord {
  status: PeerSyncStatus
  lastError: string | null
  lastSyncedAt: string | null
  conflict: PeerConflict | null
  needsReview: boolean
}

export interface LocalConflictView {
  peerId: string
  peerName: string
  conflict: PeerConflict
}

export interface LocalSyncState {
  initialized: boolean
  available: boolean
  phase: LocalSyncPhase
  device: DeviceIdentity | null
  discoverable: boolean
  nearby: NearbyPeer[]
  peers: Record<string, LocalPeerView>
  conflicts: LocalConflictView[]
  pairing: PairingPayload | null
  lastError: string | null
}

interface LikeStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface LocalSyncDeps {
  transport: LocalTransport
  storage: LikeStorage
  getLocalDocument: () => GameDocument
  applyRemoteDocument: (document: GameDocument) => void
  deviceName: string
  initialDiscoverable?: boolean
  getDevOffset?: () => number
  now?: () => Date
  /** Best-effort local backup before an incoming/merged document applies. */
  onBackup?: () => void
  onRemoteApplied?: (peerName: string) => void
}

function initialState(): LocalSyncState {
  return {
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
}

function readJson(body: unknown): Record<string, unknown> | null {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : null
}

export function createLocalSyncEngine(deps: LocalSyncDeps) {
  const now = deps.now ?? (() => new Date())
  let state = initialState()
  const listeners = new Set<() => void>()
  const engines = new Map<string, PeerSyncEngine>()
  const unsubscribers = new Set<() => void>()
  const nearbyIds = new Set<string>()
  let mirrorTimer: ReturnType<typeof setTimeout> | null = null
  let started = false
  let incomingQueue: Promise<void> = Promise.resolve()

  const emit = (): void => {
    listeners.forEach((listener) => listener())
  }

  const patchState = (patch: Partial<LocalSyncState>): void => {
    state = { ...state, ...patch }
    emit()
  }

  const updatePeerView = (peerId: string): void => {
    const engine = engines.get(peerId)
    const record = state.peers[peerId]
    if (!engine || !record) return
    const engineState: PeerEngineState = engine.getState()
    state = {
      ...state,
      peers: {
        ...state.peers,
        [peerId]: {
          ...record,
          lastSyncAt: engineState.lastSyncedAt ?? record.lastSyncAt,
          status: engineState.status,
          lastError: engineState.lastError,
          lastSyncedAt: engineState.lastSyncedAt,
          conflict: engineState.conflict,
          needsReview: engineState.needsReview,
        },
      },
    }
    const conflicts: LocalConflictView[] = []
    for (const [id, peer] of Object.entries(state.peers)) {
      if (peer.conflict) conflicts.push({ peerId: id, peerName: peer.name, conflict: peer.conflict })
    }
    state = { ...state, conflicts }
    emit()
  }

  const refreshPhase = (): void => {
    const statuses = Object.values(state.peers).map((peer) => peer.status)
    const errors = Object.values(state.peers)
      .map((peer) => peer.lastError)
      .filter((message): message is string => Boolean(message))
    if (errors.length > 0) {
      patchState({ phase: 'error', lastError: errors[0] })
      return
    }
    if (statuses.some((status) => status === 'pushing' || status === 'pulling')) {
      patchState({ phase: 'syncing' })
      return
    }
    patchState({ phase: 'idle' })
  }

  const peerApi = (peerId: string): LocalPeerApi => ({
    getSync: async (ifMatch?: string): Promise<PeerSnapshot | null> => {
      const infoResponse = await deps.transport.request(peerId, {
        method: 'GET',
        path: '/v1/info',
      })
      if (infoResponse.status !== 200) {
        throw new Error(`The other device answered ${infoResponse.status}.`)
      }
      const info = readJson(infoResponse.body)
      const docHash = typeof info?.docHash === 'string' ? info.docHash : null
      if (!docHash) return null
      if (ifMatch && docHash === ifMatch) return null

      const documentResponse = await deps.transport.request(peerId, {
        method: 'GET',
        path: '/v1/document',
      })
      if (documentResponse.status !== 200) {
        throw new Error(`The other device answered ${documentResponse.status}.`)
      }
      const payload = readJson(documentResponse.body)
      if (!payload) throw new Error('The other device sent an empty document.')
      if (typeof payload.documentJson !== 'string') {
        throw new Error('The other device sent an unreadable document.')
      }
      return {
        version: typeof payload.docHash === 'string' ? payload.docHash : docHash,
        schemaVersion:
          typeof payload.schemaVersion === 'number' ? payload.schemaVersion : 0,
        document: JSON.parse(payload.documentJson) as unknown,
        updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : now().toISOString(),
      }
    },

    putSync: async (document: unknown, options): Promise<{ version: string; updatedAt: string }> => {
      const response: PeerResponse = await deps.transport.request(peerId, {
        method: 'POST',
        path: '/v1/document',
        body: {
          documentJson: JSON.stringify(document),
          expectedHash: options.create ? null : (options.ifMatch ?? null),
          docHash: checksumDocument(document),
        },
      })
      if (response.status === 409) {
        const body = readJson(response.body)
        const currentVersion = typeof body?.docHash === 'string' ? body.docHash : ''
        const currentUpdatedAt =
          typeof body?.updatedAt === 'string' ? body.updatedAt : now().toISOString()
        throw new SyncConflictError(currentVersion, currentUpdatedAt)
      }
      if (response.status !== 200 && response.status !== 202) {
        const body = readJson(response.body)
        throw new Error(
          typeof body?.message === 'string'
            ? body.message
            : `The other device answered ${response.status}.`,
        )
      }
      const body = readJson(response.body)
      return {
        version:
          typeof body?.docHash === 'string' ? body.docHash : checksumDocument(document),
        updatedAt:
          typeof body?.updatedAt === 'string' ? body.updatedAt : now().toISOString(),
      }
    },
  })

  const ensureEngine = (peer: PeerRecord, available: boolean): PeerSyncEngine => {
    const existing = engines.get(peer.peerId)
    if (existing) {
      existing.setAutoSync(peer.autoSync)
      const current = state.peers[peer.peerId]
      if (current && current.fingerprint !== peer.fingerprint) {
        // Identity changed: never keep the old merge base silently.
        try {
          deps.storage.removeItem(peerBaseKey(peer.peerId))
          deps.storage.removeItem(peerMetaKey(peer.peerId))
        } catch {
          // Best-effort; the first sync falls back to the explicit dialog.
        }
        existing.setPeerId(peer.peerId)
      }
      state = {
        ...state,
        peers: {
          ...state.peers,
          [peer.peerId]: {
            ...peer,
            status: existing.getState().status,
            lastError: existing.getState().lastError,
            lastSyncedAt: existing.getState().lastSyncedAt ?? peer.lastSyncAt,
            conflict: existing.getState().conflict,
            needsReview: existing.getState().needsReview,
          },
        },
      }
      emit()
      return existing
    }

    const engine = createPeerSyncEngine({
      storage: deps.storage,
      api: peerApi(peer.peerId),
      peerId: peer.peerId,
      getLocalDocument: deps.getLocalDocument,
      applyRemoteDocument: deps.applyRemoteDocument,
      onRemoteApplied: () => deps.onRemoteApplied?.(peer.name),
      onDocumentApplied: () => {
        scheduleMirror()
        for (const [peerId, other] of engines) {
          if (peerId !== peer.peerId && state.peers[peerId]?.autoSync) other.markDirty()
        }
      },
      getDevOffset: deps.getDevOffset,
      isAvailable: () => nearbyIds.has(peer.peerId),
      now,
      onBeforeAutoMergePush: () => deps.onBackup?.(),
    })
    engines.set(peer.peerId, engine)
    const unsubscribe = engine.subscribe(() => {
      updatePeerView(peer.peerId)
      refreshPhase()
    })
    unsubscribers.add(unsubscribe)
    state = {
      ...state,
      peers: {
        ...state.peers,
        [peer.peerId]: {
          ...peer,
          status: 'offline',
          lastError: null,
          lastSyncedAt: peer.lastSyncAt,
          conflict: null,
          needsReview: false,
        },
      },
    }
    engine.setPeerId(peer.peerId)
    engine.setAutoSync(peer.autoSync)
    if (available && peer.autoSync) {
      engine.setAvailable(true)
      engine.adoptLocal()
    } else {
      engine.setAvailable(false)
    }
    emit()
    return engine
  }

  const setNearby = (nearby: NearbyPeer[]): void => {
    nearbyIds.clear()
    nearby.forEach((peer) => nearbyIds.add(peer.deviceId))
    state = { ...state, nearby }
    for (const [peerId, engine] of engines) {
      const present = nearbyIds.has(peerId)
      if (!present) engine.setAvailable(false)
      else if (state.peers[peerId]?.autoSync) engine.setAvailable(true)
    }
    emit()
  }

  const refreshPairs = async (): Promise<void> => {
    const peers = await deps.transport.listPeers()
    const byId = new Map(peers.map((peer) => [peer.peerId, peer]))
    for (const peer of peers) ensureEngine(peer, nearbyIds.has(peer.peerId))
    for (const peerId of Array.from(engines.keys())) {
      if (byId.has(peerId)) continue
      const engine = engines.get(peerId)
      engine?.dispose()
      engines.delete(peerId)
      const nextPeers = { ...state.peers }
      delete nextPeers[peerId]
      state = { ...state, peers: nextPeers }
    }
    emit()
  }

  const hasOpenConflict = (): boolean =>
    state.conflicts.length > 0 ||
    Object.values(state.peers).some((peer) => peer.needsReview)

  const flushMirror = async (): Promise<void> => {
    if (mirrorTimer !== null) {
      clearTimeout(mirrorTimer)
      mirrorTimer = null
    }
    if (!deps.transport.available) return
    // While a conflict is open the node keeps serving the last accepted peer
    // document; advertising the unresolved local copy would make the sender
    // pull it and lose its own edit.
    if (hasOpenConflict()) return
    const document = deps.getLocalDocument()
    try {
      await deps.transport.setDocument(JSON.stringify(document), checksumDocument(document))
    } catch (error) {
      patchState({ lastError: toUserSyncError(error, 'Could not update the local sync mirror.') })
    }
  }

  const cancelScheduledMirror = (): void => {
    if (mirrorTimer !== null) {
      clearTimeout(mirrorTimer)
      mirrorTimer = null
    }
  }

  const scheduleMirror = (): void => {
    if (!deps.transport.available) return
    if (hasOpenConflict()) {
      cancelScheduledMirror()
      return
    }
    if (mirrorTimer !== null) clearTimeout(mirrorTimer)
    mirrorTimer = setTimeout(() => {
      mirrorTimer = null
      void flushMirror()
    }, 250)
  }

  const handleIncoming = async (incoming: IncomingDocument): Promise<void> => {
    // A queued item from a stopped session must stay in the durable inbox for
    // the next start instead of being acked against cleared engines.
    if (!started) return
    const peer = state.peers[incoming.fromPeerId]
    if (!peer) {
      await deps.transport.ackIncoming(incoming.id, {
        ok: false,
        error: 'Unknown peer',
      })
      return
    }
    const parsed = parseDocument(incoming.documentJson)
    if (!parsed.ok) {
      await deps.transport.ackIncoming(incoming.id, {
        ok: false,
        error: `Rejected document: ${parsed.reason}`,
      })
      return
    }
    const peerEngine = engines.get(incoming.fromPeerId)
    if (!peerEngine) {
      await deps.transport.ackIncoming(incoming.id, { ok: false, error: 'Unknown peer engine' })
      return
    }
    const actualHash = checksumDocument(parsed.value)
    let result: 'applied' | 'conflict' | 'rejected'
    try {
      result = await peerEngine.receiveRemote(parsed.value, incoming.updatedAt)
    } catch (error) {
      await deps.transport.ackIncoming(incoming.id, {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not apply the document.',
      })
      return
    }
    if (result === 'rejected') {
      await deps.transport.ackIncoming(incoming.id, {
        ok: false,
        error: 'The incoming document was rejected.',
      })
      return
    }
    // On a conflict the server mirror must stay on the sender's copy (the ack
    // will set it); a pending mirror write of our unresolved local copy would
    // make the sender pull it and lose its own edit.
    if (result === 'conflict') cancelScheduledMirror()
    await deps.transport.ackIncoming(incoming.id, {
      ok: true,
      docHash: actualHash,
      updatedAt: incoming.updatedAt,
    })
    if (result === 'applied') await flushMirror()
    // Every other auto-sync peer now needs this document too.
    for (const [peerId, other] of engines) {
      if (peerId !== incoming.fromPeerId && state.peers[peerId]?.autoSync) other.markDirty()
    }
    emit()
  }

  const enqueueIncoming = (incoming: IncomingDocument): void => {
    incomingQueue = incomingQueue
      .then(() => handleIncoming(incoming))
      .catch(() => undefined)
  }

  const completePair = (peer: PeerRecord): PeerRecord => {
    const peerEngine = ensureEngine(peer, nearbyIds.has(peer.peerId))
    patchState({ pairing: null, lastError: null })
    if (peer.autoSync) {
      peerEngine.setAvailable(nearbyIds.has(peer.peerId))
      peerEngine.adoptLocal()
      void engine.syncNow(peer.peerId)
    } else {
      peerEngine.setAvailable(false)
    }
    return peer
  }

  const engine = {
    getState: () => state,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    start: async (): Promise<void> => {
      if (started) return
      started = true
      if (!deps.transport.available) {
        patchState({
          initialized: true,
          available: false,
          phase: 'off',
          discoverable: false,
        })
        return
      }
      try {
        const device = await deps.transport.start({
          name: deps.deviceName,
          discoverable: deps.initialDiscoverable ?? false,
        })
        patchState({
          device,
          discoverable: deps.initialDiscoverable ?? false,
          available: true,
        })
        const [peers, nearby] = await Promise.all([
          deps.transport.listPeers(),
          deps.transport.listNearby(),
        ])
        nearbyIds.clear()
        nearby.forEach((peer) => nearbyIds.add(peer.deviceId))
        state = { ...state, nearby }
        for (const peer of peers) ensureEngine(peer, nearbyIds.has(peer.peerId))
        // Only now can we tell whether a persisted conflict must keep the node
        // from advertising the unresolved local copy.
        await flushMirror()
        unsubscribers.add(deps.transport.onPeersChanged(setNearby))
        unsubscribers.add(
          deps.transport.onPaired((peer) => {
            completePair(peer)
            emit()
          }),
        )
        unsubscribers.add(
          deps.transport.onIncomingDocument((incoming) => {
            enqueueIncoming(incoming)
          }),
        )
        unsubscribers.add(
          deps.transport.onError((message) => {
            patchState({ lastError: toUserSyncError(message, message), phase: 'error' })
          }),
        )
        const pending = await deps.transport.pendingIncoming()
        for (const item of pending) enqueueIncoming(item)
        patchState({ initialized: true, phase: 'idle' })
      } catch (error) {
        started = false
        try {
          await deps.transport.stop()
        } catch {
          // The node may have failed before it was fully started.
        }
        patchState({
          initialized: true,
          available: deps.transport.available,
          phase: 'error',
          lastError: toUserSyncError(error, 'Could not start local sync.'),
        })
      }
    },

    stop: async (): Promise<void> => {
      if (!started) return
      started = false
      if (mirrorTimer !== null) {
        clearTimeout(mirrorTimer)
        mirrorTimer = null
      }
      unsubscribers.forEach((unsubscribe) => unsubscribe())
      unsubscribers.clear()
      engines.forEach((peerEngine) => peerEngine.dispose())
      engines.clear()
      nearbyIds.clear()
      try {
        await deps.transport.stop()
      } catch {
        // Stopping is best-effort.
      }
      state = { ...initialState(), available: deps.transport.available }
      emit()
    },

    setDiscoverable: async (discoverable: boolean): Promise<void> => {
      patchState({ discoverable })
      if (!deps.transport.available) return
      try {
        await deps.transport.setDiscoverable(discoverable)
      } catch (error) {
        patchState({ lastError: toUserSyncError(error, 'Could not change discoverability.') })
      }
    },

    handleDocumentChange: (): void => {
      scheduleMirror()
      for (const [peerId, peerEngine] of engines) {
        if (state.peers[peerId]?.autoSync) peerEngine.markDirty()
      }
    },

    syncNow: async (peerId?: string): Promise<void> => {
      await flushMirror()
      const targets = peerId ? [peerId] : Object.keys(state.peers)
      for (const id of targets) {
        const peerEngine = engines.get(id)
        if (!peerEngine) continue
        await peerEngine.syncNow()
      }
      refreshPhase()
    },

    startPairing: async (): Promise<PairingPayload | null> => {
      if (!deps.transport.available) return null
      try {
        const payload = await deps.transport.startPairing()
        patchState({ pairing: payload, lastError: null })
        return payload
      } catch (error) {
        patchState({ lastError: toUserSyncError(error, 'Could not start pairing.') })
        return null
      }
    },

    cancelPairing: async (): Promise<void> => {
      patchState({ pairing: null })
      try {
        await deps.transport.cancelPairing()
      } catch {
        // Best-effort.
      }
    },

    pair: async (payload: PairingPayload): Promise<PeerRecord | null> => {
      try {
        const peer = await deps.transport.pair(payload)
        return completePair(peer)
      } catch (error) {
        patchState({ lastError: toUserSyncError(error, 'Could not pair the device.') })
        return null
      }
    },

    pairWithCode: async (deviceId: string, code: string): Promise<PeerRecord | null> => {
      try {
        const peer = await deps.transport.pairWithCode(deviceId, code)
        return completePair(peer)
      } catch (error) {
        patchState({ lastError: toUserSyncError(error, 'Could not pair the device.') })
        return null
      }
    },

    forget: async (peerId: string): Promise<void> => {
      try {
        await deps.transport.forget(peerId)
      } catch (error) {
        patchState({ lastError: toUserSyncError(error, 'Could not forget the device.') })
        return
      }
      const peerEngine = engines.get(peerId)
      peerEngine?.dispose()
      engines.delete(peerId)
      const peers = { ...state.peers }
      delete peers[peerId]
      try {
        deps.storage.removeItem(peerBaseKey(peerId))
        deps.storage.removeItem(peerMetaKey(peerId))
      } catch {
        // Best-effort cleanup of the merge base.
      }
      state = { ...state, peers }
      emit()
    },

    setAutoSync: async (peerId: string, autoSync: boolean): Promise<void> => {
      try {
        await deps.transport.setAutoSync(peerId, autoSync)
      } catch (error) {
        patchState({ lastError: toUserSyncError(error, 'Could not save the auto-sync setting.') })
        return
      }
      const peer = state.peers[peerId]
      if (!peer) return
      state = { ...state, peers: { ...state.peers, [peerId]: { ...peer, autoSync } } }
      emit()
      const peerEngine = engines.get(peerId)
      peerEngine?.setAutoSync(autoSync)
      if (autoSync && nearbyIds.has(peerId)) {
        peerEngine?.setAvailable(true)
        peerEngine?.adoptLocal()
      }
    },

    resolveKeepMine: async (peerId: string): Promise<void> => {
      await engines.get(peerId)?.resolveKeepMine()
      refreshPhase()
      await flushMirror()
    },

    resolveKeepPeer: async (peerId: string): Promise<void> => {
      engines.get(peerId)?.resolveKeepPeer()
      refreshPhase()
      await flushMirror()
    },

    discardConflict: (peerId: string): void => {
      engines.get(peerId)?.discardConflict()
      refreshPhase()
    },

    /**
     * Called by the UI when the app returns to the foreground. Discovery is
     * transport-owned; the coordinator only nudges paired peers that are
     * already visible.
     */
    refresh: async (): Promise<void> => {
      if (!started) return
      await flushMirror()
      try {
        const nearby = await deps.transport.listNearby()
        setNearby(nearby)
        await refreshPairs()
      } catch {
        // The next discovery event retries.
      }
    },

    /**
     * Android lifecycle: stop the sockets in the background without tearing
     * down the registered peers or the merge bases. `resume` restarts the
     * native node and re-evaluates which peers are nearby.
     */
    pause: async (): Promise<void> => {
      if (!started) return
      nearbyIds.clear()
      state = { ...state, nearby: [] }
      for (const peerEngine of engines.values()) peerEngine.setAvailable(false)
      try {
        await deps.transport.stop()
      } catch {
        // Best-effort; Android may already have frozen the process.
      }
      patchState({ available: false, phase: 'off' })
    },

    resume: async (): Promise<void> => {
      if (!started || !deps.transport.available) return
      try {
        const device = await deps.transport.start({
          name: deps.deviceName,
          discoverable: state.discoverable,
        })
        patchState({ device, available: true })
        await flushMirror()
        const [peers, nearby] = await Promise.all([
          deps.transport.listPeers(),
          deps.transport.listNearby(),
        ])
        nearbyIds.clear()
        nearby.forEach((peer) => nearbyIds.add(peer.deviceId))
        state = { ...state, nearby }
        for (const peer of peers) ensureEngine(peer, nearbyIds.has(peer.peerId))
        for (const [peerId, peerEngine] of engines) {
          const present = nearbyIds.has(peerId)
          if (!present) peerEngine.setAvailable(false)
          else if (state.peers[peerId]?.autoSync) peerEngine.setAvailable(true)
        }
        patchState({ phase: 'idle', lastError: null })
      } catch (error) {
        patchState({
          available: false,
          phase: 'error',
          lastError: toUserSyncError(error, 'Could not resume local sync.'),
        })
      }
    },

    dispose: async (): Promise<void> => {
      await engine.stop()
      listeners.clear()
    },
  }

  return engine
}

export type LocalSyncEngine = ReturnType<typeof createLocalSyncEngine>
