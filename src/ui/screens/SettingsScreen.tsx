import { useState } from 'react'
import { dayKey } from '../../domain/dates'
import { STORAGE_KEY } from '../../domain/balance'
import { serializeDocument } from '../../domain/schema'
import type { GameDocument, ThemePreference } from '../../domain/types'
import { getNow } from '../../state/clock'
import { useAppStore } from '../../state/store'
import {
  Button,
  Dialog,
  Icon,
  Panel,
  PanelHead,
  ScreenHead,
} from '../components'
import {
  readSaveFile,
  runPreviewLabel,
  saveFileName,
  type ImportSummary,
} from '../lib/importSave'
import { RESET_CONFIRMATION, isResetConfirmation } from '../lib/reset'

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: 'Day' },
  { value: 'dark', label: 'Night' },
  { value: 'system', label: 'System' },
]

interface PendingImport {
  fileName: string
  document: GameDocument
  summary: ImportSummary
}

export function SettingsScreen() {
  const gameDocument = useAppStore((state) => state.document)
  const setTheme = useAppStore((state) => state.setTheme)
  const importDocument = useAppStore((state) => state.importDocument)
  const resetAll = useAppStore((state) => state.resetAll)
  const showToast = useAppStore((state) => state.showToast)
  const navigate = useAppStore((state) => state.navigate)
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetPhrase, setResetPhrase] = useState('')

  const resetReady = isResetConfirmation(resetPhrase)

  const exportSave = () => {
    const payload = serializeDocument(gameDocument)
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = window.document.createElement('a')
    anchor.href = url
    anchor.download = saveFileName(dayKey(getNow()))
    window.document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    showToast('Save exported. It includes your profile, aims, routines, run and collection.')
  }

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

  const closeReset = () => {
    setConfirmReset(false)
    setResetPhrase('')
  }

  const confirmResetNow = () => {
    if (!resetReady) return
    closeReset()
    resetAll()
  }

  return (
    <section className="screen screen--settings" data-screen="settings" aria-labelledby="settings-title">
      <ScreenHead
        kicker="Profile · Local data"
        title="Settings"
        titleId="settings-title"
        sub="Appearance and the one save file this browser keeps. No account, no cloud."
        meta={<span className="chip chip--quiet">Local only</span>}
      />

      <div className="settings-body">
        <Panel pad>
          <PanelHead label="Appearance" />
          <div className="field">
            <span className="field__label" id="theme-label">
              Theme
            </span>
            <div className="segmented segmented--wide" role="group" aria-labelledby="theme-label">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={gameDocument.settings.theme === option.value}
                  onClick={() => setTheme(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="panel-note">
              System follows your device preference. Day and Night stay fixed until you change
              them.
            </p>
          </div>
        </Panel>

        <Panel pad>
          <PanelHead label="Data" aside={<span className="chip chip--quiet">JSON</span>} />
          <p className="panel-note">
            Export a readable copy of the versioned save. It includes the profile, aims,
            routines, the current run and the collection. The development clock and this panel
            are never included.
          </p>
          <div className="settings-actions">
            <Button variant="secondary" onClick={exportSave}>
              <Icon name="scroll" />
              Export save
            </Button>
            <label className="btn btn--secondary settings-file">
              <Icon name="scroll" />
              Import save
              <input
                type="file"
                accept=".json,application/json"
                aria-label="Import a LifeSpire save file"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) void readImportFile(file)
                }}
              />
            </label>
          </div>
          <p className="panel-note settings-note">
            Import validates the file and shows a summary before replacing anything. Invalid,
            corrupt or newer-version files are rejected and your current save stays untouched.
          </p>
          {importError ? (
            <p className="settings-error" role="alert">
              <Icon name="lock" />
              <span>{importError}</span>
            </p>
          ) : null}
          <dl className="settings-meta">
            <div>
              <dt>Storage key</dt>
              <dd>
                <code>{STORAGE_KEY}</code>
              </dd>
            </div>
            <div>
              <dt>Schema version</dt>
              <dd>v{gameDocument.schemaVersion}</dd>
            </div>
          </dl>
        </Panel>

        <Panel pad>
          <PanelHead label="Local data" aside={<span className="chip chip--quiet">Careful</span>} />
          <p className="panel-note">
            Everything is stored under <code>{STORAGE_KEY}</code> in this browser. Resetting
            removes the profile, aims, routines, run and collection. Exporting first is the only
            safety net; a reset cannot be undone without that file.
          </p>
          <div className="settings-actions">
            <Button variant="danger" onClick={() => setConfirmReset(true)}>
              Reset local data
            </Button>
          </div>
        </Panel>

        <Panel pad>
          <PanelHead label="About" />
          <p className="panel-note">
            LifeSpire is a local-first seven-day run. Progress is kept in this browser and can
            be exported above. A new run keeps your profile, level and collection.
          </p>
          <Button variant="quiet" onClick={() => navigate({ name: 'home' })}>
            <Icon name="arrow-left" />
            Return to camp
          </Button>
        </Panel>
      </div>

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
                <dd>
                  {pendingImport.summary.relics} of 12
                </dd>
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

      <Dialog
        open={confirmReset}
        title="Reset local data?"
        description="This removes the profile, aims, routines, run and collection from this browser."
        onClose={closeReset}
        footer={
          <>
            <Button variant="quiet" onClick={closeReset}>
              Keep my data
            </Button>
            <Button variant="danger" disabled={!resetReady} onClick={confirmResetNow}>
              Reset everything
            </Button>
          </>
        }
      >
        <p className="panel-note">
          This cannot be undone without an earlier export. Exporting in Data above is the safety
          net. The app returns to onboarding afterwards; once a local profile exists again,
          Settings → Import save can restore that export.
        </p>
        <div className="reset-confirmation">
          <label className="field__label" htmlFor="reset-confirmation">
            Type {RESET_CONFIRMATION} to confirm
          </label>
          <input
            id="reset-confirmation"
            className="input"
            type="text"
            value={resetPhrase}
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder={RESET_CONFIRMATION}
            aria-describedby="reset-confirmation-hint"
            onChange={(event) => setResetPhrase(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && resetReady) {
                event.preventDefault()
                confirmResetNow()
              }
            }}
          />
          <p className="panel-note" id="reset-confirmation-hint">
            The reset button stays disabled until the word is typed exactly.
          </p>
        </div>
      </Dialog>
    </section>
  )
}

