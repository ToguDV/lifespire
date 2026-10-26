import { useId, useState } from 'react'
import { MAX_WEEKLY_OBJECTIVE, MIN_WEEKLY_OBJECTIVE } from '../../domain/balance'
import type { FieldErrors } from '../../domain/content'
import { nextGoalIcon } from '../../domain/goalIcons'
import type { GoalIconId } from '../../domain/goalIcons'
import type { Effort, Goal, Task } from '../../domain/types'
import { useAppStore } from '../../state/store'
import { Button, Dialog, Icon, IconPicker } from '../components'
import { EFFORT_LABEL } from '../lib/format'

const EFFORTS: readonly Effort[] = ['light', 'medium', 'high']

const FIELD_KEYS = ['title', 'category', 'icon', 'weeklyObjective', 'effort', 'goalId'] as const

function nonFieldErrors(errors: string[], fieldErrors: FieldErrors): string[] {
  const fields = new Set(
    FIELD_KEYS.map((key) => fieldErrors[key]).filter((value): value is string => Boolean(value)),
  )
  return errors.filter((error) => !fields.has(error))
}

export interface GoalDialogProps {
  goal: Goal | null
  onClose: () => void
  onArchive: (goal: Goal) => void
}

export function GoalDialog({ goal, onClose, onArchive }: GoalDialogProps) {
  const saveGoal = useAppStore((state) => state.saveGoal)
  const goals = useAppStore((state) => state.document.goals)
  const [title, setTitle] = useState(goal?.title ?? '')
  const [category, setCategory] = useState(goal?.category ?? '')
  const [icon, setIcon] = useState<GoalIconId>(() => goal?.icon ?? nextGoalIcon(goals))
  const [weeklyObjective, setWeeklyObjective] = useState(
    String(goal?.weeklyObjective ?? 3),
  )
  const [active, setActive] = useState(goal?.active ?? true)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [failures, setFailures] = useState<string[]>([])
  const formId = useId()

  const submit = () => {
    const result = saveGoal({
      ...(goal ? { id: goal.id, createdAt: goal.createdAt } : {}),
      title,
      category,
      icon,
      weeklyObjective: Number(weeklyObjective),
      active,
    })
    if (result.ok) {
      onClose()
      return
    }
    setFieldErrors(result.fieldErrors)
    setFailures(nonFieldErrors(result.errors, result.fieldErrors))
  }

  const alert =
    failures.length > 0 ? (
      <div className="form-alert" role="alert">
        <strong>This goal was not saved</strong>
        <ul>
          {failures.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      </div>
    ) : null

  return (
    <Dialog
      open
      eyebrow="Goals"
      title={goal ? 'Edit goal' : 'Add a goal'}
      description={goal ? 'Edits shape future maps.' : 'A goal holds the routines that move it.'}
      onClose={onClose}
      footer={
        <>
          {goal ? (
            <Button variant="danger" onClick={() => { onClose(); onArchive(goal) }}>
              <Icon name="archive" />
              Archive goal
            </Button>
          ) : null}
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary">
            Save goal
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
        {alert}
        <div className="field">
          <label htmlFor={`${formId}-title`}>Goal title</label>
          <input
            className="input"
            id={`${formId}-title`}
            type="text"
            value={title}
            placeholder="e.g. Move under open sky"
            aria-invalid={Boolean(fieldErrors.title)}
            aria-describedby={fieldErrors.title ? `${formId}-title-error` : undefined}
            onChange={(event) => setTitle(event.target.value)}
          />
          {fieldErrors.title ? (
            <p className="field-error" id={`${formId}-title-error`}>
              {fieldErrors.title}
            </p>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor={`${formId}-category`}>Category</label>
          <input
            className="input"
            id={`${formId}-category`}
            type="text"
            value={category}
            placeholder="e.g. Movement"
            onChange={(event) => setCategory(event.target.value)}
          />
        </div>
        <div className="field">
          <IconPicker
            name={`${formId}-icon`}
            value={icon}
            onChange={setIcon}
            describedBy={fieldErrors.icon ? `${formId}-icon-error` : undefined}
          />
          {fieldErrors.icon ? (
            <p className="field-error" id={`${formId}-icon-error`}>
              {fieldErrors.icon}
            </p>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor={`${formId}-weekly`}>Weekly target</label>
          <input
            className="input"
            id={`${formId}-weekly`}
            type="number"
            min={MIN_WEEKLY_OBJECTIVE}
            max={MAX_WEEKLY_OBJECTIVE}
            step={1}
            value={weeklyObjective}
            aria-invalid={Boolean(fieldErrors.weeklyObjective)}
            aria-describedby={
              fieldErrors.weeklyObjective ? `${formId}-weekly-error` : `${formId}-weekly-hint`
            }
            onChange={(event) => setWeeklyObjective(event.target.value)}
          />
          <p className="field-hint" id={`${formId}-weekly-hint`}>
            How many routines of this goal you want to complete this week (1–7).
          </p>
          {fieldErrors.weeklyObjective ? (
            <p className="field-error" id={`${formId}-weekly-error`}>
              {fieldErrors.weeklyObjective}
            </p>
          ) : null}
        </div>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          <span>Active</span>
        </label>
      </form>
    </Dialog>
  )
}

export interface TaskDialogProps {
  task: Task | null
  goalId: string
  onClose: () => void
  onArchive: (task: Task) => void
}

export function TaskDialog({ task, goalId, onClose, onArchive }: TaskDialogProps) {
  const saveTask = useAppStore((state) => state.saveTask)
  const goals = useAppStore((state) => state.document.goals)
  const activeGoals = goals.filter((goal) => goal.active)
  const [title, setTitle] = useState(task?.title ?? '')
  const [selectedGoalId, setSelectedGoalId] = useState(
    task?.goalId ?? (activeGoals.some((goal) => goal.id === goalId) ? goalId : activeGoals[0]?.id ?? ''),
  )
  const [effort, setEffort] = useState<Effort>(task?.effort ?? 'medium')
  const [active, setActive] = useState(task?.active ?? true)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [failures, setFailures] = useState<string[]>([])
  const formId = useId()

  const submit = () => {
    const result = saveTask({
      ...(task ? { id: task.id, createdAt: task.createdAt } : {}),
      goalId: selectedGoalId,
      title,
      effort,
      active,
    })
    if (result.ok) {
      onClose()
      return
    }
    setFieldErrors(result.fieldErrors)
    setFailures(nonFieldErrors(result.errors, result.fieldErrors))
  }

  const alert =
    failures.length > 0 ? (
      <div className="form-alert" role="alert">
        <strong>This routine was not saved</strong>
        <ul>
          {failures.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      </div>
    ) : null

  return (
    <Dialog
      open
      eyebrow="Routines"
      title={task ? 'Edit routine' : 'Add a routine'}
      description="Edits shape future maps."
      onClose={onClose}
      footer={
        <>
          {task ? (
            <Button variant="danger" onClick={() => { onClose(); onArchive(task) }}>
              <Icon name="archive" />
              Archive routine
            </Button>
          ) : null}
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            disabled={activeGoals.length === 0}
          >
            Save routine
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
        {alert}
        {activeGoals.length === 0 ? (
          <p className="panel-note">
            Add an active goal first. Every routine needs an active goal.
          </p>
        ) : null}
        <div className="field">
          <label htmlFor={`${formId}-title`}>Routine title</label>
          <input
            className="input"
            id={`${formId}-title`}
            type="text"
            value={title}
            placeholder="e.g. Walk the north trail"
            aria-invalid={Boolean(fieldErrors.title)}
            aria-describedby={fieldErrors.title ? `${formId}-title-error` : undefined}
            onChange={(event) => setTitle(event.target.value)}
          />
          {fieldErrors.title ? (
            <p className="field-error" id={`${formId}-title-error`}>
              {fieldErrors.title}
            </p>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor={`${formId}-goal`}>Belongs to</label>
          <select
            className="input"
            id={`${formId}-goal`}
            value={selectedGoalId}
            aria-invalid={Boolean(fieldErrors.goalId)}
            aria-describedby={fieldErrors.goalId ? `${formId}-goal-error` : undefined}
            onChange={(event) => setSelectedGoalId(event.target.value)}
          >
            {activeGoals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </select>
          {fieldErrors.goalId ? (
            <p className="field-error" id={`${formId}-goal-error`}>
              {fieldErrors.goalId}
            </p>
          ) : null}
        </div>
        <div className="field">
          <span className="field__label" id={`${formId}-effort-label`}>
            Effort
          </span>
          <div
            className="segmented segmented--form"
            role="group"
            aria-labelledby={`${formId}-effort-label`}
          >
            {EFFORTS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={effort === option}
                onClick={() => setEffort(option)}
              >
                {EFFORT_LABEL[option]}
              </button>
            ))}
          </div>
        </div>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          <span>Active</span>
        </label>
      </form>
    </Dialog>
  )
}

export interface ArchiveDialogProps {
  kind: 'goal' | 'task'
  id: string
  title: string
  onClose: () => void
}

export function ArchiveDialog({ kind, id, title, onClose }: ArchiveDialogProps) {
  const archiveGoal = useAppStore((state) => state.archiveGoal)
  const archiveTask = useAppStore((state) => state.archiveTask)
  const [failures, setFailures] = useState<string[]>([])

  const confirm = () => {
    const result = kind === 'goal' ? archiveGoal(id) : archiveTask(id)
    if (result.ok) {
      onClose()
      return
    }
    setFailures(result.errors)
  }

  return (
    <Dialog
      open
      eyebrow={kind === 'goal' ? 'Goals' : 'Routines'}
      title={`Archive “${title}”?`}
      description={
        kind === 'goal'
          ? 'This goal and its routines leave future maps. Maps already drawn keep their original steps, and this week’s targets do not change.'
          : 'This routine leaves future maps. Maps already drawn keep their original step, and this week’s targets do not change.'
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Keep {kind === 'goal' ? 'goal' : 'routine'}
          </Button>
          <Button variant="danger" onClick={confirm}>
            <Icon name="archive" />
            Archive
          </Button>
        </>
      }
    >
      {failures.length > 0 ? (
        <div className="form-alert" role="alert">
          <strong>This cannot be archived yet</strong>
          <ul>
            {failures.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Dialog>
  )
}
