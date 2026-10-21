import { xpIntoLevel, xpToNextLevel } from '../../domain/selectors'
import type { Day, MapNode } from '../../domain/types'
import { useAppStore } from '../../state/store'
import {
  AimRow,
  Button,
  Icon,
  Panel,
  ScreenHead,
} from '../components'
import {
  NODE_TYPE_ICON,
  NODE_TYPE_LABEL,
  formatDayKey,
  goalIcon,
  romanDay,
} from '../lib/format'

function nodeForDay(day: Day, nodeId: string): MapNode | null {
  if (!day.map) return null
  const nodes = day.map.layers.flat()
  return nodes.find((node) => node.id === nodeId) ?? (day.map.boss.id === nodeId ? day.map.boss : null)
}

function EmptySummary({
  title,
  copy,
  action,
  actionLabel = 'Return to camp',
}: {
  title: string
  copy: string
  action: () => void
  actionLabel?: string
}) {
  return (
    <div className="summary-wrap">
      <Panel framed className="summary-page">
        <div className="empty-state">
          <span className="empty-state__medallion">
            <Icon name="spire" />
          </span>
          <span className="micro">Day summary</span>
          <h2>{title}</h2>
          <p>{copy}</p>
          <Button variant="secondary" onClick={action}>
            {actionLabel}
            <Icon name="chevron-right" />
          </Button>
        </div>
      </Panel>
    </div>
  )
}

export function DaySummaryScreen({ dayId }: { dayId: string }) {
  const run = useAppStore((state) => state.document.run)
  const profile = useAppStore((state) => state.document.profile)
  const goals = useAppStore((state) => state.document.goals)
  const navigate = useAppStore((state) => state.navigate)

  const day = run?.days.find((item) => item.id === dayId) ?? null
  const summary = day?.summary ?? null

  if (!run) {
    return (
      <section className="screen screen--summary" data-screen="summary" aria-labelledby="summary-empty-title">
        <ScreenHead
          kicker="Day summary"
          title="No run yet."
          titleId="summary-empty-title"
          sub="Days are sealed inside a run. Begin one from camp first."
        />
        <EmptySummary
          title="Nothing to record yet."
          copy="Start a run and complete a day to see its path and rewards here."
          action={() => navigate({ name: 'home' })}
        />
      </section>
    )
  }

  if (!day) {
    return (
      <section className="screen screen--summary" data-screen="summary" aria-labelledby="summary-missing-title">
        <ScreenHead
          kicker="Day summary"
          title="That day is not in this run."
          titleId="summary-missing-title"
          sub="The seven days of a run are fixed when it begins."
        />
        <EmptySummary
          title="No matching day."
          copy="Return to camp and choose a day from the current run."
          action={() => navigate({ name: 'home' })}
        />
      </section>
    )
  }

  const kicker = summary ? `Day ${day.index + 1} · Sealed` : `Day ${day.index + 1} · Open`
  const title = summary ? 'The day is recorded.' : 'No day is sealed yet.'

  return (
    <section className="screen screen--summary" data-screen="summary" aria-labelledby="summary-title">
      <ScreenHead
        kicker={kicker}
        title={title}
        titleId="summary-title"
        sub={
          summary
            ? 'The path is chosen, the rewards are counted, and the day is closed.'
            : 'Complete the daily boss to seal the day and record its rewards.'
        }
        meta={<span className="chip chip--quiet">{formatDayKey(day.date)}</span>}
      />

      {!summary ? (
        <EmptySummary
          title="The page is still blank."
          copy="This day has not been sealed. Return to the map and finish the path when you are ready."
          action={() => navigate({ name: 'map' })}
          actionLabel="Return to map"
        />
      ) : (
        <div className="summary-wrap">
          <Panel framed className="summary-page">
            <header className="summary-head">
              <div className="summary-head__copy">
                <span className="micro">Day {day.index + 1} of 7</span>
                <h2>{summary.bossCompleted ? 'A quiet climb, kept to the end.' : 'A day left open at the gate.'}</h2>
                <p>Rewards are sealed with the day.</p>
              </div>
              <div className="seal" aria-label={`Day ${day.index + 1} seal`}>
                <span className="seal__inner">
                  <Icon name="spire" />
                  <strong>{romanDay(day.index)}</strong>
                  <span>day</span>
                </span>
              </div>
            </header>

            <div className="summary-path" aria-label="Path taken">
              {day.path.length === 0 ? (
                <p className="panel-note">No steps were recorded on this day.</p>
              ) : (
                day.path.map((entry) => {
                  const node = nodeForDay(day, entry.nodeId)
                  const reward = day.rewards.find((event) => event.nodeId === entry.nodeId)
                  const done = entry.action === 'complete'
                  const type = node?.type ?? 'task'
                  return (
                    <div className="path-row" key={entry.nodeId}>
                      <span className={`path-row__medallion ${done ? 'is-done' : 'is-skipped'}`}>
                        <Icon name={NODE_TYPE_ICON[type]} />
                      </span>
                      <span className="path-row__body">
                        <strong>{node?.task?.title ?? NODE_TYPE_LABEL[type]}</strong>
                        <span>
                          {NODE_TYPE_LABEL[type]}
                          {node?.task?.goalTitle ? ` · ${node.task.goalTitle}` : ''}
                          {done ? '' : ' · skipped'}
                        </span>
                      </span>
                      <span className="path-row__reward">
                        {done && reward
                          ? `+${reward.xp} XP · +${reward.gold} g`
                          : 'No reward'}
                      </span>
                    </div>
                  )
                })
              )}
            </div>

            <div className="summary-totals" aria-label="Rewards earned">
              <div className="total">
                <strong>
                  <Icon name="star" />+{summary.xp}
                </strong>
                <span>Experience</span>
              </div>
              <div className="total">
                <strong>
                  <Icon name="coin" />+{summary.gold}
                </strong>
                <span>Gold</span>
              </div>
              <div className="total">
                <strong>
                  <Icon name="gem" />+{summary.loot.length}
                </strong>
                <span>Relics</span>
              </div>
            </div>

            <div className="summary-aims">
              {summary.objectives.map((objective) => (
                <AimRow
                  key={objective.goalId}
                  title={objective.title}
                  progress={objective.after}
                  target={objective.target}
                  icon={goalIcon(goals.findIndex((goal) => goal.id === objective.goalId))}
                />
              ))}
            </div>

            {profile ? (
              <div className="level-up">
                <Icon name="star" />
                Level {profile.level} at day's end · {xpIntoLevel(profile.xp)} / 100 to the
                next · {xpToNextLevel(profile.xp)} to go
              </div>
            ) : null}

            <div className="summary-actions">
              <Button variant="primary" onClick={() => navigate({ name: 'home' })}>
                Return to camp
                <Icon name="chevron-right" />
              </Button>
              <Button variant="quiet" onClick={() => navigate({ name: 'goals' })}>
                View the week
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </section>
  )
}
