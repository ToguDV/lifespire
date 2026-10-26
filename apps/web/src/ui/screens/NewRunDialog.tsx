import { useId, useState } from 'react'
import { MAX_WEEKLY_OBJECTIVE, MIN_WEEKLY_OBJECTIVE } from '../../domain/balance'
import { useAppStore } from '../../state/store'
import { Button, Dialog, Icon } from '../components'
import { initialWeeklyTargets, validateNewRunSetup } from '../lib/newRun'
import type { WeeklyTargets } from '../lib/newRun'
import { goalIconName } from '../lib/format'

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
  const [targets, setTargets] = useState<WeeklyTargets>(() =>
    initialWeeklyTargets(document.goals),
  )
  const [showErrors, setShowErrors] = useState(false)
  const [transitionError, setTransitionError] = useState<string | null>(null)
  const formId = useId()
  const targetsHintId = `${formId}-targets-hint`

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
      description="The previous week is retired. Your profile, level, XP, gold and relics stay."
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

        <fieldset className="new-run-goals">
          <legend className="micro">Weekly targets for the new run</legend>
          <p className="field-hint" id={targetsHintId}>
            Targets run from {MIN_WEEKLY_OBJECTIVE} to {MAX_WEEKLY_OBJECTIVE}.
          </p>
          {validation.activeGoals.length === 0 ? (
            <p className="panel-note">
              There are no active goals. Restore one from Goals before beginning.
            </p>
          ) : (
            validation.activeGoals.map((goal, index) => {
              const fieldId = `${formId}-goal-${index}`
              const error = showErrors ? validation.fieldErrors[goal.id] : undefined
              const routines = activeTasks.filter((task) => task.goalId === goal.id).length
              return (
                <div className="new-run-goal" key={goal.id}>
                  <div className="new-run-goal__body">
                    <span className="new-run-goal__crest">
                      <Icon name={goalIconName(goal.icon, index)} />
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
                      aria-describedby={
                        error ? `${fieldId}-error ${targetsHintId}` : targetsHintId
                      }
                      onChange={(event) => updateTarget(goal.id, event.target.value)}
                    />
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
        ) : null}
      </form>
    </Dialog>
  )
}
