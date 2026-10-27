/**
 * Errors shared by the local (LAN) sync engine and the platform transports.
 *
 * The old cloud client had its own error classes in `@lifespire/api-client`.
 * Local sync keeps the same conflict shape so the conservative 3-way merge and
 * the conflict dialog could be ported without changing their semantics.
 */

export class SyncConflictError extends Error {
  readonly currentVersion: string
  readonly currentUpdatedAt: string

  constructor(currentVersion: string, currentUpdatedAt: string) {
    super('SYNC_VERSION_CONFLICT')
    this.name = 'SyncConflictError'
    this.currentVersion = currentVersion
    this.currentUpdatedAt = currentUpdatedAt
  }
}

/** A transport-level failure with an HTTP-like status when one exists. */
export class LocalSyncError extends Error {
  readonly status: number | null
  readonly code: string | null

  constructor(message: string, options: { status?: number; code?: string } = {}) {
    super(message)
    this.name = 'LocalSyncError'
    this.status = options.status ?? null
    this.code = options.code ?? null
  }
}
