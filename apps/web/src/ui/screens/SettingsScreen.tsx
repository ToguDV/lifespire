import { useEffect, useState } from 'react'
import { dayKey } from '../../domain/dates'
import { STORAGE_KEY } from '../../domain/balance'
import { serializeDocument } from '../../domain/schema'
import type { ThemePreference } from '../../domain/types'
import { getNow } from '../../state/clock'
import { useAppStore } from '../../state/store'
import { finishDesktopSignOut, getDesktopSessionState } from '../../sync/api'
import { useAuthStore } from '../../sync/authStore'
import {
  Button,
  Dialog,
  Icon,
  Panel,
  PanelHead,
  SaveImport,
  ScreenHead,
  SyncStatus,
} from '../components'
import { SyncPanel } from '../components/SyncPanel'
import { ServerPanel } from '../components/ServerPanel'
import { AdminPanel } from '../components/AdminPanel'
import { useFeedbackPrefs } from '../lib/feedback'
import { saveFileName } from '../lib/importSave'
import { isDesktopShell } from '../lib/platform'
import type { DesktopSessionPersistence } from '../lib/platform'
import { RESET_CONFIRMATION, isResetConfirmation } from '../lib/reset'

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: 'Day' },
  { value: 'dark', label: 'Night' },
  { value: 'system', label: 'System' },
]

/**
 * safeStorage is memory-only when the OS keychain is unavailable (or Linux
 * falls back to `basic_text`). The session still works until the app closes;
 * say so instead of pretending it was saved.
 */
function DesktopSessionNote() {
  const [persistence, setPersistence] = useState<DesktopSessionPersistence | null>(null)

  useEffect(() => {
    let active = true
    void getDesktopSessionState().then((state) => {
      if (active) setPersistence(state?.persistence ?? null)
    })
    return () => {
      active = false
    }
  }, [])

  if (persistence !== 'memory-only') return null

  return (
    <p className="panel-note" role="note">
      This keychain is not available, so the session stays in memory.
    </p>
  )
}

export function SettingsScreen() {
  const gameDocument = useAppStore((state) => state.document)
  const setTheme = useAppStore((state) => state.setTheme)
  const resetAll = useAppStore((state) => state.resetAll)
  const showToast = useAppStore((state) => state.showToast)
  const [feedback, setFeedback] = useFeedbackPrefs()
  const authStatus = useAuthStore((state) => state.status)
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetPhrase, setResetPhrase] = useState('')
  const [syncOpen, setSyncOpen] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const desktop = isDesktopShell()

  const resetReady = isResetConfirmation(resetPhrase)
  const signedIn = authStatus === 'authenticated' && user !== null

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

  const closeSync = () => {
    setSyncOpen(false)
  }

  const submitSignOut = async (): Promise<void> => {
    setSignOutError(null)
    try {
      await finishDesktopSignOut(logout)
    } catch (error) {
      setSignOutError(
        error instanceof Error ? error.message : 'Could not clear the session on this device.',
      )
    }
  }

  return (
    <section className="screen screen--settings" data-screen="settings" aria-labelledby="settings-title">
      <ScreenHead
        kicker="Profile · Local data"
        title="Settings"
        titleId="settings-title"
        sub="Appearance, sync and local data."
        meta={<SyncStatus />}
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

        <Panel pad>
          <PanelHead label="Sync" />
          {signOutError ? (
            <p className="field-error" role="alert">
              {signOutError}
            </p>
          ) : null}
          {signedIn && user ? (
            <>
              <div className="feedback-row">
                <div className="feedback-row__body">
                  <p className="panel-note">
                    Signed in as <strong>{user.email}</strong>
                  </p>
                </div>
              </div>
              <div className="settings-actions">
                <Button variant="quiet" onClick={() => void submitSignOut()}>
                  Sign out
                </Button>
                <Button variant="secondary" onClick={() => setSyncOpen(true)}>
                  Manage sync
                </Button>
              </div>
            </>
          ) : (
            <div className="feedback-row">
              <span className="chip chip--quiet">Local only</span>
              <Button variant="secondary" onClick={() => setSyncOpen(true)}>
                Set up sync
              </Button>
            </div>
          )}
          {desktop ? <DesktopSessionNote /> : null}
        </Panel>

        <Panel pad>
          <PanelHead label="Data" />
          <p className="panel-note">Your save stays in this browser.</p>
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
      </Dialog>

      <Dialog
        open={syncOpen}
        title="Sync"
        description="Sign in to sync this save between your devices."
        onClose={closeSync}
        footer={
          <Button variant="quiet" onClick={closeSync}>
            Close
          </Button>
        }
      >
        <SyncPanel />
        <details className="settings-details">
          <summary>Server</summary>
          <ServerPanel />
        </details>
        {!desktop && user?.role === 'ADMIN' ? (
          <details className="settings-details">
            <summary>Admin</summary>
            <AdminPanel />
          </details>
        ) : null}
      </Dialog>
    </section>
  )
}

