import { useSyncStore } from '../../sync/setup'
import type { SyncStatus as EngineStatus } from '../../sync/syncEngine'

const LABEL: Record<EngineStatus, string> = {
  disabled: 'Local only',
  synced: 'Synced',
  dirty: 'Saving…',
  pushing: 'Saving…',
  pulling: 'Checking…',
  offline: 'Offline',
  conflict: 'Needs review',
  error: 'Sync error',
  paused: 'Paused (dev clock)',
}

export function SyncStatus({ compact = false }: { compact?: boolean }) {
  const status = useSyncStore((state) => state.status)
  const lastError = useSyncStore((state) => state.lastError)

  return (
    <span
      className={`sync-status sync-status--${status}`}
      role="status"
      aria-live="polite"
      title={lastError ?? LABEL[status]}
    >
      <span className="sync-status__dot" aria-hidden="true" />
      {compact ? null : <span>{LABEL[status]}</span>}
    </span>
  )
}
