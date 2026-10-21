import { useId, useState } from 'react'
import { STORAGE_KEY } from '../../domain/balance'
import type { GameDocument } from '../../domain/types'
import { useAppStore } from '../../state/store'
import { readSaveFile, runPreviewLabel } from '../lib/importSave'
import type { ImportSummary } from '../lib/importSave'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { Icon } from './Icon'

interface PendingImport {
  fileName: string
  document: GameDocument
  summary: ImportSummary
}

export interface SaveImportProps {
  label?: string
  inputLabel?: string
}

/**
 * File picker + validation preview + confirmation for a local JSON save.
 * Shared by Settings and Recovery so both paths parse with the same schema,
 * show the same summary and replace state only after explicit confirmation.
 */
export function SaveImport({
  label = 'Import save',
  inputLabel = 'Import a LifeSpire save file',
}: SaveImportProps) {
  const importDocument = useAppStore((state) => state.importDocument)
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const inputId = useId()

  const readImportFile = async (file: File) => {
    setImportError(null)
    let text: string
    try {
      text = await file.text()
    } catch {
      setPendingImport(null)
      setImportError('That file could not be read. Try exporting a fresh copy and selecting it again.')
      return
    }

    const result = readSaveFile(text)
    if (!result.ok) {
      setPendingImport(null)
      setImportError(result.message)
      return
    }

    setPendingImport({
      fileName: file.name,
      document: result.document,
      summary: result.summary,
    })
  }

  const cancelImport = () => {
    setPendingImport(null)
  }

  const confirmImport = () => {
    if (!pendingImport) return
    const restored = importDocument(pendingImport.document)
    setPendingImport(null)
    if (!restored) {
      setImportError('That save could not be restored. Your current data was left untouched.')
    }
  }

  return (
    <>
      <label className="btn btn--secondary settings-file" htmlFor={inputId}>
        <Icon name="scroll" />
        {label}
        <input
          id={inputId}
          type="file"
          accept=".json,application/json"
          aria-label={inputLabel}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void readImportFile(file)
          }}
        />
      </label>

      {importError ? (
        <p className="settings-error" role="alert">
          <Icon name="lock" />
          <span>{importError}</span>
        </p>
      ) : null}

      <Dialog
        open={pendingImport !== null}
        title="Restore this save?"
        description="Review what the file contains before it replaces the data in this browser."
        eyebrow="Local import"
        onClose={cancelImport}
        footer={
          <>
            <Button variant="quiet" onClick={cancelImport}>
              Keep current data
            </Button>
            <Button variant="primary" onClick={confirmImport}>
              Replace local data
            </Button>
          </>
        }
      >
        {pendingImport ? (
          <>
            <dl className="import-preview">
              <div>
                <dt>Profile</dt>
                <dd>{pendingImport.summary.profileName ?? 'No profile'}</dd>
              </div>
              <div>
                <dt>Level</dt>
                <dd>{pendingImport.summary.level ?? '—'}</dd>
              </div>
              <div>
                <dt>Gold</dt>
                <dd>{pendingImport.summary.gold ?? '—'}</dd>
              </div>
              <div>
                <dt>Run</dt>
                <dd>{runPreviewLabel(pendingImport.summary)}</dd>
              </div>
              <div>
                <dt>Relics</dt>
                <dd>{pendingImport.summary.relics} of 12</dd>
              </div>
              <div>
                <dt>Schema</dt>
                <dd>v{pendingImport.summary.schemaVersion}</dd>
              </div>
            </dl>
            <p className="import-warning">
              <Icon name="lock" />
              <span>
                Replacing overwrites the profile, aims, routines, run and collection currently
                under <code>{STORAGE_KEY}</code>. File: <strong>{pendingImport.fileName}</strong>.
              </span>
            </p>
          </>
        ) : null}
      </Dialog>
    </>
  )
}
