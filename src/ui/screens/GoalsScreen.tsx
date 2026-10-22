import { useState } from 'react'
import type { Goal, RunObjective, Task } from '../../domain/types'
import { useAppStore } from '../../state/store'
import {
  Button,
  EffortDots,
  Icon,
  IconButton,
  Panel,
  PanelHead,
  Pips,
  ScreenHead,
} from '../components'
import { EFFORT_LABEL, goalIcon, percent } from '../lib/format'
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

interface WeekRow {
  goalId: string
  title: string
  progress: number
  target: number
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

  const weekRows: WeekRow[] = run
    ? run.objectives.map((objective) => ({
        goalId: objective.goalId,
        title: objective.goalTitle,
        progress: objective.progress,
        target: objective.target,
      }))
    : activeGoals.map((goal) => ({
        goalId: goal.id,
        title: goal.title,
        progress: 0,
        target: goal.weeklyObjective,
      }))

  const totalTarget = weekRows.reduce((total, row) => total + row.target, 0)
  const totalProgress = weekRows.reduce(
    (total, row) => total + Math.min(row.progress, row.target),
    0,
  )

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
      ? 'The week · Run I'
      : 'The week · Sealed'
    : 'Profile · Goals'

  const sub =
    activeGoals.length === 0
      ? 'No active goals yet. Add one to shape the next run.'
      : run?.status === 'active'
        ? `${activeGoals.length} active ${activeGoals.length === 1 ? 'goal shapes' : 'goals shape'} maps from now on. This week’s targets stay fixed.`
        : `${activeGoals.length} active ${activeGoals.length === 1 ? 'goal' : 'goals'} · ${activeTasks.length} active routines. Editing shapes the next run.`

  return (
    <section className="screen screen--aims" data-screen="aims" aria-labelledby="aims-title">
      <ScreenHead
        kicker={kicker}
        title="Goals"
        titleId="aims-title"
        sub={sub}
        meta={
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
                <span className="micro">The goals</span>
                <h2>No active goals yet.</h2>
                <p>
                  Add a goal and at least four routines before the next run. Maps already drawn
                  keep their original steps.
                </p>
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
                      <Icon name={goalIcon(index)} />
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
              <PanelHead
                label="Archived"
                aside={<span className="micro">{archivedCount} kept</span>}
              />
              <details className="archived-details">
                <summary>Show archived goals and routines</summary>
                <p className="panel-note">
                  Archived content never changes a map that was already drawn. Restoring it only
                  affects future maps.
                </p>

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
                          disabled={activeGoals.length >= 3}
                          title={
                            activeGoals.length >= 3
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

          <p className="quiet-note">
            <Icon name="quill" />
            <span>
              Goals and routines can be edited at any time. A map already drawn keeps its
              original steps and rewards.
            </span>
          </p>
        </div>

        <aside className="camp-rail" aria-label="Week summary">
          <Panel pad>
            <PanelHead
              label="Week at a glance"
              aside={
                <span className="micro" style={{ color: 'var(--accent-deep)' }}>
                  {totalProgress} / {totalTarget}
                </span>
              }
            />
            <div className="week-list">
              {weekRows.length === 0 ? (
                <p className="panel-note">No goals to show.</p>
              ) : (
                weekRows.map((row) => {
                  const index = document.goals.findIndex((goal) => goal.id === row.goalId)
                  return (
                    <div className="week-row" key={row.goalId}>
                      <Icon
                        name={goalIcon(index)}
                        className="icon icon--sm week-row__icon"
                      />
                      <span className="week-row__name">{row.title}</span>
                      <span className="week-row__count">
                        {Math.min(row.progress, row.target)} / {row.target}
                      </span>
                      <div className="mini-progress" aria-hidden="true">
                        <span style={{ width: `${percent(row.progress, row.target)}%` }} />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            {run ? (
              <p className="panel-note archived-note">
                These targets were fixed when the run began. Editing goals shapes the next run.
              </p>
            ) : null}
          </Panel>

          <Panel pad>
            <PanelHead label="How it works" />
            <p className="panel-note">
              A goal is an area you are pursuing, such as movement or making. Its routines are
              the small steps that move it, and the weekly target is how many of them you want
              to finish this week.
            </p>
          </Panel>

          <Panel pad>
            <PanelHead label="Add a routine" />
            <p className="panel-note">
              Routines join maps drawn from now on. A map already open keeps its original
              steps.
            </p>
            <Button
              variant="secondary"
              full
              onClick={() => openTaskDialog(null, activeGoals[0]?.id ?? '')}
              disabled={activeGoals.length === 0}
            >
              <Icon name="plus" />
              Add routine
            </Button>
          </Panel>

          <Panel pad>
            <PanelHead label="Editing" />
            <p className="panel-note">
              {run?.status === 'active'
                ? 'This week’s objectives were set at the start and will not change. The next run uses the goals you keep here.'
                : 'The next run uses the active goals and routines you keep here.'}
            </p>
            <Button variant="secondary" full onClick={() => openGoalDialog(null)}>
              <Icon name="plus" />
              Add goal
            </Button>
          </Panel>
        </aside>
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
