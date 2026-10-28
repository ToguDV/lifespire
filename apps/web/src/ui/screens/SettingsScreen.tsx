import { useState } from 'react'
import { dayKey } from '../../domain/dates'
import { STORAGE_KEY } from '../../domain/balance'
import { serializeDocument } from '../../domain/schema'
import type { ThemePreference } from '../../domain/types'
import { getNow } from '../../state/clock'
import { useAppStore } from '../../state/store'
import { localSync, useSyncStore } from '../../sync/setup'
import {
  Button,
  DevicesPanel,
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
  const peers = useSyncStore((state) => state.peers)
  const [feedback, setFeedback] = useFeedbackPrefs()
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetPhrase, setResetPhrase] = useState('')
  const [resetUnpair, setResetUnpair] = useState(false)

  const peerIds = Object.keys(peers)
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
    showToast('Save exported. It includes your profile, goals, trials, run and collection.')
  }

  const closeReset = () => {
    setConfirmReset(false)
    setResetPhrase('')
    setResetUnpair(false)
  }

  const confirmResetNow = () => {
    if (!resetReady) return
    closeReset()
    if (resetUnpair) {
      void Promise.all(peerIds.map((peerId) => localSync.forget(peerId))).finally(() => {
        resetAll()
      })
      return
    }
    resetAll()
  }

  return (
    <section className="screen screen--settings" data-screen="settings" aria-labelledby="settings-title">
      <ScreenHead
        kicker="Profile · Local data"
        title="Settings"
        titleId="settings-title"
        sub="Appearance, nearby sync and local data."
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
          </div>
          <div className="feedback-row">
            <div className="feedback-row__body">
              <strong>Sound</strong>
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
          <p className="panel-note">Sound and vibration are subtle by default.</p>
        </Panel>

        <DevicesPanel />

        <Panel pad>
          <PanelHead label="Data" />
          <p className="panel-note">Your save stays on this device. Export it for a backup.</p>
          <div className="settings-actions">
            <Button variant="secondary" onClick={exportSave}>
              <Icon name="scroll" />
              Export save
            </Button>
            <SaveImport />
            <Button variant="danger" onClick={() => setConfirmReset(true)}>
              Reset local data
            </Button>
          </div>
          <details className="settings-details">
            <summary>Save details</summary>
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
          </details>
        </Panel>
      </div>

      <Dialog
        open={confirmReset}
        title="Reset local data?"
        description="This removes the profile, goals, trials, run and collection from this device."
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
            onChange={(event) => setResetPhrase(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && resetReady) {
                event.preventDefault()
                confirmResetNow()
              }
            }}
          />
        </div>
        {peerIds.length > 0 ? (
          <div className="reset-confirmation">
            <label className="field__label" htmlFor="reset-unpair">
              <input
                id="reset-unpair"
                type="checkbox"
                checked={resetUnpair}
                onChange={(event) => setResetUnpair(event.target.checked)}
              />{' '}
              Reset this device only (forget paired devices first)
            </label>
            <p className="field-hint">
              {resetUnpair
                ? 'Your paired devices keep their own saves; nothing is sent to them.'
                : 'The reset will sync to paired devices the next time they connect.'}
            </p>
          </div>
        ) : null}
      </Dialog>
    </section>
  )
}
