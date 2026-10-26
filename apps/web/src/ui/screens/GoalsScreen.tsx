import { useState } from 'react'
import { MAX_GOALS } from '../../domain/balance'
import type { Goal, RunObjective, Task } from '../../domain/types'
import { useAppStore } from '../../state/store'
import {
  Button,
  EffortDots,
  Icon,
  IconButton,
  Panel,
  Pips,
  ScreenHead,
} from '../components'
import { EFFORT_LABEL, goalIconName } from '../lib/format'
import { ArchiveDialog, GoalDialog, TaskDialog } from './GoalsDialogs'

interface GoalDialogState {
  goal: Goal | null
}

interface TaskDialogState {
  task: Task | null
  goalId: string
}

interface ArchiveState {
  kind: 'goal' | 'task'
  id: string
  title: string
}

export function GoalsScreen() {
  const document = useAppStore((state) => state.document)
  const saveGoal = useAppStore((state) => state.saveGoal)
  const saveTask = useAppStore((state) => state.saveTask)

  const [goalDialog, setGoalDialog] = useState<GoalDialogState | null>(null)
  const [taskDialog, setTaskDialog] = useState<TaskDialogState | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<ArchiveState | null>(null)

  const run = document.run
  const activeGoals = document.goals.filter((goal) => goal.active)
  const activeGoalIds = new Set(activeGoals.map((goal) => goal.id))
  const activeTasks = document.tasks.filter(
    (task) => task.active && activeGoalIds.has(task.goalId),
  )
  const archivedGoals = document.goals.filter((goal) => !goal.active)
  const archivedTasks = document.tasks.filter((task) => !task.active)
  const archivedCount = archivedGoals.length + archivedTasks.length

  const objectiveFor = (goalId: string): RunObjective | null =>
    run?.objectives.find((objective) => objective.goalId === goalId) ?? null

  const totalTarget = run
    ? run.objectives.reduce((total, objective) => total + objective.target, 0)
    : activeGoals.reduce((total, goal) => total + goal.weeklyObjective, 0)
  const totalProgress = run
    ? run.objectives.reduce(
        (total, objective) => total + Math.min(objective.progress, objective.target),
        0,
      )
    : 0

  const openGoalDialog = (goal: Goal | null) => setGoalDialog({ goal })
  const openTaskDialog = (task: Task | null, goalId: string) =>
    setTaskDialog({ task, goalId })
  const requestArchive = (kind: 'goal' | 'task', id: string, title: string) =>
    setArchiveTarget({ kind, id, title })

  const restoreGoal = (goal: Goal) => {
    saveGoal({ ...goal, active: true })
  }

  const restoreTask = (task: Task) => {
    saveTask({ ...task, active: true })
  }

  const kicker = run
    ? run.status === 'active'
      ? 'The week'
      : 'The week · Sealed'
    : 'Profile · Goals'

  return (
    <section className="screen screen--aims" data-screen="aims" aria-labelledby="aims-title">
      <ScreenHead
        kicker={kicker}
        title="Goals"
        titleId="aims-title"
        meta={
          <>
            <span className="chip chip--quiet">
              {activeGoals.length} goals · {activeTasks.length} routines
            </span>
            <span className="micro" style={{ color: 'var(--accent-deep)' }}>
              {totalProgress} / {totalTarget} this week
            </span>
            <div className="screen-head__actions">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openTaskDialog(null, activeGoals[0]?.id ?? '')}
                disabled={activeGoals.length === 0}
                title={
                  activeGoals.length === 0 ? 'Add an active goal first.' : undefined
                }
              >
                <Icon name="plus" />
                Add routine
              </Button>
              <Button variant="secondary" size="sm" onClick={() => openGoalDialog(null)}>
                <Icon name="plus" />
                Add goal
              </Button>
            </div>
          </>
        }
      />

      <div className="aims-grid">
        <div className="aims-list">
          {activeGoals.length === 0 ? (
            <Panel pad>
              <div className="empty-state">
                <span className="empty-state__medallion">
                  <Icon name="banner" />
                </span>
                <h2>No active goals yet.</h2>
                <Button variant="primary" onClick={() => openGoalDialog(null)}>
                  <Icon name="plus" />
                  Add your first goal
                </Button>
              </div>
            </Panel>
          ) : (
            activeGoals.map((goal, index) => {
              const goalTasks = activeTasks.filter((task) => task.goalId === goal.id)
              const objective = objectiveFor(goal.id)
              const progress = objective ? Math.min(objective.progress, objective.target) : 0
              return (
                <Panel as="article" className="aim-group" key={goal.id} aria-label={goal.title}>
                  <div className="aim-group__head">
                    <span className="aim-group__crest">
                      <Icon name={goalIconName(goal.icon, index)} />
                    </span>
                    <div className="aim-group__title">
                      <h2>{goal.title}</h2>
                      <p>
                        {goal.category.trim() || 'General'} ·{' '}
                        {objective
                          ? `this week ${objective.target}`
                          : `${goal.weeklyObjective} each week next run`}
                      </p>
                    </div>
                    <div className="aim-group__progress">
                      {objective ? (
                        <>
                          <Pips
                            value={progress}
                            max={objective.target}
                            label={`${progress} of ${objective.target} this week`}
                          />
                          <span>
                            {progress} / {objective.target}
                          </span>
                        </>
                      ) : run ? (
                        <span className="chip chip--quiet">Not in this run</span>
                      ) : (
                        <>
                          <Pips
                            value={0}
                            max={goal.weeklyObjective}
                            label={`0 of ${goal.weeklyObjective} next run`}
                          />
                          <span>0 / {goal.weeklyObjective}</span>
                        </>
                      )}
                    </div>
                    <IconButton
                      icon="edit"
                      label={`Edit goal ${goal.title}`}
                      className="aim-group__edit"
                      onClick={() => openGoalDialog(goal)}
                    />
                  </div>

                  <div className="routine-list">
                    {goalTasks.length === 0 ? (
                      <p className="panel-note routine-list__empty">
                        No active routines under this goal yet.
                      </p>
                    ) : (
                      goalTasks.map((task) => (
                        <div className="routine" key={task.id}>
                          <div className="routine__body">
                            <strong>{task.title}</strong>
                            <span>{EFFORT_LABEL[task.effort]} effort</span>
                          </div>
                          <EffortDots effort={task.effort} />
                          <div className="routine__actions">
                            <IconButton
                              icon="edit"
                              label={`Edit routine ${task.title}`}
                              onClick={() => openTaskDialog(task, goal.id)}
                            />
                            <IconButton
                              icon="archive"
                              label={`Archive routine ${task.title}`}
                              onClick={() => requestArchive('task', task.id, task.title)}
                            />
                          </div>
                        </div>
                      ))
                    )}
                    <div className="routine-list__add">
                      <Button
                        variant="quiet"
                        size="sm"
                        onClick={() => openTaskDialog(null, goal.id)}
                      >
                        <Icon name="plus" />
                        Add routine to this goal
                      </Button>
                    </div>
                  </div>
                </Panel>
              )
            })
          )}

          {archivedCount > 0 ? (
            <Panel pad className="archived-panel">
              <details className="archived-details">
                <summary>Archived ({archivedCount})</summary>
                <p className="panel-note">Restoring only affects future maps.</p>

                {archivedGoals.length > 0 ? (
                  <div className="archived-group">
                    <h3 className="micro">Goals</h3>
                    {archivedGoals.map((goal) => (
                      <div className="archived-row" key={goal.id}>
                        <span className="archived-row__body">
                          <strong>{goal.title || 'Untitled goal'}</strong>
                          <small>
                            {goal.category.trim() || 'General'} · {goal.weeklyObjective} each
                            week
                          </small>
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => restoreGoal(goal)}
                          disabled={activeGoals.length >= MAX_GOALS}
                          title={
                            activeGoals.length >= MAX_GOALS
                              ? 'Archive an active goal before restoring another.'
                              : undefined
                          }
                        >
                          Restore goal
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {archivedTasks.length > 0 ? (
                  <div className="archived-group">
                    <h3 className="micro">Routines</h3>
                    {archivedTasks.map((task) => {
                      const goal = document.goals.find((candidate) => candidate.id === task.goalId)
                      const goalActive = Boolean(goal?.active)
                      return (
                        <div className="archived-row" key={task.id}>
                          <span className="archived-row__body">
                            <strong>{task.title || 'Untitled routine'}</strong>
                            <small>
                              {EFFORT_LABEL[task.effort]} effort ·{' '}
                              {goal?.title ?? 'Goal no longer present'}
                            </small>
                          </span>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => restoreTask(task)}
                            disabled={!goalActive}
                            title={
                              goalActive
                                ? undefined
                                : 'Restore its goal before restoring this routine.'
                            }
                          >
                            Restore routine
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </details>
            </Panel>
          ) : null}
        </div>
      </div>

      {goalDialog ? (
        <GoalDialog
          key={goalDialog.goal?.id ?? 'new-goal'}
          goal={goalDialog.goal}
          onClose={() => setGoalDialog(null)}
          onArchive={(goal) => requestArchive('goal', goal.id, goal.title)}
        />
      ) : null}

      {taskDialog ? (
        <TaskDialog
          key={taskDialog.task?.id ?? `new-task-${taskDialog.goalId}`}
          task={taskDialog.task}
          goalId={taskDialog.goalId}
          onClose={() => setTaskDialog(null)}
          onArchive={(task) => requestArchive('task', task.id, task.title)}
        />
      ) : null}

      {archiveTarget ? (
        <ArchiveDialog
          key={`${archiveTarget.kind}-${archiveTarget.id}`}
          kind={archiveTarget.kind}
          id={archiveTarget.id}
          title={archiveTarget.title}
          onClose={() => setArchiveTarget(null)}
        />
      ) : null}
    </section>
  )
}
