import { parseDocument } from '@lifespire/core'
import type { GameDocument } from '@lifespire/core'
import {
  GUEST_BACKUP_KEY,
  GUEST_KEY,
  LOCAL_SYNC_MIGRATION_KEY,
  SESSION_KEY,
  accountStorageKey,
  listLegacyAccountKeys,
} from './storageKeys'

export type MigrationReason =
  | 'already-migrated'
  | 'no-save'
  | 'active-account'
  | 'guest'
  | 'legacy-account'
  | 'invalid-save'

export interface MigrationResult {
  migrated: boolean
  from: string | null
  reason: MigrationReason
  /** Other valid legacy saves kept untouched as backups. */
  alternatives: string[]
}

interface LikeStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface MigrationDeps {
  storage: LikeStorage
  now?: () => Date
  /** Enumerates legacy per-account keys; web defaults to localStorage. */
  listKeys?: () => string[]
}

function readSessionUserId(storage: LikeStorage): string | null {
  try {
    const raw = storage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { id?: unknown }
    return typeof parsed.id === 'string' && /^[A-Za-z0-9_-]+$/.test(parsed.id)
      ? parsed.id
      : null
  } catch {
    return null
  }
}

function readValidSave(storage: LikeStorage, key: string): GameDocument | null {
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    const parsed = parseDocument(raw)
    return parsed.ok ? parsed.value : null
  } catch {
    return null
  }
}

function hasProfile(document: GameDocument | null): boolean {
  return document?.profile != null
}

function backup(storage: LikeStorage, key: string, backupKey: string): void {
  try {
    const raw = storage.getItem(key)
    if (raw === null) return
    storage.setItem(backupKey, raw)
  } catch {
    // A backup is best-effort; the migration still keeps the source key.
  }
}

/**
 * Promotes the best legacy save (active account, then guest, then any other
 * account key) to the single canonical save key. Nothing is deleted: the
 * source keys and the previous guest copy stay as backups, so a rollback or a
 * manual recovery remains possible.
 */
export function migrateLegacySave(deps: MigrationDeps): MigrationResult {
  const { storage } = deps
  try {
    if (storage.getItem(LOCAL_SYNC_MIGRATION_KEY)) {
      return { migrated: false, from: null, reason: 'already-migrated', alternatives: [] }
    }
  } catch {
    return { migrated: false, from: null, reason: 'invalid-save', alternatives: [] }
  }

  const sessionUserId = readSessionUserId(storage)
  const candidates: string[] = []
  if (sessionUserId) candidates.push(accountStorageKey(sessionUserId))
  candidates.push(GUEST_KEY)
  const extra = (deps.listKeys ?? listLegacyAccountKeys)()
  for (const key of extra) {
    if (!candidates.includes(key)) candidates.push(key)
  }

  const validWithProfile: Array<{ key: string; document: GameDocument }> = []
  let chosenWithoutProfile: { key: string; document: GameDocument } | null = null
  for (const key of candidates) {
    const document = readValidSave(storage, key)
    if (!document) continue
    if (hasProfile(document)) {
      validWithProfile.push({ key, document })
    } else if (!chosenWithoutProfile) {
      chosenWithoutProfile = { key, document }
    }
  }
  // Prefer the active account when the old session is still present. Without
  // a session, use the newest profile creation date instead of blindly keeping
  // a possibly stale guest save.
  const sessionKey = sessionUserId ? accountStorageKey(sessionUserId) : null
  validWithProfile.sort((left, right) => {
    if (left.key === sessionKey) return -1
    if (right.key === sessionKey) return 1
    const leftDate = left.document.profile?.createdAt ?? ''
    const rightDate = right.document.profile?.createdAt ?? ''
    return rightDate.localeCompare(leftDate)
  })
  const selected = validWithProfile[0] ?? chosenWithoutProfile
  const alternatives = validWithProfile
    .filter((candidate) => candidate.key !== selected?.key)
    .map((candidate) => candidate.key)
  if (!selected) {
    const anyRaw = candidates.some((key) => {
      try {
        return storage.getItem(key) !== null
      } catch {
        return false
      }
    })
    return {
      migrated: false,
      from: null,
      reason: anyRaw ? 'invalid-save' : 'no-save',
      alternatives: [],
    }
  }

  const from = selected.key
  if (from !== GUEST_KEY) {
    backup(storage, GUEST_KEY, GUEST_BACKUP_KEY)
    backup(storage, from, `${from}:backup`)
    try {
      const raw = storage.getItem(from)
      if (raw !== null) storage.setItem(GUEST_KEY, raw)
    } catch {
      return { migrated: false, from, reason: 'invalid-save', alternatives }
    }
  }

  const reason: MigrationReason =
    from === GUEST_KEY
      ? 'guest'
      : sessionUserId && from === accountStorageKey(sessionUserId)
        ? 'active-account'
        : 'legacy-account'
  try {
    storage.setItem(
      LOCAL_SYNC_MIGRATION_KEY,
      JSON.stringify({
        from,
        at: (deps.now ?? (() => new Date()))().toISOString(),
        reason,
      }),
    )
  } catch {
    // The save is already promoted; a missing marker only retries on next boot.
  }
  return { migrated: from !== GUEST_KEY, from, reason, alternatives }
}
