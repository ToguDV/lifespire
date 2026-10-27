import {
  createDocumentStorage,
  getDefaultStorage,
} from '@lifespire/app-core/state/persistence'
import { migrateLegacySave } from '@lifespire/app-core/sync/migration'
import { listLegacyAccountKeys } from '@lifespire/app-core/sync/storageKeys'

export * from '@lifespire/app-core/state/persistence'

function hasBrowserStorage(): boolean {
  try {
    return typeof window !== 'undefined' && Boolean(window.localStorage)
  } catch {
    return false
  }
}

/**
 * Runs before the store hydrates: the single local save is promoted from the
 * active legacy account (or the guest save) so removing accounts never loses
 * local progress. The old keys stay on disk as backups.
 */
export const localSyncMigration = migrateLegacySave({
  storage: getDefaultStorage(),
  listKeys: listLegacyAccountKeys,
})

/** Shared browser persistence, created after the legacy migration. */
export const documentStorage = createDocumentStorage(getDefaultStorage(), {
  persistent: hasBrowserStorage(),
})
