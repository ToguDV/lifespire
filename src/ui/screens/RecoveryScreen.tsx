import { useState } from 'react'
import { useAppStore } from '../../state/store'
import {
  Button,
  Dialog,
  Icon,
  Panel,
  ScreenHead,
  ThemeToggle,
} from '../components'

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
  const [confirmReset, setConfirmReset] = useState(false)
  const copy = REASON_COPY[reason] ?? REASON_COPY.corrupt

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
            Reset local data removes the blocked save and returns to onboarding. Import a
            valid JSON export to recover a profile instead; import is not available yet.
          </p>
          <div className="settings-actions">
            <Button variant="danger" onClick={() => setConfirmReset(true)}>
              Reset local data
            </Button>
            <Button variant="secondary" disabled title="Import is not available yet.">
              Import save
            </Button>
          </div>
          <p className="panel-note settings-note">
            If you have an export from another device or an earlier version, keep it. The
            import flow will validate it before replacing anything.
          </p>
        </Panel>
      </div>

      <Dialog
        open={confirmReset}
        title="Reset local data?"
        description="The blocked save is removed and LifeSpire returns to onboarding."
        onClose={() => setConfirmReset(false)}
        footer={
          <>
            <Button variant="quiet" autoFocus onClick={() => setConfirmReset(false)}>
              Keep the save
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
          This cannot be undone. Export or copy the original local document first if you may
          need it later.
        </p>
      </Dialog>
    </section>
  )
}
