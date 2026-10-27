import { useSyncStore } from '../../sync/setup'

export function SyncStatus({ compact = false }: { compact?: boolean }) {
  const available = useSyncStore((state) => state.available)
  const phase = useSyncStore((state) => state.phase)
  const peers = useSyncStore((state) => state.peers)
  const nearby = useSyncStore((state) => state.nearby)
  const conflicts = useSyncStore((state) => state.conflicts)
  const lastError = useSyncStore((state) => state.lastError)

  const peerList = Object.values(peers)
  const status = conflicts.length
    ? 'conflict'
    : lastError
      ? 'error'
      : phase === 'syncing'
        ? 'pushing'
        : !available || phase === 'off'
          ? 'disabled'
          : peerList.length === 0
            ? 'offline'
            : 'synced'
  const label = conflicts.length
    ? 'Needs review'
    : lastError
      ? 'Sync error'
      : phase === 'syncing'
        ? 'Syncing…'
        : !available
          ? 'Local only'
          : phase === 'off'
            ? 'Sync off'
            : peerList.length === 0
              ? 'No devices'
              : nearby.length > 0
                ? 'Nearby'
                : 'Nearby sync'

  return (
    <span
      className={`sync-status sync-status--${status}`}
      role="status"
      aria-live="polite"
      title={lastError ?? label}
    >
      <span className="sync-status__dot" aria-hidden="true" />
      {compact ? null : <span>{label}</span>}
    </span>
  )
}
