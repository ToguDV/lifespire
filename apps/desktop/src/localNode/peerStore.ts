import crypto from 'node:crypto'
import type { PeerRecord, StoredPeer } from './protocol'
import type { EncryptedStore, SecretBox, VaultFile } from './vault'
import { createEncryptedStore } from './vault'

export interface PeerStore {
  list(): PeerRecord[]
  stored(): StoredPeer[]
  find(peerId: string): StoredPeer | null
  findByToken(token: string): StoredPeer | null
  upsert(peer: StoredPeer): void
  update(peerId: string, patch: Partial<StoredPeer>): StoredPeer | null
  remove(peerId: string): void
  setAutoSync(peerId: string, autoSync: boolean): PeerRecord | null
  touch(
    peerId: string,
    patch: { lastSyncAt?: string; lastHost?: string; lastPort?: number },
  ): void
  locked(): boolean
  persistence(): 'encrypted' | 'plaintext'
}

interface StoredFile {
  version: 1
  peers: StoredPeer[]
}

function isStoredPeer(value: unknown): value is StoredPeer {
  if (!value || typeof value !== 'object') return false
  const peer = value as Partial<StoredPeer>
  return (
    typeof peer.peerId === 'string' &&
    peer.peerId.length >= 8 &&
    typeof peer.name === 'string' &&
    typeof peer.fingerprint === 'string' &&
    typeof peer.certPem === 'string' &&
    typeof peer.token === 'string' &&
    typeof peer.pairedAt === 'string' &&
    typeof peer.autoSync === 'boolean'
  )
}

function toPublic(peer: StoredPeer): PeerRecord {
  return {
    peerId: peer.peerId,
    name: peer.name,
    fingerprint: peer.fingerprint,
    autoSync: peer.autoSync,
    pairedAt: peer.pairedAt,
    lastSyncAt: peer.lastSyncAt,
  }
}

function sameToken(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  try {
    return crypto.timingSafeEqual(left, right)
  } catch {
    return false
  }
}

export function createPeerStore(deps: {
  file: VaultFile
  secrets: SecretBox
}): PeerStore {
  const store: EncryptedStore<StoredFile> = createEncryptedStore<StoredFile>({
    file: deps.file,
    secrets: deps.secrets,
  })
  let peers: StoredPeer[] | null = null
  let locked = false

  const load = (): StoredPeer[] => {
    if (peers) return peers
    const value = store.read()
    if (!value) {
      if (store.status() === 'unreadable') locked = true
      peers = []
      return peers
    }
    if (value.version !== 1 || !Array.isArray(value.peers)) {
      locked = true
      peers = []
      return peers
    }
    peers = value.peers.filter(isStoredPeer).map((peer) => ({
      ...peer,
      lastSyncAt: typeof peer.lastSyncAt === 'string' ? peer.lastSyncAt : null,
      lastHost: typeof peer.lastHost === 'string' ? peer.lastHost : null,
      lastPort: typeof peer.lastPort === 'number' ? peer.lastPort : null,
    }))
    return peers
  }

  const save = (): void => {
    if (locked) {
      throw new Error(
        'The paired-device registry could not be decrypted. Restore the OS keychain or pair the devices again.',
      )
    }
    store.write({ version: 1, peers: load() })
  }

  return {
    locked: () => locked,
    list: () => load().map(toPublic),
    stored: () => load().map((peer) => ({ ...peer })),

    find: (peerId) => load().find((peer) => peer.peerId === peerId) ?? null,

    findByToken: (token) => {
      if (!token) return null
      return load().find((peer) => sameToken(peer.token, token)) ?? null
    },

    upsert: (peer) => {
      const current = load()
      const index = current.findIndex((candidate) => candidate.peerId === peer.peerId)
      if (index === -1) current.push(peer)
      else current[index] = peer
      save()
    },

    update: (peerId, patch) => {
      const current = load()
      const index = current.findIndex((peer) => peer.peerId === peerId)
      if (index === -1) return null
      const existing = current[index]
      if (!existing) return null
      const next: StoredPeer = { ...existing, ...patch, peerId }
      current[index] = next
      save()
      return { ...next }
    },

    remove: (peerId) => {
      const current = load()
      const index = current.findIndex((peer) => peer.peerId === peerId)
      if (index === -1) return
      current.splice(index, 1)
      save()
    },

    setAutoSync: (peerId, autoSync) => {
      const next = load().find((peer) => peer.peerId === peerId)
      if (!next) return null
      next.autoSync = autoSync
      save()
      return toPublic(next)
    },

    touch: (peerId, patch) => {
      const peer = load().find((candidate) => candidate.peerId === peerId)
      if (!peer) return
      if (patch.lastSyncAt !== undefined) peer.lastSyncAt = patch.lastSyncAt
      if (patch.lastHost !== undefined) peer.lastHost = patch.lastHost
      if (patch.lastPort !== undefined) peer.lastPort = patch.lastPort
      save()
    },

    persistence: () => (store.encrypted() ? 'encrypted' : 'plaintext'),
  }
}

export function newStoredPeer(deps: {
  peerId: string
  name: string
  fingerprint: string
  certPem: string
  token: string
  lastHost: string | null
  lastPort: number | null
  now?: () => Date
}): StoredPeer {
  const now = deps.now ?? (() => new Date())
  return {
    peerId: deps.peerId,
    name: deps.name,
    fingerprint: deps.fingerprint,
    certPem: deps.certPem,
    token: deps.token,
    autoSync: true,
    pairedAt: now().toISOString(),
    lastSyncAt: null,
    lastHost: deps.lastHost,
    lastPort: deps.lastPort,
  }
}
