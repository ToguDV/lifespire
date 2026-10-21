import { useAppStore } from '../../state/store'
import {
  Button,
  EffortDots,
  Icon,
  Panel,
  PanelHead,
  Pips,
  ScreenHead,
} from '../components'
import { EFFORT_LABEL, goalIcon, percent } from '../lib/format'

export function GoalsScreen() {
  const document = useAppStore((state) => state.document)
  const navigate = useAppStore((state) => state.navigate)

  const run = document.run
  const goals = document.goals.filter((goal) => goal.active)
  const tasks = document.tasks.filter((task) => task.active)
  const totalTarget = goals.reduce((total, goal) => total + goal.weeklyObjective, 0)
  const totalProgress = run
    ? run.objectives.reduce((total, objective) => total + Math.min(objective.progress, objective.target), 0)
    : 0

  const progressFor = (goalId: string) =>
    run?.objectives.find((objective) => objective.goalId === goalId)?.progress ?? 0

  return (
    <section className="screen screen--aims" data-screen="aims" aria-labelledby="aims-title">
      <ScreenHead
        kicker={run ? 'The week · Run I' : 'Profile · Aims'}
        title="Aims"
        titleId="aims-title"
        sub={
          goals.length > 0
            ? `${goals.length} aims hold the week together. ${totalTarget} small completions close it.`
            : 'No aims yet. Aims and routines are created during onboarding.'
        }
        meta={
          <Button
            variant="secondary"
            size="sm"
            disabled
            title="Editing aims and routines is not available yet."
          >
            <Icon name="plus" />
            Add aim
          </Button>
        }
      />

      <div className="aims-grid">
        <div className="aims-list">
          {goals.length === 0 ? (
            <Panel pad>
              <div className="empty-state">
                <span className="empty-state__medallion">
                  <Icon name="banner" />
                </span>
                <span className="micro">The aims</span>
                <h2>No aims yet.</h2>
                <p>
                  Begin onboarding to create your first aims and routines. If you already have
                  a profile, this list stays quiet until a new run begins.
                </p>
              </div>
            </Panel>
          ) : (
            goals.map((goal, index) => {
              const goalTasks = tasks.filter((task) => task.goalId === goal.id)
              const progress = progressFor(goal.id)
              return (
                <Panel as="article" className="aim-group" key={goal.id} aria-label={goal.title}>
                  <div className="aim-group__head">
                    <span className="aim-group__crest">
                      <Icon name={goalIcon(index)} />
                    </span>
                    <div className="aim-group__title">
                      <h2>{goal.title}</h2>
                      <p>
                        {goal.category} · {goal.weeklyObjective} each week
                      </p>
                    </div>
                    <div className="aim-group__progress">
                      <Pips value={progress} max={goal.weeklyObjective} />
                      <span>
                        {Math.min(progress, goal.weeklyObjective)} / {goal.weeklyObjective}
                      </span>
                    </div>
                  </div>

                  <div className="routine-list">
                    {goalTasks.length === 0 ? (
                      <p className="panel-note routine-list__empty">
                        No routines under this aim yet.
                      </p>
                    ) : (
                      goalTasks.map((task) => (
                        <div className="routine routine--readonly" key={task.id}>
                          <div className="routine__body">
                            <strong>{task.title}</strong>
                            <span>{EFFORT_LABEL[task.effort]} effort</span>
                          </div>
                          <EffortDots effort={task.effort} />
                        </div>
                      ))
                    )}
                  </div>
                </Panel>
              )
            })
          )}

          <p className="quiet-note">
            <Icon name="quill" />
            <span>
              Aims are read-only for now. Editing them will arrive in a later release and
              will only affect future maps.
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
              {goals.length === 0 ? (
                <p className="panel-note">No aims to show.</p>
              ) : (
                goals.map((goal, index) => (
                  <div className="week-row" key={goal.id}>
                    <Icon name={goalIcon(index)} className="icon icon--sm week-row__icon" />
                    <span className="week-row__name">{goal.title}</span>
                    <span className="week-row__count">
                      {Math.min(progressFor(goal.id), goal.weeklyObjective)} / {goal.weeklyObjective}
                    </span>
                    <div className="mini-progress" aria-hidden="true">
                      <span style={{ width: `${percent(progressFor(goal.id), goal.weeklyObjective)}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel pad>
            <PanelHead label="Editing" />
            <p className="panel-note">
              Creating and editing aims and routines is not available yet. Until then, the
              demo or onboarding setup defines this week.
            </p>
            <Button variant="secondary" full onClick={() => navigate({ name: 'settings' })}>
              <Icon name="settings" />
              Open settings
            </Button>
          </Panel>
        </aside>
      </div>
    </section>
  )
}
