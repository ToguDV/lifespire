import { useId, useState } from 'react'
import { MAX_WEEKLY_OBJECTIVE, MIN_WEEKLY_OBJECTIVE } from '../../domain/balance'
import { useAppStore } from '../../state/store'
import { Button, Dialog, Icon } from '../components'
import { initialWeeklyTargets, validateNewRunSetup } from '../lib/newRun'
import type { WeeklyTargets } from '../lib/newRun'
import { goalIcon } from '../lib/format'

export interface NewRunDialogProps {
  onClose: () => void
}

/**
 * Confirmation and weekly-target review for the run transition. The dialog is
 * intentionally local: it only stages inputs and hands the reviewed goals to
 * `startNewRun`, which writes goals and run in a single atomic update.
 */
export function NewRunDialog({ onClose }: NewRunDialogProps) {
  const document = useAppStore((state) => state.document)
  const startNewRun = useAppStore((state) => state.startNewRun)
  const profile = document.profile
  const [targets, setTargets] = useState<WeeklyTargets>(() =>
    initialWeeklyTargets(document.goals),
  )
  const [showErrors, setShowErrors] = useState(false)
  const [transitionError, setTransitionError] = useState<string | null>(null)
  const formId = useId()

  const validation = validateNewRunSetup(document.goals, document.tasks, targets)
  const activeGoalIds = new Set(validation.activeGoals.map((goal) => goal.id))
  const activeTasks = document.tasks.filter(
    (task) => task.active && activeGoalIds.has(task.goalId),
  )

  const updateTarget = (goalId: string, value: string) => {
    setTargets((current) => ({ ...current, [goalId]: value }))
    setTransitionError(null)
  }

  const submit = () => {
    setShowErrors(true)
    setTransitionError(null)
    if (!validation.ok) return

    const started = startNewRun(undefined, validation.goals)
    if (!started) {
      setTransitionError(
        useAppStore.getState().toast ?? 'A new run cannot begin yet.',
      )
      return
    }
    onClose()
  }

  const errors = [
    ...(showErrors ? validation.errors : []),
    ...(transitionError ? [transitionError] : []),
  ]

  return (
    <Dialog
      open
      eyebrow="The next run"
      title="Begin a new run?"
      description="The sealed week is retired and a fresh seven-day run begins today. Your traveller keeps everything earned."
      onClose={onClose}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary">
            Begin a new run
            <Icon name="chevron-right" />
          </Button>
        </>
      }
    >
      <form
        noValidate
        id={formId}
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        {errors.length > 0 ? (
          <div className="form-alert" role="alert">
            <strong>This run cannot begin yet</strong>
            <ul>
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="summary-bonus is-forfeited new-run-warning">
          <span className="summary-bonus__icon">
            <Icon name="lock" />
          </span>
          <div className="summary-bonus__body">
            <span className="micro">What changes</span>
            <strong>The previous week’s record is replaced.</strong>
            <p>
              Its days, maps and weekly summary will no longer be available. Only one
              run can be active at a time.
            </p>
          </div>
        </div>

        <div className="new-run-keep" aria-label="Progress kept across runs">
          <span className="micro">Kept</span>
          <span className="chip">
            <Icon name="star" />
            Level {profile?.level ?? 1}
          </span>
          <span className="chip">{profile?.xp ?? 0} XP</span>
          <span className="chip">
            <Icon name="coin" />
            {profile?.gold ?? 0} gold
          </span>
          <span className="chip">
            <Icon name="gem" />
            {profile?.loot.length ?? 0} relics
          </span>
        </div>
        <p className="panel-note new-run-keep-note">
          {profile?.name ?? 'Your traveller'} keeps their name, level, experience,
          gold and collection. Only the run, its days and its weekly targets reset.
        </p>

        <fieldset className="new-run-goals">
          <legend className="micro">Weekly targets for the new run</legend>
          <p className="field-hint">
            Review each active goal. Targets run from {MIN_WEEKLY_OBJECTIVE} to{' '}
            {MAX_WEEKLY_OBJECTIVE} and are fixed once the run begins.
          </p>
          {validation.activeGoals.length === 0 ? (
            <p className="panel-note">
              There are no active goals. Restore one from Goals before beginning.
            </p>
          ) : (
            validation.activeGoals.map((goal, index) => {
              const fieldId = `${formId}-goal-${index}`
              const hintId = `${fieldId}-hint`
              const error = showErrors ? validation.fieldErrors[goal.id] : undefined
              const routines = activeTasks.filter((task) => task.goalId === goal.id).length
              return (
                <div className="new-run-goal" key={goal.id}>
                  <div className="new-run-goal__body">
                    <span className="new-run-goal__crest">
                      <Icon name={goalIcon(index)} />
                    </span>
                    <div>
                      <strong>{goal.title}</strong>
                      <span className="mini-note">
                        {routines} active {routines === 1 ? 'routine' : 'routines'}
                      </span>
                    </div>
                  </div>
                  <div className="field new-run-goal__field">
                    <label htmlFor={fieldId}>Weekly target</label>
                    <input
                      className="input"
                      id={fieldId}
                      type="number"
                      inputMode="numeric"
                      min={MIN_WEEKLY_OBJECTIVE}
                      max={MAX_WEEKLY_OBJECTIVE}
                      step={1}
                      value={targets[goal.id] ?? ''}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? `${fieldId}-error ${hintId}` : hintId}
                      onChange={(event) => updateTarget(goal.id, event.target.value)}
                    />
                    <p className="field-hint" id={hintId}>
                      {goal.title} must be kept {targets[goal.id] || '—'} times this
                      week.
                    </p>
                    {error ? (
                      <p className="field-error" id={`${fieldId}-error`}>
                        {error}
                      </p>
                    ) : null}
                  </div>
                </div>
              )
            })
          )}
        </fieldset>

        {validation.activeRoutines < 4 ? (
          <p className="form-alert" role="status">
            <strong>Routines needed</strong>
            A run needs at least four active routines. This setup has{' '}
            {validation.activeRoutines}.
          </p>
        ) : (
          <p className="summary-wait-note new-run-footnote">
            <Icon name="compass" />
            <span>
              The new run starts today. Day 1 will be ready to open; days 2–7 stay
              locked until their date.
            </span>
          </p>
        )}
      </form>
    </Dialog>
  )
}
