import { useEffect } from 'react'
import { levelForXp, xpIntoLevel, xpToNextLevel } from '../../domain/selectors'
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
import {
  buildDayPath,
  closingBonusCopy,
  dayPathReward,
} from '../lib/daySummary'
import { lootFeedbackKind } from '../lib/resolveFeedback'
import { playFeedback } from '../lib/feedback'
import {
  NODE_TYPE_ICON,
  NODE_TYPE_LABEL,
  formatDayKey,
  goalIconFor,
  romanDay,
} from '../lib/format'

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
            <span className="micro">Day {day.index + 1} of 7 · The path taken</span>
            <h2>
              {summary.bossCompleted
                ? 'A quiet climb, kept to the end.'
                : 'A day left open at the gate.'}
            </h2>
            <p>
              {summary.bossCompleted
                ? 'The gate was kept. Rewards are sealed with the day.'
                : 'The gate was skipped. The day is sealed without its closing bonus.'}
            </p>
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

        <div
          className={`summary-bonus ${summary.bossCompleted ? '' : 'is-forfeited'}`}
          aria-label="Boss closing bonus"
        >
          <span className="summary-bonus__icon">
            <Icon name={summary.bossCompleted ? 'crown' : 'lock'} />
          </span>
          <div className="summary-bonus__body">
            <span className="micro">Boss closing bonus</span>
            <strong>{closingBonusCopy(summary.bossCompleted, summary.closingBonusXp, summary.closingBonusGold)}</strong>
            <p>
              {summary.bossCompleted
                ? 'Granted once when the boss is completed. It is already included in the boss reward and the day total.'
                : 'The boss was skipped. Skipping grants no XP, gold, loot or weekly progress.'}
            </p>
          </div>
        </div>

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
                Before {objective.before} / {objective.target} → after {objective.after} /{' '}
                {objective.target}
                {objective.after >= objective.target
                  ? ' · target met'
                  : ` · ${objective.target - objective.after} to go`}
              </p>
            </div>
          ))}
        </div>

        <section className="summary-loot" aria-labelledby="day-loot-title">
          <div className="section-block__head">
            <h2 id="day-loot-title">Found today</h2>
            <span className="mini-note">
              {summary.loot.length} {summary.loot.length === 1 ? 'relic' : 'relics'}
            </span>
          </div>
          {summary.loot.length === 0 ? (
            <p className="panel-note">
              No relics were found. Elite, treasure and boss steps carry a loot roll.
            </p>
          ) : (
            <div className="loot-grid">
              {summary.loot.map((item) => (
                <LootCard item={item} key={item.id} />
              ))}
            </div>
          )}
          {summary.duplicateGold > 0 ? (
            <p className="panel-note summary-duplicates">
              Duplicates converted into {summary.duplicateGold} gold. This is already included in
              the gold total above.
            </p>
          ) : null}
        </section>

        {profile ? (
          <div className={`level-up${leveledUp ? ' level-up--celebrate' : ''}`}>
            <Icon name="star" />
            {leveledUp ? (
              <span>
                Level {profile.level} — the ascent deepens. {xpIntoLevel(profile.xp)} / 100
                into this level · {xpToNextLevel(profile.xp)} to go
              </span>
            ) : (
              <span>
                Level {profile.level} · {xpIntoLevel(profile.xp)} / 100 to the next ·{' '}
                {xpToNextLevel(profile.xp)} to go
              </span>
            )}
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
          <p className="summary-wait-note" id={waitNoteId}>
            <Icon name="moon" />
            <span>
              The next path opens at midnight. Only the current day can be played, so tomorrow
              waits for the clock.
            </span>
          </p>
        ) : (
          <p className="summary-wait-note">
            <Icon name="crown" />
            <span>
              Every day in this run is sealed. The weekly totals are ready to read.
            </span>
          </p>
        )}
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
        />
        <EmptySummary
          title="No matching day."
          copy="The seven days of a run are fixed when it begins. Return to camp and choose a day from the current run."
          action={() => navigate({ name: 'home' })}
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
              ? 'No path reached the boss, so no day summary was sealed. Missed days are not recovered.'
              : 'Complete the daily boss to seal the day and record its rewards.'
          }
          meta={<span className="chip chip--quiet">{formatDayKey(day.date)}</span>}
        />
        <EmptySummary
          title={missed ? 'No page was sealed.' : 'The page is still blank.'}
          copy={
            missed
              ? 'The day is recorded as missed. The run continues with the next day at midnight.'
              : 'This day has not been sealed. Return to the map and finish the path when you are ready.'
          }
          action={() => navigate({ name: missed ? 'home' : 'map' })}
          actionLabel={missed ? 'Return to camp' : 'Return to map'}
        />
      </section>
    )
  }

  const bossLabel = summary.bossCompleted ? 'Boss completed' : 'Boss skipped'
  const bossIcon = summary.bossCompleted ? 'crown' : 'lock'
  const stepCount = day.map ? day.map.layers.length + 1 : day.path.length

  return (
    <section className="screen screen--summary" data-screen="summary" aria-labelledby="summary-title">
      <ScreenHead
        kicker={`Day ${day.index + 1} · Sealed`}
        title="The day is sealed."
        titleId="summary-title"
        sub={
          summary.bossCompleted
            ? `${stepCount} steps, one path. The gate was kept and the rewards are already yours.`
            : `${stepCount} steps, one path. The gate was skipped, so its closing bonus was forfeited.`
        }
        meta={
          <>
            <span className="chip chip--quiet">
              <Icon name="compass" />
              {formatDayKey(day.date)}
            </span>
            <span className={`chip ${summary.bossCompleted ? 'chip--accent' : 'chip--quiet'}`}>
              <Icon name={bossIcon} />
              {bossLabel}
            </span>
          </>
        }
      />
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
