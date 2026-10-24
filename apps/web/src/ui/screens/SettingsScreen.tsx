import { useState } from 'react'
import { dayKey } from '../../domain/dates'
import { STORAGE_KEY } from '../../domain/balance'
import { serializeDocument } from '../../domain/schema'
import type { ThemePreference } from '../../domain/types'
import { getNow } from '../../state/clock'
import { useAppStore } from '../../state/store'
import {
  Button,
  Dialog,
  Icon,
  Panel,
  PanelHead,
  SaveImport,
  ScreenHead,
} from '../components'
import { useFeedbackPrefs } from '../lib/feedback'
import { saveFileName } from '../lib/importSave'
import { RESET_CONFIRMATION, isResetConfirmation } from '../lib/reset'

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: 'Day' },
  { value: 'dark', label: 'Night' },
  { value: 'system', label: 'System' },
]

export function SettingsScreen() {
  const gameDocument = useAppStore((state) => state.document)
  const setTheme = useAppStore((state) => state.setTheme)
  const resetAll = useAppStore((state) => state.resetAll)
  const showToast = useAppStore((state) => state.showToast)
  const navigate = useAppStore((state) => state.navigate)
  const [feedback, setFeedback] = useFeedbackPrefs()
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
    showToast('Save exported. It includes your profile, goals, routines, run and collection.')
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
          <PanelHead label="Feedback" aside={<span className="chip chip--quiet">Calm</span>} />
          <div className="feedback-row">
            <div className="feedback-row__body">
              <strong>Sound</strong>
              <span>Soft chimes for steps, loot and seals. Never loops.</span>
            </div>
            <button
              type="button"
              className="feedback-switch"
              role="switch"
              aria-checked={feedback.sound}
              aria-label="Sound"
              onClick={() => setFeedback({ sound: !feedback.sound })}
            >
              <span className="feedback-switch__track" aria-hidden="true">
                <span className="feedback-switch__thumb" />
              </span>
              {feedback.sound ? 'On' : 'Off'}
            </button>
          </div>
          <div className="feedback-row">
            <div className="feedback-row__body">
              <strong>Vibration</strong>
              <span>Short taps on mobile only. Desktop never buzzes.</span>
            </div>
            <button
              type="button"
              className="feedback-switch"
              role="switch"
              aria-checked={feedback.haptics}
              aria-label="Vibration"
              onClick={() => setFeedback({ haptics: !feedback.haptics })}
            >
              <span className="feedback-switch__track" aria-hidden="true">
                <span className="feedback-switch__thumb" />
              </span>
              {feedback.haptics ? 'On' : 'Off'}
            </button>
          </div>
          <p className="panel-note">
            Both default to on and respect reduced motion for animation. Sound and
            vibration stay subtle by design; either can be silenced here.
          </p>
        </Panel>

        <Panel pad>
          <PanelHead label="Data" aside={<span className="chip chip--quiet">JSON</span>} />
          <p className="panel-note">
            Export a readable copy of the versioned save. It includes the profile, goals,
            routines, the current run and the collection. The development clock and this panel
            are never included.
          </p>
          <div className="settings-actions">
            <Button variant="secondary" onClick={exportSave}>
              <Icon name="scroll" />
              Export save
            </Button>
            <SaveImport />
          </div>
          <p className="panel-note settings-note">
            Import validates the file and shows a summary before replacing anything. Invalid,
            corrupt or newer-version files are rejected and your current save stays untouched.
          </p>
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
            removes the profile, goals, routines, run and collection. Exporting first is the only
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
        open={confirmReset}
        title="Reset local data?"
        description="This removes the profile, goals, routines, run and collection from this browser."
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

