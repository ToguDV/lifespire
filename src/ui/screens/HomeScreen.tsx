import { currentDay, xpIntoLevel, xpToNextLevel } from '../../domain/selectors'
import type { Day, Run, RunObjective } from '../../domain/types'
import { useAppStore } from '../../state/store'
import {
  AimRow,
  Button,
  DayPips,
  Icon,
  Panel,
  PanelHead,
  ScreenHead,
  Stat,
  StatStrip,
} from '../components'
import { formatShortIsoDay, goalIcon, percent } from '../lib/format'

function WeekStrip({ run, current }: { run: Run; current: Day | null }) {
  return (
    <ol className="week-strip" aria-label="Seven-day run">
      {run.days.map((day) => {
        const isToday = current?.id === day.id
        const state = day.status === 'completed' ? 'is-done' : day.status === 'missed' ? 'is-missed' : isToday ? 'is-today' : 'is-locked'
        const label =
          day.status === 'completed'
            ? 'kept'
            : day.status === 'missed'
              ? 'missed'
              : isToday
                ? 'today'
                : 'ahead'
        return (
          <li key={day.id} className={`week-day ${state}`} aria-label={`Day ${day.index + 1}, ${label}`}>
            <strong>{day.index + 1}</strong>
            <span className="week-day__state" aria-hidden="true">
              {day.status === 'completed' ? (
                <Icon name="check" />
              ) : day.status === 'missed' ? (
                <span className="week-day__dash">–</span>
              ) : isToday ? (
                <span className="week-day__dot" />
              ) : (
                <Icon name="lock" />
              )}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function ObjectivesPanel({
  objectives,
  goals,
  onViewAll,
}: {
  objectives: RunObjective[]
  goals: ReturnType<typeof useAppStore.getState>['document']['goals']
  onViewAll: () => void
}) {
  const rows =
    objectives.length > 0
      ? objectives.map((objective) => ({
          key: objective.goalId,
          title: objective.goalTitle,
          progress: objective.progress,
          target: objective.target,
          icon: goalIcon(goals.findIndex((goal) => goal.id === objective.goalId)),
        }))
      : goals
          .filter((goal) => goal.active)
          .map((goal, index) => ({
            key: goal.id,
            title: goal.title,
            progress: 0,
            target: goal.weeklyObjective,
            icon: goalIcon(index),
          }))

  return (
    <Panel pad>
      <PanelHead
        label="Weekly aims"
        aside={
          <button type="button" className="text-link" onClick={onViewAll}>
            All aims
          </button>
        }
      />
      {rows.length === 0 ? (
        <p className="panel-note">No aims yet. They appear after onboarding.</p>
      ) : (
        rows.map((row) => (
          <AimRow
            key={row.key}
            title={row.title}
            progress={row.progress}
            target={row.target}
            icon={row.icon}
          />
        ))
      )}
    </Panel>
  )
}

export function HomeScreen() {
  const document = useAppStore((state) => state.document)
  const navigate = useAppStore((state) => state.navigate)
  const startRun = useAppStore((state) => state.startRun)

  const run = document.run
  const profile = document.profile
  const day = currentDay(run)
  const objectives = run?.objectives ?? []
  const activeGoals = document.goals.filter((goal) => goal.active)
  const aimCount = objectives.length > 0 ? objectives.length : activeGoals.length
  const goalsMet = objectives.filter((objective) => objective.progress >= objective.target).length
  const daysKept = run?.days.filter((item) => item.status === 'completed').length ?? 0
  const findings = profile?.loot.slice(-2).reverse() ?? []

  const kicker = run
    ? run.status === 'closed'
      ? 'Camp · The week is sealed'
      : day
        ? `Camp · Day ${day.index + 1} of 7`
        : 'Camp · The week is spent'
    : 'Camp · Before the run'

  const title =
    run?.status === 'closed'
      ? 'The week is sealed.'
      : run
        ? day
          ? 'The fire is lit.'
          : 'The week is spent.'
        : 'No run yet.'

  const sub =
    run?.status === 'closed'
      ? 'The path is recorded. Read the week, then begin again when you are ready.'
      : run
        ? day
          ? `Day ${day.index + 1} is ready. The map is still veiled; your aims and your week are already real.`
          : 'Every day has been recorded. The weekly summary is the next page.'
        : 'Your profile is ready. Begin a seven-day run when you feel ready to climb.'

  const screenMeta = run ? (
    <DayPips
      days={run.days}
      currentIndex={day?.index}
      label={day ? `Day ${day.index + 1} of 7` : 'No day remains'}
    />
  ) : null

  return (
    <section className="screen screen--camp" data-screen="camp" aria-labelledby="camp-title">
      <ScreenHead
        kicker={kicker}
        title={title}
        titleId="camp-title"
        sub={sub}
        meta={screenMeta}
      />

      <div className="camp-grid">
        <div className="camp-main">
          <article className="panel hero-panel">
            <div className="hero-panel__art" aria-hidden="true">
              <svg viewBox="0 0 340 190" preserveAspectRatio="xMidYMid slice">
                <g className="mini-map-line">
                  <path d="M-20 168c58-14 82 12 130 2s78-26 126-20 72 8 118 0" />
                  <path d="M-20 118c60-12 84 12 132 2s80-24 128-18 72 6 116-2" />
                  <path d="M-20 66c62-10 86 10 134 2s80-20 126-16 72 4 116-4" />
                </g>
                <path className="mini-map-path" d="M52 160c20-34 38-46 66-58s56-12 80-32 30-34 56-44" />
                <use href="#i-pine" x="34" y="128" width="17" height="17" className="hero-pine" />
                <use href="#i-pine" x="284" y="150" width="14" height="14" className="hero-pine" />
                <use href="#i-pine" x="294" y="56" width="16" height="16" className="hero-pine" />
                <circle cx="52" cy="160" r="10" fill="var(--ink)" />
                <use href="#i-tent" x="45" y="153" width="14" height="14" className="hero-glyph" />
                <circle cx="118" cy="102" r="10" fill="var(--ink)" />
                <use href="#i-check" x="112" y="96" width="12" height="12" className="hero-glyph" />
                <circle cx="198" cy="70" r="12" fill="var(--surface-raised)" stroke="var(--accent)" strokeWidth="1.6" />
                <use href="#i-scroll" x="190" y="62" width="16" height="16" className="hero-glyph-accent" />
                <circle cx="254" cy="26" r="14" fill="var(--surface-raised)" stroke="var(--hairline-strong)" strokeDasharray="2 4" />
                <use href="#i-crown" x="245" y="17" width="18" height="18" className="hero-glyph-soft" />
              </svg>
            </div>
            <div className="hero-panel__body">
              <span className="micro">
                {run?.status === 'closed' || (run && !day)
                  ? 'The week behind'
                  : run
                    ? "Today's path"
                    : 'The first step'}
              </span>
              <h2>
                {run?.status === 'closed'
                  ? 'A climb recorded'
                  : run
                    ? day
                      ? 'The path ahead'
                      : 'The week is spent'
                    : 'A quiet beginning'}
              </h2>
              <p>
                {run?.status === 'closed'
                  ? 'Every day is sealed and the totals are yours to keep.'
                  : run
                    ? day
                      ? 'The map will be drawn here once the day opens. Until then, the week waits without hurry.'
                      : 'No day can be opened now. The record of the week is still yours to read.'
                    : 'A seven-day run turns your routines into a path. Start when you are ready; nothing is lost by waiting.'}
              </p>
              <div className="hero-panel__meta">
                {run ? (
                  <>
                    <DayPips days={run.days} currentIndex={day?.index} />
                    <span>{day ? `Day ${day.index + 1} of 7` : 'No day remains'}</span>
                  </>
                ) : (
                  <span>Seven days · One path each</span>
                )}
              </div>
              {run?.status === 'closed' || (run && !day) ? (
                <Button variant="primary" onClick={() => navigate({ name: 'run-summary' })}>
                  Read the week
                  <Icon name="chevron-right" />
                </Button>
              ) : run ? (
                <div className="hero-panel__actions">
                  <Button variant="primary" onClick={() => navigate({ name: 'map' })}>
                    Continue the ascent
                    <Icon name="chevron-right" />
                  </Button>
                  <Button
                    variant="quiet"
                    className="week-summary-mobile"
                    onClick={() => navigate({ name: 'run-summary' })}
                  >
                    Week summary
                  </Button>
                </div>
              ) : (
                <Button variant="primary" onClick={() => startRun()}>
                  Begin a run
                  <Icon name="chevron-right" />
                </Button>
              )}
            </div>
          </article>

          <section className="section-block" aria-labelledby="finds-title">
            <div className="section-block__head">
              <h2 id="finds-title">Recent finds</h2>
              <button type="button" className="text-link" onClick={() => navigate({ name: 'profile' })}>
                Reliquary
              </button>
            </div>
            {findings.length === 0 ? (
              <p className="quiet-note">
                <Icon name="gem" />
                <span>Nothing found yet. Relics appear as you complete elite, treasure and boss steps.</span>
              </p>
            ) : (
              <div className="relic-row">
                {findings.map((item) => (
                  <div className="relic-mini" key={item.id}>
                    <span className="relic-mini__niche">
                      <Icon name="gem" />
                    </span>
                    <span className="relic-mini__body">
                      <strong>{item.name}</strong>
                      <small>
                        {item.rarity} · {formatShortIsoDay(item.obtainedAt)}
                      </small>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="section-block week-block" aria-labelledby="week-title">
            <div className="section-block__head">
              <h2 id="week-title">The week</h2>
              <div className="week-head-actions">
                <span className="mini-note">
                  {run ? (run.status === 'closed' ? 'Sealed' : 'Seven days') : 'Not begun'}
                </span>
                {run ? (
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => navigate({ name: 'run-summary' })}
                  >
                    Week summary
                  </button>
                ) : null}
              </div>
            </div>
            {run ? (
              <WeekStrip run={run} current={day} />
            ) : (
              <p className="quiet-note">
                <Icon name="moon" />
                <span>The week begins when you start a run.</span>
              </p>
            )}
          </section>

          <div className="quiet-note">
            <Icon name="moon" />
            <span>
              {run?.status === 'closed'
                ? 'The next run opens when you choose to begin again.'
                : run && !day
                  ? 'No day can be opened now. Begin a new run from the weekly summary when you are ready.'
                  : 'The next path opens at midnight.'}
            </span>
          </div>
        </div>

        <aside className="camp-rail" aria-label="Run overview">
          <ObjectivesPanel
            objectives={objectives}
            goals={document.goals}
            onViewAll={() => navigate({ name: 'goals' })}
          />

          <Panel pad>
            <PanelHead label="Run at a glance" />
            <StatStrip label="Run totals">
              <Stat
                value={`${daysKept} / 7`}
                label="Days kept"
                progress={percent(daysKept, 7)}
              />
              <Stat
                value={`${goalsMet} / ${aimCount}`}
                label="Aims met"
                progress={percent(goalsMet, Math.max(1, aimCount))}
              />
              <Stat
                value={profile?.loot.length ?? 0}
                label="Relics"
                progress={percent(profile?.loot.length ?? 0, 12)}
              />
            </StatStrip>
          </Panel>

          {profile ? (
            <div className="quiet-note">
              <Icon name="star" />
              <span>
                Level {profile.level} · {xpIntoLevel(profile.xp)} / 100 to the next,{' '}
                {xpToNextLevel(profile.xp)} to go.
              </span>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  )
}
