import { useState } from 'react'
import { dayKey } from '../../domain/dates'
import { getNow } from '../../state/clock'
import { useAppStore } from '../../state/store'
import {
  Button,
  Dialog,
  Icon,
  Panel,
  SaveImport,
  ScreenHead,
  ThemeToggle,
} from '../components'
import { RESET_CONFIRMATION, isResetConfirmation } from '../lib/reset'

const REASON_COPY: Record<string, { title: string; copy: string }> = {
  corrupt: {
    title: 'The local save is incomplete or damaged.',
    copy: 'LifeSpire could not read the document stored in this browser. It has left the original save untouched instead of replacing it.',
  },
  'future-version': {
    title: 'This save comes from a newer LifeSpire.',
    copy: 'The stored document uses a schema version this build does not understand. It has been left untouched so a newer version can still open it.',
  },
  'import-error': {
    title: 'That save could not be imported.',
    copy: 'The selected file did not pass validation. Your current local document was not changed.',
  },
}

export function RecoveryScreen({ reason }: { reason: string }) {
  const resetAll = useAppStore((state) => state.resetAll)
  const exportRawSave = useAppStore((state) => state.exportRawSave)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetPhrase, setResetPhrase] = useState('')
  const [exportError, setExportError] = useState<string | null>(null)
  const copy = REASON_COPY[reason] ?? REASON_COPY.corrupt
  const resetReady = isResetConfirmation(resetPhrase)

  const downloadOriginalSave = () => {
    const raw = exportRawSave()
    if (raw === null) {
      setExportError(
        'No original save is stored in this browser, so there is nothing to download.',
      )
      return
    }

    try {
      const blob = new Blob([raw], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = `lifespire-recovery-${dayKey(getNow())}.json`
      window.document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      setExportError(null)
    } catch {
      setExportError('The original save could not be downloaded from this browser.')
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
    <section className="screen screen--recovery" data-screen="recovery" aria-labelledby="recovery-title">
      <div className="welcome-top">
        <span className="brand" aria-label="LifeSpire">
          <Icon name="spire" className="brand__mark" />
          <span className="brand__word">LifeSpire</span>
        </span>
        <ThemeToggle />
      </div>

      <div className="recovery-grid">
        <ScreenHead
          kicker="Local save"
          title={copy.title}
          titleId="recovery-title"
          sub={copy.copy}
        />

        <Panel pad>
          <div className="warning-note">
            <Icon name="lock" />
            <span>
              Nothing has been overwritten. The blocked document stays in storage until you
              reset it or restore a valid save.
            </span>
          </div>
          <p className="panel-note">
            Import a valid JSON export to recover without resetting first. LifeSpire validates
            the file, shows a summary and only replaces the blocked document after you confirm.
            A successful import also unlocks saving again.
          </p>
          <div className="settings-actions">
            <SaveImport label="Import save" inputLabel="Import a LifeSpire save file to recover" />
            <Button variant="secondary" onClick={downloadOriginalSave}>
              Download original save
            </Button>
            <Button variant="danger" onClick={() => setConfirmReset(true)}>
              Reset local data
            </Button>
          </div>
          {exportError ? (
            <p className="settings-error" role="alert">
              <Icon name="lock" />
              <span>{exportError}</span>
            </p>
          ) : null}
          <p className="panel-note settings-note">
            Resetting removes the blocked save and returns to onboarding. Download the original
            save first if you may need it later.
          </p>
        </Panel>
      </div>

      <Dialog
        open={confirmReset}
        title="Reset local data?"
        description="The blocked save is removed and LifeSpire returns to onboarding."
        onClose={closeReset}
        footer={
          <>
            <Button variant="quiet" onClick={closeReset}>
              Keep the save
            </Button>
            <Button variant="danger" disabled={!resetReady} onClick={confirmResetNow}>
              Reset everything
            </Button>
          </>
        }
      >
        <p className="panel-note">
          This cannot be undone. Export or copy the original local document first if you may
          need it later.
        </p>
        <div className="reset-confirmation">
          <label className="field__label" htmlFor="recovery-reset-confirmation">
            Type {RESET_CONFIRMATION} to confirm
          </label>
          <input
            id="recovery-reset-confirmation"
            className="input"
            type="text"
            value={resetPhrase}
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder={RESET_CONFIRMATION}
            aria-describedby="recovery-reset-hint"
            onChange={(event) => setResetPhrase(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && resetReady) {
                event.preventDefault()
                confirmResetNow()
              }
            }}
          />
          <p className="panel-note" id="recovery-reset-hint">
            The reset button stays disabled until the word is typed exactly.
          </p>
        </div>
      </Dialog>
    </section>
  )
}
