import { useState } from 'react'
import { getDevOffsetDays } from '../../state/clock'
import { useAppStore } from '../../state/store'
import { Button, Dialog, Icon } from '../components'

type PendingAction = 'demo' | 'restart' | 'reset'

const CONFIRM_COPY: Record<PendingAction, { title: string; description: string; body: string; confirm: string }> = {
  demo: {
    title: 'Start a demo run?',
    description: 'This replaces the current profile, goals and run with fresh demo content.',
    body: 'The clock offset is kept, but any local progress is discarded. This action cannot be undone.',
    confirm: 'Start demo run',
  },
  restart: {
    title: 'Restart the current run?',
    description: 'The run and its days are discarded. The profile, XP, gold and collection stay.',
    body: 'A new seven-day run begins today with the current goals and routines.',
    confirm: 'Restart run',
  },
  reset: {
    title: 'Reset all data?',
    description: 'This removes the profile, goals, routines, run and collection.',
    body: 'The development clock also returns to zero. Export first if you need a copy.',
    confirm: 'Reset everything',
  },
}

export default function DevPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [offset, setOffset] = useState(() => getDevOffsetDays())
  const [pending, setPending] = useState<PendingAction | null>(null)

  const devStartDemoRun = useAppStore((state) => state.devStartDemoRun)
  const devAdvanceDay = useAppStore((state) => state.devAdvanceDay)
  const devRestartRun = useAppStore((state) => state.devRestartRun)
  const devResetAll = useAppStore((state) => state.devResetAll)
  const navigate = useAppStore((state) => state.navigate)

  const close = () => {
    setPending(null)
    onClose()
  }

  const confirm = () => {
    if (!pending) return
    if (pending === 'demo') {
      devStartDemoRun()
      navigate({ name: 'home' })
      close()
      return
    }
    if (pending === 'restart') {
      devRestartRun()
      navigate({ name: 'home' })
      setOffset(getDevOffsetDays())
      close()
      return
    }
    devResetAll()
    setOffset(0)
    close()
  }

  const copy = pending ? CONFIRM_COPY[pending] : null

  return (
    <Dialog
      open={open}
      onClose={close}
      eyebrow="Development only"
      title={copy?.title ?? 'Dev panel'}
      description={
        copy?.description ??
        'Simulate the week without waiting for midnight. These tools exist only in the development build.'
      }
      footer={
        copy ? (
          <>
            <Button variant="quiet" autoFocus onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirm}>
              {copy.confirm}
            </Button>
          </>
        ) : (
          <Button variant="quiet" onClick={close}>
            Close
          </Button>
        )
      }
    >
      {copy ? (
        <p className="panel-note">{copy.body}</p>
      ) : (
        <>
          <div className="dev-offset">
            <span className="dev-offset__icon">
              <Icon name="sun" />
            </span>
            <span>
              <span className="micro">Clock offset</span>
              <strong>{offset === 0 ? 'Today' : `${offset > 0 ? '+' : ''}${offset} day${Math.abs(offset) === 1 ? '' : 's'}`}</strong>
            </span>
          </div>

          <div className="dev-actions">
            <Button variant="secondary" full onClick={() => setPending('demo')}>
              <Icon name="star" />
              Start demo run
            </Button>
            <Button
              variant="secondary"
              full
              onClick={() => {
                devAdvanceDay()
                setOffset(getDevOffsetDays())
              }}
            >
              <Icon name="sun" />
              Advance one day
            </Button>
            <Button variant="secondary" full onClick={() => setPending('restart')}>
              <Icon name="map" />
              Restart run
            </Button>
            <Button variant="danger" full onClick={() => setPending('reset')}>
              <Icon name="flame" />
              Reset all data
            </Button>
          </div>

          <p className="dev-warning">
            <Icon name="lock" />
            <span>
              The offset and these tools are never saved or included in an export. The panel is
              absent from production builds.
            </span>
          </p>
        </>
      )}
    </Dialog>
  )
}
