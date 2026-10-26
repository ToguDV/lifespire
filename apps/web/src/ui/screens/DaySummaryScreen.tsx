import { useEffect } from 'react'
import { levelForXp } from '../../domain/selectors'
import type { Day, DaySummary } from '../../domain/types'
import { useAppStore } from '../../state/store'
import {
  AimRow,
  AnimatedNumber,
  Button,
  Icon,
  LootCard,
  Panel,
  ScreenHead,
} from '../components'
import { buildDayPath, dayPathReward } from '../lib/daySummary'
import { lootFeedbackKind } from '../lib/resolveFeedback'
import { playFeedback } from '../lib/feedback'
import {
  NODE_TYPE_ICON,
  NODE_TYPE_LABEL,
  formatDayKey,
  goalIconFor,
  romanDay,
} from '../lib/format'

function SummaryBody({
  day,
  summary,
  runClosed,
  onHome,
  onRunSummary,
}: {
  day: Day
  summary: DaySummary
  runClosed: boolean
  onHome: () => void
  onRunSummary: () => void
}) {
  const profile = useAppStore((state) => state.document.profile)
  const goals = useAppStore((state) => state.document.goals)
  const rows = buildDayPath(day)
  const waitNoteId = 'day-summary-wait-note'
  const leveledUp = profile
    ? levelForXp(profile.xp) > levelForXp(Math.max(0, profile.xp - summary.xp))
    : false

  // New relics shimmer once, the first time the sealed day is read. The
  // session flag keeps reloads and revisits quiet.
  useEffect(() => {
    if (summary.loot.length === 0) return
    const key = `lifespire:sealed:${day.id}`
    try {
      if (window.sessionStorage.getItem(key)) return
      window.sessionStorage.setItem(key, 'played')
    } catch {
      return
    }
    const timers = summary.loot.slice(0, 4).map((item, index) =>
      window.setTimeout(() => playFeedback(lootFeedbackKind(item.rarity)), 250 + index * 220),
    )
    return () => {
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [day.id, summary.loot])

  return (
    <div className="summary-wrap">
      <Panel framed className="summary-page">
        <header className="summary-head">
          <div className="summary-head__copy">
            <span className="micro">Day {day.index + 1} of 7 · Sealed</span>
            <h1 id="summary-title">The day is sealed.</h1>
            <div className="summary-head__chips">
              <span className="chip chip--quiet">
                <Icon name="compass" />
                {formatDayKey(day.date)}
              </span>
              <span className={`chip ${summary.bossCompleted ? 'chip--accent' : 'chip--quiet'}`}>
                <Icon name={summary.bossCompleted ? 'crown' : 'lock'} />
                {summary.bossCompleted ? 'Boss completed' : 'Boss skipped'}
              </span>
            </div>
          </div>
          <div className="seal" aria-label={`Day ${day.index + 1} seal`}>
            <span className="seal__inner">
              <Icon name="spire" />
              <strong>{romanDay(day.index)}</strong>
              <span>day</span>
            </span>
          </div>
        </header>

        <ol className="summary-path" aria-label="Path taken">
          {rows.length === 0 ? (
            <li className="panel-note">No steps were recorded on this day.</li>
          ) : (
            rows.map((row, index) => {
              const done = row.action === 'complete'
              return (
                <li
                  className={`path-row ${done ? 'is-done' : 'is-skipped'} path-row--enter`}
                  style={{ animationDelay: `${Math.min(index, 10) * 45}ms` }}
                  key={row.nodeId}
                >
                  <span className={`path-row__medallion ${done ? 'is-done' : 'is-skipped'}`}>
                    <Icon name={NODE_TYPE_ICON[row.type]} />
                  </span>
                  <span className="path-row__body">
                    <strong>{row.title}</strong>
                    <span>
                      {NODE_TYPE_LABEL[row.type]}
                      {row.goalTitle ? ` · ${row.goalTitle}` : ''}
                      {' · '}
                      {done ? 'Completed' : 'Skipped'}
                    </span>
                  </span>
                  <span className="path-row__rewards">
                    <span className="path-row__reward">
                      {dayPathReward(row)}
                    </span>
                    {row.duplicateGold > 0 ? (
                      <span className="path-row__loot">
                        incl. +{row.duplicateGold} g duplicate
                      </span>
                    ) : null}
                  </span>
                </li>
              )
            })
          )}
        </ol>

        <p className="panel-note">
          {summary.bossCompleted
            ? `Includes boss closing bonus +${summary.closingBonusXp} XP · +${summary.closingBonusGold} gold.`
            : 'Boss skipped: no closing bonus.'}
        </p>

        <div className="summary-totals" aria-label="Rewards earned">
          <div className="total">
            <strong>
              <Icon name="star" />+<AnimatedNumber value={summary.xp} />
            </strong>
            <span>Experience</span>
          </div>
          <div className="total">
            <strong>
              <Icon name="coin" />+<AnimatedNumber value={summary.gold} />
            </strong>
            <span>Gold</span>
          </div>
          <div className="total">
            <strong>
              <Icon name="gem" />+<AnimatedNumber value={summary.loot.length} />
            </strong>
            <span>Relics</span>
          </div>
        </div>

        <div className="summary-aims">
          {summary.objectives.map((objective) => (
            <div className="summary-aim" key={objective.goalId}>
              <AimRow
                title={objective.title}
                progress={objective.after}
                target={objective.target}
                icon={goalIconFor(goals, objective.goalId) ?? 'banner'}
              />
              <p className="summary-aim__bonus">
                {objective.after >= objective.target
                  ? 'Target met'
                  : `${objective.target - objective.after} to go`}
              </p>
            </div>
          ))}
        </div>

        <section className="summary-loot" aria-labelledby="day-loot-title">
          <div className="section-block__head">
            <h2 id="day-loot-title">Found today</h2>
            {summary.loot.length > 0 ? (
              <span className="mini-note">
                {summary.loot.length} {summary.loot.length === 1 ? 'relic' : 'relics'}
              </span>
            ) : null}
          </div>
          {summary.loot.length === 0 ? (
            <p className="panel-note">No relics today.</p>
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

        {profile && leveledUp ? (
          <div className="level-up level-up--celebrate">
            <Icon name="star" />
            <span>Level {profile.level} reached.</span>
          </div>
        ) : null}

        <div className="summary-actions">
          <Button variant="primary" onClick={onHome}>
            Return to camp
            <Icon name="chevron-right" />
          </Button>
          {runClosed ? (
            <Button variant="quiet" onClick={onRunSummary}>
              Read the week
            </Button>
          ) : (
            <Button
              variant="quiet"
              disabled
              aria-describedby={waitNoteId}
              title="The next path opens at midnight."
            >
              Wait for tomorrow
            </Button>
          )}
        </div>

        {!runClosed ? (
          <span className="sr-only" id={waitNoteId}>
            The next path opens at midnight.
          </span>
        ) : null}
      </Panel>
    </div>
  )
}

export function DaySummaryScreen({ dayId }: { dayId: string }) {
  const run = useAppStore((state) => state.document.run)
  const navigate = useAppStore((state) => state.navigate)

  const day = run?.days.find((item) => item.id === dayId) ?? null
  const summary = day?.summary ?? null

  useEffect(() => {
    if (!run || !day) navigate({ name: 'home' })
  }, [run, day, navigate])

  if (!run || !day) {
    return (
      <section
        className="screen screen--summary"
        data-screen="summary"
        aria-labelledby="summary-missing-title"
      >
        <ScreenHead
          kicker="Day summary"
          title="Returning to camp."
          titleId="summary-missing-title"
          sub="That day is not part of this run."
          meta={
            <Button variant="secondary" onClick={() => navigate({ name: 'home' })}>
              Return to camp
              <Icon name="chevron-right" />
            </Button>
          }
        />
      </section>
    )
  }

  if (!summary) {
    const missed = day.status === 'missed'
    return (
      <section
        className="screen screen--summary"
        data-screen="summary"
        aria-labelledby="summary-open-title"
      >
        <ScreenHead
          kicker={`Day ${day.index + 1} · ${missed ? 'Missed' : 'Open'}`}
          title={missed ? 'The day passed unclaimed.' : 'The day is still open.'}
          titleId="summary-open-title"
          sub={
            missed
              ? 'No summary was sealed for this day.'
              : 'Complete the daily boss to seal the day.'
          }
          meta={
            <>
              <span className="chip chip--quiet">{formatDayKey(day.date)}</span>
              <Button
                variant="secondary"
                onClick={() => navigate({ name: missed ? 'home' : 'map' })}
              >
                {missed ? 'Return to camp' : 'Return to map'}
                <Icon name="chevron-right" />
              </Button>
            </>
          }
        />
      </section>
    )
  }

  return (
    <section className="screen screen--summary" data-screen="summary" aria-labelledby="summary-title">
      <SummaryBody
        day={day}
        summary={summary}
        runClosed={run.status === 'closed'}
        onHome={() => navigate({ name: 'home' })}
        onRunSummary={() => navigate({ name: 'run-summary' })}
      />
    </section>
  )
}
