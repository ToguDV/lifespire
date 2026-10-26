import { useEffect, useState } from 'react'
import { currentDay } from '../../domain/selectors'
import type { Run } from '../../domain/types'
import { useAppStore } from '../../state/store'
import {
  AimRow,
  AnimatedNumber,
  Button,
  DayPips,
  EmptyLootCard,
  Icon,
  LootCard,
  Panel,
  ScreenHead,
  Stat,
  StatStrip,
} from '../components'
import { goalIconFor, percent, romanDay } from '../lib/format'
import { playFeedback } from '../lib/feedback'
import { objectiveAggregate, objectiveBonusCopy } from '../lib/runSummary'
import { NewRunDialog } from './NewRunDialog'

function SealedBody({
  run,
  onNewRun,
  onCamp,
  onProfile,
}: {
  run: Run
  onNewRun: () => void
  onCamp: () => void
  onProfile: () => void
}) {
  const summary = run.summary
  const goals = useAppStore((state) => state.document.goals)

  // The weekly close shimmers once per session: seal, then the guaranteed
  // rare (or the first new relic) a beat later.
  useEffect(() => {
    if (!summary) return
    const key = `lifespire:sealed:week:${run.id}`
    try {
      if (window.sessionStorage.getItem(key)) return
      window.sessionStorage.setItem(key, 'played')
    } catch {
      return
    }
    const timers = [
      window.setTimeout(() => playFeedback('seal'), 200),
      window.setTimeout(
        () => playFeedback(summary.guaranteedRare ? 'lootEpic' : 'lootRare'),
        550,
      ),
    ]
    return () => {
      for (const timer of timers) window.clearTimeout(timer)
    }
    // The summary object is stable once sealed; the run id is the key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.id])

  if (!summary) return null

  const aggregate = objectiveAggregate(summary.objectives)
  const totals = summary.totals
  const steps = totals.nodesCompleted + totals.nodesSkipped

  return (
    <div className="summary-wrap">
      <Panel framed className="summary-page summary-page--run">
        <header className="summary-head">
          <div className="summary-head__copy">
            <span className="micro">The week · Sealed</span>
            <h1 id="run-summary-title">The week is sealed.</h1>
          </div>
          <div className="seal" aria-label="Week seal">
            <span className="seal__inner">
              <Icon name="spire" />
              <strong>{romanDay(6)}</strong>
              <span>week</span>
            </span>
          </div>
        </header>

        <section className="summary-run-record" aria-labelledby="run-record-title">
          <div className="section-block__head">
            <h2 id="run-record-title">The week recorded</h2>
          </div>
          <StatStrip label="Run record">
            <Stat
              value={totals.daysPlayed}
              label="Days played"
              progress={percent(totals.daysPlayed, 7)}
            />
            <Stat
              value={totals.daysMissed}
              label="Days missed"
              progress={percent(totals.daysMissed, 7)}
            />
            <Stat
              value={totals.nodesCompleted}
              label="Steps kept"
              progress={percent(totals.nodesCompleted, Math.max(1, steps))}
            />
          </StatStrip>
        </section>

        <div className="summary-totals" aria-label="Run totals">
          <div className="total">
            <strong>
              <Icon name="star" />+<AnimatedNumber value={totals.xp} />
            </strong>
            <span>Experience</span>
          </div>
          <div className="total">
            <strong>
              <Icon name="coin" />+<AnimatedNumber value={totals.gold} />
            </strong>
            <span>Gold</span>
          </div>
          <div className="total">
            <strong>
              <Icon name="gem" />+<AnimatedNumber value={totals.lootCount} />
            </strong>
            <span>Relics</span>
          </div>
        </div>
        <p className="panel-note">
          Weekly bonus included: +{summary.bonusXp} XP · +{summary.bonusGold} gold.
        </p>

        <section className="summary-loot summary-aims-block" aria-labelledby="run-aims-title">
          <div className="section-block__head">
            <h2 id="run-aims-title">Weekly goals</h2>
            <span className="mini-note">
              {aggregate.met} of {aggregate.total} kept
              {aggregate.total > 0 ? ` · ${aggregate.progress} / ${aggregate.target}` : ''}
            </span>
          </div>
          {aggregate.total === 0 ? (
            <p className="panel-note">No weekly goals were set for this run.</p>
          ) : (
            <ul className="summary-aims">
              {summary.objectives.map((objective, index) => (
                <li
                  className="summary-aim summary-aim--enter"
                  style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
                  key={objective.goalId}
                >
                  <AimRow
                    title={objective.title}
                    progress={objective.progress}
                    target={objective.target}
                    icon={goalIconFor(goals, objective.goalId) ?? 'banner'}
                  />
                  <p className="summary-aim__bonus">
                    {objectiveBonusCopy(objective)}
                  </p>
                  {objective.met && objective.loot.length > 0 ? (
                    <p className="summary-aim__loot">
                      Found: {objective.loot.map((item) => item.name).join(', ')}
                    </p>
                  ) : objective.met ? (
                    <p className="summary-aim__loot">
                      The loot roll became gold; the relic was already owned.
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="summary-loot" aria-labelledby="run-loot-title">
          <div className="section-block__head">
            <h2 id="run-loot-title">Relics found at the close</h2>
            {summary.loot.length > 0 ? (
              <span className="mini-note">
                {summary.loot.length} {summary.loot.length === 1 ? 'relic' : 'relics'}
              </span>
            ) : null}
          </div>
          {summary.loot.length === 0 ? (
            <div className="loot-grid">
              <EmptyLootCard label="No new relic this week" />
            </div>
          ) : (
            <div className="loot-grid">
              {summary.loot.map((item) => (
                <LootCard item={item} key={item.id} />
              ))}
            </div>
          )}
          {summary.duplicateGold > 0 ? (
            <p className="panel-note summary-duplicates">
              Duplicates converted into {summary.duplicateGold} gold.
            </p>
          ) : null}
        </section>

        <div className="summary-actions">
          <Button variant="primary" onClick={onNewRun}>
            Begin a new run
            <Icon name="chevron-right" />
          </Button>
          <Button variant="quiet" onClick={onProfile}>
            <Icon name="gem" />
            View the Reliquary
          </Button>
          <Button variant="quiet" onClick={onCamp}>
            Return to camp
          </Button>
        </div>
      </Panel>
    </div>
  )
}

function OpenWeek({ run, onCamp }: { run: Run; onCamp: () => void }) {
  const goals = useAppStore((state) => state.document.goals)
  const current = currentDay(run)
  const met = run.objectives.filter(
    (objective) => objective.progress >= objective.target,
  ).length
  const total = run.objectives.length
  const dayLabel = current ? `Day ${current.index + 1} of 7` : 'No open day'

  return (
    <div className="summary-wrap">
      <Panel framed className="summary-page summary-page--run">
        <div className="summary-run-record">
          <DayPips days={run.days} currentIndex={current?.index} label={dayLabel} />
        </div>

        <section className="summary-loot summary-aims-block" aria-labelledby="open-aims-title">
          <div className="section-block__head">
            <h2 id="open-aims-title">Weekly goals</h2>
            <span className="mini-note">
              {met} of {total} kept
            </span>
          </div>
          {total === 0 ? (
            <p className="panel-note">No weekly goals were set for this run.</p>
          ) : (
            <ul className="summary-aims">
              {run.objectives.map((objective) => (
                <li className="summary-aim" key={objective.goalId}>
                  <AimRow
                    title={objective.goalTitle}
                    progress={objective.progress}
                    target={objective.target}
                    icon={goalIconFor(goals, objective.goalId) ?? 'banner'}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="summary-actions">
          <Button variant="primary" onClick={onCamp}>
            Return to camp
            <Icon name="chevron-right" />
          </Button>
        </div>
      </Panel>
    </div>
  )
}

export function RunSummaryScreen() {
  const run = useAppStore((state) => state.document.run)
  const finalizeRun = useAppStore((state) => state.finalizeRun)
  const navigate = useAppStore((state) => state.navigate)
  const [newRunOpen, setNewRunOpen] = useState(false)

  const needsFinalize = run?.status === 'closed' && run.summary === null

  useEffect(() => {
    if (!run) navigate({ name: 'home' })
  }, [run, navigate])

  useEffect(() => {
    if (needsFinalize) finalizeRun()
  }, [needsFinalize, finalizeRun])

  if (!run) {
    return (
      <section
        className="screen screen--summary"
        data-screen="summary"
        aria-labelledby="run-summary-empty-title"
      >
        <ScreenHead
          kicker="The week"
          title="Returning to camp."
          titleId="run-summary-empty-title"
          sub="A run summary appears after a seven-day run has been recorded."
          meta={
            <Button variant="secondary" size="sm" onClick={() => navigate({ name: 'home' })}>
              Go to camp
            </Button>
          }
        />
      </section>
    )
  }

  if (run.status === 'closed' && run.summary === null) {
    return (
      <section
        className="screen screen--summary"
        data-screen="summary"
        aria-labelledby="run-summary-sealing-title"
      >
        <ScreenHead
          kicker="The week"
          title="Sealing the week."
          titleId="run-summary-sealing-title"
          sub="The weekly bonus is being calculated."
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
    return (
      <section
        className="screen screen--summary"
        data-screen="summary"
        aria-labelledby="run-summary-open-title"
      >
        <ScreenHead
          kicker="The week · In progress"
          title="The week is still open."
          titleId="run-summary-open-title"
          sub="Final totals seal after the seventh day."
        />
        <OpenWeek run={run} onCamp={() => navigate({ name: 'home' })} />
      </section>
    )
  }

  return (
    <section
      className="screen screen--summary"
      data-screen="summary"
      aria-labelledby="run-summary-title"
    >
      <SealedBody
        run={run}
        onNewRun={() => setNewRunOpen(true)}
        onCamp={() => navigate({ name: 'home' })}
        onProfile={() => navigate({ name: 'profile' })}
      />
      {newRunOpen ? <NewRunDialog onClose={() => setNewRunOpen(false)} /> : null}
    </section>
  )
}
