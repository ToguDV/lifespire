import { useEffect, useState } from 'react'
import { OBJECTIVE_BONUS } from '../../domain/balance'
import { currentDay, xpIntoLevel, xpToNextLevel } from '../../domain/selectors'
import type { Run } from '../../domain/types'
import { useAppStore } from '../../state/store'
import {
  AimRow,
  Button,
  DayPips,
  EmptyLootCard,
  Icon,
  LootCard,
  Panel,
  Progress,
  ScreenHead,
  Stat,
  StatStrip,
} from '../components'
import { goalIcon, percent, romanDay } from '../lib/format'
import {
  allAimsBonusCopy,
  duplicateGoldCopy,
  guaranteedRareCopy,
  objectiveAggregate,
  objectiveBonusCopy,
  weeklyBonusTotalCopy,
} from '../lib/runSummary'
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
  const profile = useAppStore((state) => state.document.profile)
  const goals = useAppStore((state) => state.document.goals)
  if (!summary) return null

  const aggregate = objectiveAggregate(summary.objectives)
  const totals = summary.totals
  const daysRecorded = totals.daysPlayed + totals.daysMissed
  const steps = totals.nodesCompleted + totals.nodesSkipped

  return (
    <div className="summary-wrap">
      <Panel framed className="summary-page summary-page--run">
        <header className="summary-head">
          <div className="summary-head__copy">
            <span className="micro">The week · Run I · Sealed</span>
            <h2>
              {summary.allComplete
                ? 'Every aim kept. The spire answers.'
                : 'A week written in small promises.'}
            </h2>
            <p>
              {profile?.name ?? 'The traveller'}, every page is recorded. The totals
              below are already part of your profile.
            </p>
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
            <span className="mini-note">
              {daysRecorded} of 7 days · {steps} steps
            </span>
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
          <p className="panel-note summary-run-note">
            {totals.daysMissed > 0
              ? `${totals.daysMissed} ${totals.daysMissed === 1 ? 'day was' : 'days were'} missed. Missed days are recorded without blocking the close and are not recovered.`
              : 'Every day reached a close. No day was missed this week.'}
            {totals.nodesSkipped > 0
              ? ` ${totals.nodesSkipped} ${totals.nodesSkipped === 1 ? 'step was' : 'steps were'} skipped and earned nothing.`
              : ''}
          </p>
        </section>

        <div className="summary-totals" aria-label="Run totals">
          <div className="total">
            <strong>
              <Icon name="star" />+{totals.xp}
            </strong>
            <span>Experience</span>
          </div>
          <div className="total">
            <strong>
              <Icon name="coin" />+{totals.gold}
            </strong>
            <span>Gold</span>
          </div>
          <div className="total">
            <strong>
              <Icon name="gem" />+{totals.lootCount}
            </strong>
            <span>Relics</span>
          </div>
        </div>
        <p className="panel-note summary-totals-note">
          These totals include every node reward and the weekly bonus. The bonus was
          granted once, when the week closed; reading this page again never adds it a
          second time.
        </p>

        <section className="summary-loot summary-aims-block" aria-labelledby="run-aims-title">
          <div className="section-block__head">
            <h2 id="run-aims-title">Weekly aims</h2>
            <span className="mini-note">
              {aggregate.met} of {aggregate.total} kept
              {aggregate.total > 0 ? ` · ${aggregate.progress} / ${aggregate.target}` : ''}
            </span>
          </div>
          {aggregate.total === 0 ? (
            <p className="panel-note">
              No weekly aims were set for this run. The close is still valid; only the
              recorded node rewards apply.
            </p>
          ) : (
            <ul className="summary-aims">
              {summary.objectives.map((objective) => (
                <li className="summary-aim" key={objective.goalId}>
                  <AimRow
                    title={objective.title}
                    progress={objective.progress}
                    target={objective.target}
                    icon={goalIcon(
                      goals.findIndex((goal) => goal.id === objective.goalId),
                    )}
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

        <section className="summary-loot summary-bonus-block" aria-labelledby="run-bonus-title">
          <div className="section-block__head">
            <h2 id="run-bonus-title">How the weekly bonus was earned</h2>
            <span className="mini-note">Granted once</span>
          </div>

          <div className={`summary-bonus${aggregate.met > 0 ? '' : ' is-forfeited'}`}>
            <span className="summary-bonus__icon">
              <Icon name={aggregate.met > 0 ? 'check' : 'lock'} />
            </span>
            <div className="summary-bonus__body">
              <span className="micro">Each aim kept</span>
              <strong>
                +{aggregate.bonusXp} XP · +{aggregate.bonusGold} gold
              </strong>
              <p>
                {aggregate.met > 0
                  ? `${aggregate.met} kept ${aggregate.met === 1 ? 'aim grants' : 'aims grant'} +${OBJECTIVE_BONUS.xp} XP, +${OBJECTIVE_BONUS.gold} gold and one loot roll each.`
                  : 'No weekly aim was kept, so no per-aim bonus was granted.'}
              </p>
            </div>
          </div>

          <div className={`summary-bonus${summary.allComplete ? '' : ' is-forfeited'}`}>
            <span className="summary-bonus__icon">
              <Icon name={summary.allComplete ? 'crown' : 'lock'} />
            </span>
            <div className="summary-bonus__body">
              <span className="micro">All aims kept</span>
              <strong>{allAimsBonusCopy(summary.allComplete)}</strong>
              <p>
                {summary.allComplete
                  ? 'This is the extra all-aims bonus on top of the per-aim bonuses, with one guaranteed rare from the rare pool.'
                  : aggregate.total === 0
                    ? 'No weekly aims were set, so the all-aims bonus was not available this week.'
                    : `${aggregate.total - aggregate.met} of ${aggregate.total} aims still open. Keep every aim in a future run to earn this bonus.`}
              </p>
            </div>
          </div>

          {summary.allComplete ? (
            <p className="summary-wait-note summary-rare-note">
              <Icon name="gem" />
              <span>{guaranteedRareCopy(summary.allComplete, summary.guaranteedRare)}</span>
            </p>
          ) : null}

          <div className="level-up summary-bonus-total">
            <Icon name="star" />
            <span>
              Weekly bonus total · {weeklyBonusTotalCopy(summary)}. This is the amount
              already added to your profile.
            </span>
          </div>
        </section>

        <section className="summary-loot" aria-labelledby="run-loot-title">
          <div className="section-block__head">
            <h2 id="run-loot-title">Relics found at the close</h2>
            <span className="mini-note">
              {summary.loot.length} {summary.loot.length === 1 ? 'relic' : 'relics'}
            </span>
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
          <p className="panel-note summary-duplicates">
            {duplicateGoldCopy(summary.duplicateGold)}
          </p>
          {summary.loot.length === 0 ? (
            <p className="panel-note">
              Weekly loot rolls can still be earned; they are shown here only when
              they become new relics.
            </p>
          ) : null}
        </section>

        <div className="level-up summary-profile-line">
          <Icon name="star" />
          <span>
            {profile?.name ?? 'The traveller'} · Level {profile?.level ?? 1} ·{' '}
            {profile ? xpIntoLevel(profile.xp) : 0} / 100 into this level ·{' '}
            {profile ? xpToNextLevel(profile.xp) : 100} to the next
          </span>
        </div>

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

        <p className="summary-wait-note">
          <Icon name="lock" />
          <span>
            A new run retires this week’s record but keeps your profile, level, XP,
            gold and collection. You can review the new weekly aims before it begins.
          </span>
        </p>
      </Panel>
    </div>
  )
}

function OpenWeek({ run, onCamp }: { run: Run; onCamp: () => void }) {
  const goals = useAppStore((state) => state.document.goals)
  const current = currentDay(run)
  const recorded = run.days.filter(
    (day) => day.status === 'completed' || day.status === 'missed',
  ).length
  const met = run.objectives.filter(
    (objective) => objective.progress >= objective.target,
  ).length
  const total = run.objectives.length
  const dayLabel = current ? `Day ${current.index + 1} of 7` : 'No open day'

  return (
    <div className="summary-wrap">
      <Panel framed className="summary-page summary-page--run">
        <header className="summary-head">
          <div className="summary-head__copy">
            <span className="micro">The week · Run I · In progress</span>
            <h2>The week is still unfolding.</h2>
            <p>
              The weekly bonus is sealed after the seventh day. Nothing is closed or
              granted from this page.
            </p>
          </div>
          <div className="seal" aria-label="Week in progress">
            <span className="seal__inner">
              <Icon name="compass" />
              <strong>{romanDay(6)}</strong>
              <span>week</span>
            </span>
          </div>
        </header>

        <div className="summary-run-record">
          <StatStrip label="Week progress">
            <Stat
              value={`${recorded} / 7`}
              label="Days recorded"
              progress={percent(recorded, 7)}
            />
            <Stat
              value={`${met} / ${total}`}
              label="Aims kept"
              progress={percent(met, Math.max(1, total))}
            />
            <Stat
              value={dayLabel}
              label="Current day"
              progress={current ? percent(current.index + 1, 7) : 0}
            />
          </StatStrip>
          <div className="summary-open-progress">
            <Progress
              value={recorded}
              max={7}
              label={`${recorded} of 7 days recorded`}
              showLabel
            />
            <DayPips
              days={run.days}
              currentIndex={current?.index}
              label={dayLabel}
            />
          </div>
        </div>

        <section className="summary-loot summary-aims-block" aria-labelledby="open-aims-title">
          <div className="section-block__head">
            <h2 id="open-aims-title">Weekly aims</h2>
            <span className="mini-note">
              {met} of {total} kept
            </span>
          </div>
          {total === 0 ? (
            <p className="panel-note">No weekly aims were set for this run.</p>
          ) : (
            <ul className="summary-aims">
              {run.objectives.map((objective) => (
                <li className="summary-aim" key={objective.goalId}>
                  <AimRow
                    title={objective.goalTitle}
                    progress={objective.progress}
                    target={objective.target}
                    icon={goalIcon(
                      goals.findIndex((goal) => goal.id === objective.goalId),
                    )}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="summary-wait-note">
          <Icon name="compass" />
          <span>
            The final totals, bonus and loot appear only when the run closes. Return
            to camp to continue today’s path.
          </span>
        </p>

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
          kicker="The week · Run I"
          title="Sealing the week."
          titleId="run-summary-sealing-title"
          sub="The weekly bonus is calculated from the recorded days and aims."
          meta={<span className="chip chip--quiet">One moment</span>}
        />
        <div className="summary-wrap">
          <Panel framed className="summary-page">
            <div className="empty-state">
              <span className="empty-state__medallion">
                <Icon name="crown" />
              </span>
              <span className="micro">The close</span>
              <h2>Reading the week’s record.</h2>
              <p>
                The summary is being sealed. This happens once; reloading will not
                grant the bonus again.
              </p>
            </div>
          </Panel>
        </div>
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
          kicker="The week · Run I"
          title="The week is still unfolding."
          titleId="run-summary-open-title"
          sub="The weekly bonus, loot and final totals are sealed after the seventh day."
          meta={<span className="chip chip--quiet">In progress</span>}
        />
        <OpenWeek run={run} onCamp={() => navigate({ name: 'home' })} />
      </section>
    )
  }

  const daysRecorded =
    run.summary.totals.daysPlayed + run.summary.totals.daysMissed

  return (
    <section
      className="screen screen--summary"
      data-screen="summary"
      aria-labelledby="run-summary-title"
    >
      <ScreenHead
        kicker="The week · Run I · Sealed"
        title="The week is sealed."
        titleId="run-summary-title"
        sub="Each day is recorded. The rewards, the aims and the path stay with your profile."
        meta={
          <>
            <span className="chip chip--quiet">{daysRecorded} of 7 days</span>
            <span className="chip chip--accent">
              <Icon name="crown" />
              Run closed
            </span>
          </>
        }
      />
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
