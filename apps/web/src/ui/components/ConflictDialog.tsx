import { useEffect, useState } from 'react'
import { toUserSyncError } from '@lifespire/app-core/sync/errors'
import type { GameDocument } from '../../domain/types'
import { summarizeDocument } from '../lib/importSave'
import { dayKey } from '../../domain/dates'
import { serializeDocument } from '../../domain/schema'
import { getNow } from '../../state/clock'
import { documentStorage } from '../../state/persistence'
import { useSyncStore, localSync } from '../../sync/setup'
import { Button, Dialog } from './index'

function formatWhen(iso: string | null): string {
  if (!iso) return 'unknown time'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function download(document: GameDocument, filename: string): void {
  const payload = serializeDocument(document)
  const blob = new Blob([payload], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = filename
  window.document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function ConflictCopy({
  title,
  document,
  updatedAt,
}: {
  title: string
  document: GameDocument
  updatedAt: string | null
}) {
  const summary = summarizeDocument(document)
  return (
    <div className="conflict-side">
      <h3>{title}</h3>
      <dl className="conflict-meta">
        <div>
          <dt>Wayfarer</dt>
          <dd>{summary.profileName ?? 'No wayfarer'}</dd>
        </div>
        <div>
          <dt>Progress</dt>
          <dd>
            {summary.gold ?? 0} gold · rank {summary.level ?? 1} · {summary.goals} quests
          </dd>
        </div>
        <div>
          <dt>Journey</dt>
          <dd>{summary.runStatus ? `${summary.runStatus} · day ${summary.runDay ?? '—'}` : 'No journey'}</dd>
        </div>
        <div>
          <dt>Saved</dt>
          <dd>{formatWhen(updatedAt)}</dd>
        </div>
      </dl>
    </div>
  )
}

export function ConflictDialog() {
  const conflicts = useSyncStore((state) => state.conflicts)
  const active = conflicts[0]
  const [busy, setBusy] = useState<'mine' | 'peer' | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const activePeerId = active?.peerId ?? null

  useEffect(() => {
    setResolveError(null)
    setBusy(null)
  }, [activePeerId])

  if (!active) return null
  const { conflict, peerId, peerName } = active

  const closeWithoutResolving = (): void => {
    localSync.discardConflict(peerId)
  }

  const keepMine = async (): Promise<void> => {
    setBusy('mine')
    setResolveError(null)
    try {
      documentStorage.backup()
      await localSync.resolveKeepMine(peerId)
      const next = useSyncStore.getState()
      if (next.conflicts.some((entry) => entry.peerId === peerId)) {
        setResolveError(
          toUserSyncError(
            next.peers[peerId]?.lastError ?? next.lastError,
            'This device copy could not be sent. Try again.',
          ),
        )
      }
    } catch (error) {
      setResolveError(
        toUserSyncError(error, 'This device copy could not be sent. Try again.'),
      )
    } finally {
      setBusy(null)
    }
  }

  const keepPeer = (): void => {
    setBusy('peer')
    setResolveError(null)
    try {
      documentStorage.backup()
      localSync.resolveKeepPeer(peerId)
      const next = useSyncStore.getState()
      if (next.conflicts.some((entry) => entry.peerId === peerId)) {
        setResolveError('The other copy could not be applied. Your device copy is still safe.')
      }
    } catch (error) {
      setResolveError(toUserSyncError(error, 'The other copy could not be applied.'))
    } finally {
      setBusy(null)
    }
  }

  const exportBoth = (): void => {
    documentStorage.backup()
    const stamp = dayKey(getNow())
    try {
      download(conflict.local, `lifespire-this-device-${stamp}.json`)
    } catch {
      // Best-effort; the other copy is still available.
    }
    download(conflict.remote, `lifespire-${peerName.replace(/\s+/g, '-')}-${stamp}.json`)
  }

  return (
    <Dialog
      open
      title="Sync conflict"
      eyebrow={`This device · ${peerName}`}
      description={`This device and ${peerName} changed the same things in different ways, so pick which copy keeps going. Small independent edits merge on their own; these did not. Both copies are kept safe first.`}
      onClose={closeWithoutResolving}
      footer={
        <>
          <Button variant="quiet" onClick={exportBoth}>
            Export both
          </Button>
          <Button variant="secondary" onClick={keepPeer} disabled={busy !== null}>
            {busy === 'peer' ? 'Keeping…' : `Keep ${peerName}`}
          </Button>
          <Button variant="primary" onClick={() => void keepMine()} disabled={busy !== null}>
            {busy === 'mine' ? 'Keeping…' : 'Keep this device'}
          </Button>
        </>
      }
    >
      <div className="conflict-grid">
        <ConflictCopy title="This device" document={conflict.local} updatedAt={null} />
        <ConflictCopy title={peerName} document={conflict.remote} updatedAt={conflict.remoteUpdatedAt} />
      </div>
      {resolveError ? (
        <p className="field-error" role="alert">
          {resolveError}
        </p>
      ) : null}
      {conflict.conflicts.length > 0 ? (
        <ul className="panel-note conflict-reasons">
          {conflict.conflicts.slice(0, 5).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
      <p className="panel-note">
        Keep this device sends it to {peerName}. Keep {peerName} replaces this device (a backup is
        saved first). Export both downloads each copy before you decide.
      </p>
    </Dialog>
  )
}
