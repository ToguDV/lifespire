import { STORAGE_BACKUP_KEY, STORAGE_KEY } from '@lifespire/core'

/** Guest (signed-out) save key. Kept stable for existing installs. */
export const GUEST_KEY = STORAGE_KEY
export const GUEST_BACKUP_KEY = STORAGE_BACKUP_KEY
export const GUEST_META_KEY = `${STORAGE_KEY}:meta`
/** Last authenticated user (id/email/role only, never the token). */
export const SESSION_KEY = `${STORAGE_KEY}:session`
/** Last guest raw kept aside when an account is adopted (legacy migration). */
export const GUEST_COPY_KEY = `${STORAGE_KEY}:guest-copy`
/** One-time marker written after promoting the active legacy save. */
export const LOCAL_SYNC_MIGRATION_KEY = `${STORAGE_KEY}:local-sync-migrated`
/** Device display name used by discovery and the pairing QR. */
export const DEVICE_NAME_KEY = 'lifespire:device-name'
/** Whether the device advertises itself on the LAN (string "1"/"0"). */
export const DISCOVERABLE_KEY = 'lifespire:discoverable'
/** Tests only: last migration report, useful for assertions. */
export const LOCAL_SYNC_MIGRATION_REPORT_KEY = `${STORAGE_KEY}:local-sync-migration-report`

function assertSafeUserId(userId: string): void {
  if (!userId || !/^[A-Za-z0-9_-]+$/.test(userId)) {
    throw new Error('Invalid user id for storage key')
  }
}

/** Per-account save key: `lifespire:mvp0:u:<userId>`. */
export function accountStorageKey(userId: string): string {
  assertSafeUserId(userId)
  return `${STORAGE_KEY}:u:${userId}`
}

export function accountBackupKey(userId: string): string {
  return `${accountStorageKey(userId)}:backup`
}

export function accountMetaKey(userId: string): string {
  return `${accountStorageKey(userId)}:meta`
}

/**
 * Last-synced cloud copy for conservative 3-way auto-merge. Written on every
 * successful push/pull alongside the meta; read as the merge base. Absent on
 * legacy installs until the next successful sync (then conflicts stay manual).
 */
export function accountBaseKey(userId: string): string {
  assertSafeUserId(userId)
  return `${accountStorageKey(userId)}:base`
}

/** Last-synced copy shared with a paired peer; the 3-way merge base. */
export function peerBaseKey(peerId: string): string {
  assertSafeUserId(peerId)
  return `${STORAGE_KEY}:peer:${peerId}:base`
}

/** Hash/updatedAt cursor for a paired peer. */
export function peerMetaKey(peerId: string): string {
  assertSafeUserId(peerId)
  return `${STORAGE_KEY}:peer:${peerId}:meta`
}

/** All legacy per-account save keys currently present in web storage. */
export function listLegacyAccountKeys(): string[] {
  const prefix = `${STORAGE_KEY}:u:`
  const keys: string[] = []
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.key === 'function') {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index)
        if (key && key.startsWith(prefix) && !/:(backup|meta|base)$/.test(key)) keys.push(key)
      }
    }
  } catch {
    // Storage may be unavailable; callers fall back to the session key.
  }
  return keys
}

/** Backup key derived from any save key (`<save>:backup`). */
export function backupKeyFor(saveKey: string): string {
  if (saveKey === GUEST_KEY) return GUEST_BACKUP_KEY
  return `${saveKey}:backup`
}

/** Meta key derived from any save key (`<save>:meta`). */
export function metaKeyFor(saveKey: string): string {
  if (saveKey === GUEST_KEY) return GUEST_META_KEY
  if (saveKey.endsWith(':backup') || saveKey.endsWith(':meta') || saveKey.endsWith(':base')) {
    throw new Error('Not a save key')
  }
  return `${saveKey}:meta`
}

/** Returns the user id for per-account keys, or null for guest/session keys. */
export function parseAccountId(saveKey: string): string | null {
  const prefix = `${STORAGE_KEY}:u:`
  if (!saveKey.startsWith(prefix)) return null
  const rest = saveKey.slice(prefix.length).split(':')[0] ?? ''
  return rest ? rest : null
}

/** Resolves the active save key for a signed-in user (or guest). */
export function saveKeyForUser(userId: string | null): string {
  return userId ? accountStorageKey(userId) : GUEST_KEY
}

/** True for guest and per-account save keys (never backup/meta/session). */
export function isSaveKey(key: string | null): boolean {
  if (!key) return false
  if (key === GUEST_KEY) return true
  if (!key.startsWith(`${STORAGE_KEY}:u:`)) return false
  return !key.endsWith(':backup') && !key.endsWith(':meta') && !key.endsWith(':base')
}
