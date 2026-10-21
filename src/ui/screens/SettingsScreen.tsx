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
  ScreenHead,
} from '../components'

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
  const [confirmReset, setConfirmReset] = useState(false)

  const exportSave = () => {
    const payload = serializeDocument(gameDocument)
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = window.document.createElement('a')
    anchor.href = url
    anchor.download = `lifespire-${dayKey(getNow())}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    showToast('Save exported.')
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
            Export a readable copy of the versioned save. The development clock and this
            panel are never included.
          </p>
          <div className="settings-actions">
            <Button variant="secondary" onClick={exportSave}>
              <Icon name="scroll" />
              Export save
            </Button>
            <Button
              variant="secondary"
              disabled
              title="Import is not available yet."
            >
              Import save
            </Button>
          </div>
          <p className="panel-note settings-note">
            Import will validate the file and ask for confirmation before replacing local
            data. It is not available yet.
          </p>
        </Panel>

        <Panel pad>
          <PanelHead label="Local data" aside={<span className="chip chip--quiet">Careful</span>} />
          <p className="panel-note">
            Everything is stored under <code>{STORAGE_KEY}</code> in this browser. Resetting
            removes the profile, aims, run and collection.
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
          <p className="panel-note settings-note">Schema version {gameDocument.schemaVersion}.</p>
          <Button variant="quiet" onClick={() => navigate({ name: 'home' })}>
            <Icon name="arrow-left" />
            Return to camp
          </Button>
        </Panel>
      </div>

      <Dialog
        open={confirmReset}
        title="Reset local data?"
        description="This removes the profile, aims, routines, run and collection from this browser. Export first if you want a copy."
        onClose={() => setConfirmReset(false)}
        footer={
          <>
            <Button variant="quiet" autoFocus onClick={() => setConfirmReset(false)}>
              Keep my data
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmReset(false)
                resetAll()
              }}
            >
              Reset everything
            </Button>
          </>
        }
      >
        <p className="panel-note">
          This cannot be undone without an earlier export. The app returns to onboarding
          afterwards.
        </p>
      </Dialog>
    </section>
  )
}
