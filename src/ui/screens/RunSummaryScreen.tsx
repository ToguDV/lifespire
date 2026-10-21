import type { RunSummary } from '../../domain/types'
import { currentDay } from '../../domain/selectors'
import { useAppStore } from '../../state/store'
import {
  AimRow,
  Button,
  EmptyLootCard,
  Icon,
  LootCard,
  Panel,
  ScreenHead,
} from '../components'
import { goalIcon, romanDay } from '../lib/format'

function SummaryBody({
  run,
  summary,
  days,
  onNewRun,
  onCamp,
}: {
  run: NonNullable<ReturnType<typeof useAppStore.getState>['document']['run']>
  summary: RunSummary
  days: number
  onNewRun: () => void
  onCamp: () => void
}) {
  const goals = useAppStore((state) => state.document.goals)

  return (
    <div className="summary-wrap">
      <Panel framed className="summary-page">
        <header className="summary-head">
          <div className="summary-head__copy">
            <span className="micro">The week · Run I</span>
            <h2>{summary.allComplete ? 'Every aim kept. The spire answers.' : 'A week written in small promises.'}</h2>
            <p>{days} days recorded. The totals are yours to keep.</p>
          </div>
          <div className="seal" aria-label="Run seal">
            <span className="seal__inner">
              <Icon name="spire" />
              <strong>{romanDay(6)}</strong>
              <span>week</span>
            </span>
          </div>
        </header>

        <div className="summary-path" aria-label="Run totals">
          <div className="path-row">
            <span className="path-row__medallion is-done">
              <Icon name="check" />
            </span>
            <span className="path-row__body">
              <strong>{run.totals.nodesCompleted} steps completed</strong>
              <span>{run.totals.nodesSkipped} skipped · {run.totals.daysMissed} days missed</span>
            </span>
            <span className="path-row__reward">{run.totals.daysPlayed} days played</span>
          </div>
        </div>

        <div className="summary-totals" aria-label="Rewards earned">
          <div className="total">
            <strong>
              <Icon name="star" />+{summary.totals.xp}
            </strong>
            <span>Experience</span>
          </div>
          <div className="total">
            <strong>
              <Icon name="coin" />+{summary.totals.gold}
            </strong>
            <span>Gold</span>
          </div>
          <div className="total">
            <strong>
              <Icon name="gem" />+{summary.totals.lootCount}
            </strong>
            <span>Relics</span>
          </div>
        </div>

        <div className="summary-aims">
          {summary.objectives.map((objective) => (
            <div className="summary-aim" key={objective.goalId}>
              <AimRow
                title={objective.title}
                progress={objective.progress}
                target={objective.target}
                icon={goalIcon(goals.findIndex((goal) => goal.id === objective.goalId))}
              />
              <p className="mini-note summary-aim__bonus">
                {objective.met ? `Kept · +${objective.bonusXp} XP · +${objective.bonusGold} gold` : 'Not kept'}
              </p>
            </div>
          ))}
        </div>

        {summary.bonusXp > 0 || summary.bonusGold > 0 ? (
          <div className="level-up">
            <Icon name="star" />
            Weekly bonus · +{summary.bonusXp} XP · +{summary.bonusGold} gold
            {summary.guaranteedRare ? ' · one rare relic' : ''}
          </div>
        ) : null}

        <section className="section-block" aria-labelledby="run-loot-title">
          <div className="section-block__head">
            <h2 id="run-loot-title">Found this week</h2>
            <span className="mini-note">{summary.loot.length} relics</span>
          </div>
          {summary.loot.length === 0 ? (
            <div className="loot-grid">
              <EmptyLootCard />
            </div>
          ) : (
            <div className="loot-grid">
              {summary.loot.map((item) => (
                <LootCard item={item} key={item.id} />
              ))}
            </div>
          )}
          {summary.duplicateGold > 0 ? (
            <p className="panel-note">Duplicates turned into {summary.duplicateGold} gold.</p>
          ) : null}
        </section>

        <div className="summary-actions">
          <Button variant="primary" onClick={onNewRun}>
            Begin a new run
            <Icon name="chevron-right" />
          </Button>
          <Button variant="quiet" onClick={onCamp}>
            Return to camp
          </Button>
        </div>
      </Panel>
    </div>
  )
}

export function RunSummaryScreen() {
  const run = useAppStore((state) => state.document.run)
  const navigate = useAppStore((state) => state.navigate)
  const startRun = useAppStore((state) => state.startRun)

  if (!run) {
    return (
      <section className="screen screen--summary" data-screen="summary" aria-labelledby="run-summary-empty-title">
        <ScreenHead
          kicker="The week · Run I"
          title="No run yet."
          titleId="run-summary-empty-title"
          sub="A run summary appears after seven days have been recorded."
          meta={
            <Button variant="secondary" size="sm" onClick={() => navigate({ name: 'home' })}>
              Go to camp
            </Button>
          }
        />
      </section>
    )
  }

  if (run.status !== 'closed' || !run.summary) {
    const days = run.days.filter((day) => day.status === 'completed' || day.status === 'missed').length
    const spent = !currentDay(run)
    return (
      <section className="screen screen--summary" data-screen="summary" aria-labelledby="run-summary-open-title">
        <ScreenHead
          kicker="The week · Run I"
          title={spent ? 'No day remains.' : 'The week is still open.'}
          titleId="run-summary-open-title"
          sub={
            spent
              ? 'Every day has been recorded. The weekly close is not available yet.'
              : 'The weekly bonus and final totals are sealed after the seventh day.'
          }
          meta={<span className="chip chip--quiet">{days} of 7 days recorded</span>}
        />
        <div className="summary-wrap">
          <Panel framed className="summary-page">
            <div className="empty-state">
              <span className="empty-state__medallion">
                <Icon name="spire" />
              </span>
              <span className="micro">The week</span>
              <h2>{spent ? 'The week has no open day.' : 'Nothing is sealed yet.'}</h2>
              <p>
                {spent
                  ? 'The record is kept. Run close and weekly bonuses arrive in a later release.'
                  : 'Keep the path, or return to camp and continue the current day.'}
              </p>
              <Button variant="secondary" onClick={() => navigate({ name: 'home' })}>
                Return to camp
                <Icon name="chevron-right" />
              </Button>
            </div>
          </Panel>
        </div>
      </section>
    )
  }

  const daysRecorded = run.days.filter(
    (day) => day.status === 'completed' || day.status === 'missed',
  ).length

  return (
    <section className="screen screen--summary" data-screen="summary" aria-labelledby="run-summary-title">
      <ScreenHead
        kicker="The week · Run I"
        title="The week is sealed."
        titleId="run-summary-title"
        sub="Each day is recorded. The rewards, the aims and the path stay with your profile."
        meta={<span className="chip chip--quiet">{daysRecorded} of 7 days</span>}
      />
      <SummaryBody
        run={run}
        summary={run.summary}
        days={daysRecorded}
        onNewRun={() => {
          startRun()
          if (useAppStore.getState().document.run?.status === 'active') {
            navigate({ name: 'map' })
          }
        }}
        onCamp={() => navigate({ name: 'home' })}
      />
    </section>
  )
}
