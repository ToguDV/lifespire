import { useState } from 'react'
import type { GameDocument } from '../../domain/types'
import { summarizeDocument } from '../lib/importSave'
import { dayKey } from '../../domain/dates'
import { serializeDocument } from '../../domain/schema'
import { getNow } from '../../state/clock'
import { documentStorage } from '../../state/persistence'
import { useSyncStore, syncEngine } from '../../sync/setup'
import { Button, Dialog } from './index'

function formatWhen(iso: string | null): string {
  if (!iso) return 'unknown time'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function downloadRemote(document: GameDocument, filename: string): void {
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

function ConflictCopy({ title, document, updatedAt }: { title: string; document: GameDocument; updatedAt: string | null }) {
  const summary = summarizeDocument(document)
  return (
    <div className="conflict-side">
      <h3>{title}</h3>
      <dl className="conflict-meta">
        <div>
          <dt>Profile</dt>
          <dd>{summary.profileName ?? 'No profile'}</dd>
        </div>
        <div>
          <dt>Progress</dt>
          <dd>
            {summary.gold ?? 0} gold · level {summary.level ?? 1} · {summary.goals} goals
          </dd>
        </div>
        <div>
          <dt>Run</dt>
          <dd>{summary.runStatus ? `${summary.runStatus} · day ${summary.runDay ?? '—'}` : 'No run'}</dd>
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
  const conflict = useSyncStore((state) => state.conflict)
  const [busy, setBusy] = useState<'mine' | 'cloud' | null>(null)

  if (!conflict) return null

  const closeWithoutResolving = (): void => {
    syncEngine.discardConflict()
  }

  const keepMine = async (): Promise<void> => {
    setBusy('mine')
    try {
      documentStorage.backup()
      await syncEngine.resolveKeepMine()
    } finally {
      setBusy(null)
    }
  }

  const keepCloud = (): void => {
    setBusy('cloud')
    try {
      documentStorage.backup()
      syncEngine.resolveKeepCloud()
    } finally {
      setBusy(null)
    }
  }

  const exportBoth = (): void => {
    documentStorage.backup()
    const stamp = dayKey(getNow())
    try {
      const payload = serializeDocument(conflict.local)
      const blob = new Blob([payload], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = `lifespire-this-device-${stamp}.json`
      window.document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch {
      // Best-effort; the cloud copy remains untouched.
    }
    downloadRemote(conflict.remote, `lifespire-cloud-${stamp}.json`)
  }

  return (
    <Dialog
      open
      title="Sync conflict"
      eyebrow="Two versions"
      description="This device and the cloud disagree. Nothing merges automatically, so pick which copy keeps going. Both are kept safe first."
      onClose={closeWithoutResolving}
      footer={
        <>
          <Button variant="quiet" onClick={exportBoth}>
            Export both
          </Button>
          <Button variant="secondary" onClick={keepCloud} disabled={busy !== null}>
            {busy === 'cloud' ? 'Keeping…' : 'Keep cloud'}
          </Button>
          <Button variant="primary" onClick={keepMine} disabled={busy !== null}>
            {busy === 'mine' ? 'Keeping…' : 'Keep this device'}
          </Button>
        </>
      }
    >
      <div className="conflict-grid">
        <ConflictCopy title="This device" document={conflict.local} updatedAt={null} />
        <ConflictCopy title="Cloud" document={conflict.remote} updatedAt={conflict.remoteUpdatedAt} />
      </div>
      <p className="panel-note">
        Keep this device uploads it over the cloud version. Keep cloud replaces this device
        (a backup is saved first). Export both downloads each copy before you decide.
      </p>
    </Dialog>
  )
}
