import { validateSetup } from '../../content/demo'
import { currentDay, xpIntoLevel, xpToNextLevel } from '../../domain/selectors'
import type { Day, Goal, LootItem, Run, RunObjective } from '../../domain/types'
import { useAppStore } from '../../state/store'
import {
  AimRow,
  Button,
  DayPips,
  Icon,
  Panel,
  PanelHead,
  Progress,
  ScreenHead,
  Stat,
  StatStrip,
} from '../components'
import type { IconName } from '../components'
import { homeState, weekMarker } from '../lib/dashboard'
import type { HomePhase } from '../lib/dashboard'
import {
  formatShortDayKey,
  formatShortIsoDay,
  goalIcon,
  lootIcon,
  percent,
  RARITY_LABEL,
} from '../lib/format'

const PHASE_META: Record<HomePhase, { label: string; icon: IconName }> = {
  'no-run': { label: 'Before the run', icon: 'moon' },
  'day-available': { label: 'Day open', icon: 'compass' },
  'day-in-progress': { label: 'In progress', icon: 'check' },
  'day-completed': { label: 'Day sealed', icon: 'check' },
  'day-missed': { label: 'Day missed', icon: 'moon' },
  'day-locked': { label: 'Ahead', icon: 'lock' },
  'run-closed': { label: 'Week sealed', icon: 'crown' },
  'no-open-day': { label: 'Week spent', icon: 'crown' },
}

const WEEK_CLASS = {
  completed: 'is-done',
  missed: 'is-missed',
  today: 'is-today',
  locked: 'is-locked',
} as const

const WEEK_WORD = {
  completed: 'kept',
  missed: 'missed',
  today: 'today',
  locked: 'ahead',
} as const

function WeekStrip({ run, today }: { run: Run; today: Day | null }) {
  const todayKey = today?.date ?? ''
  return (
    <ol className="week-strip" aria-label="Seven-day run">
      {run.days.map((day) => {
        const marker = weekMarker(day, todayKey)
        const label = `Day ${day.index + 1}, ${WEEK_WORD[marker]}`
        return (
          <li key={day.id} className={`week-day ${WEEK_CLASS[marker]}`} aria-label={label}>
            <strong>{day.index + 1}</strong>
            <span className="week-day__state" aria-hidden="true">
              {marker === 'completed' ? (
                <Icon name="check" />
              ) : marker === 'missed' ? (
                <span className="week-day__dash">–</span>
              ) : marker === 'today' ? (
                <span className="week-day__dot" />
              ) : (
                <Icon name="lock" />
              )}
            </span>
            <span className="sr-only">{WEEK_WORD[marker]}</span>
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
  goals: Goal[]
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
    <Panel pad aria-label="Weekly goals">
      <PanelHead
        label="Weekly goals"
        aside={
          <button type="button" className="text-link" onClick={onViewAll}>
            All goals
          </button>
        }
      />
      {rows.length === 0 ? (
        <p className="panel-note">No goals yet. They appear after onboarding.</p>
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

function Findings({
  findings,
  onReliquary,
}: {
  findings: LootItem[]
  onReliquary: () => void
}) {
  return (
    <section className="section-block" aria-labelledby="finds-title">
      <div className="section-block__head">
        <h2 id="finds-title">Recent finds</h2>
        <button type="button" className="text-link" onClick={onReliquary}>
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
                <Icon name={lootIcon(item.catalogId)} />
              </span>
              <span className="relic-mini__body">
                <strong>{item.name}</strong>
                <small>
                  {RARITY_LABEL[item.rarity]} · {formatShortIsoDay(item.obtainedAt)}
                </small>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function HomeScreen() {
  const document = useAppStore((state) => state.document)
  const navigate = useAppStore((state) => state.navigate)
  const startRun = useAppStore((state) => state.startRun)
  const openDay = useAppStore((state) => state.openDay)
  const todayKey = useAppStore((state) => state.todayKey)

  const run = document.run
  const profile = document.profile
  const today = todayKey()
  const home = homeState(run, today)
  const meta = PHASE_META[home.phase]
  const objectives = run?.objectives ?? []
  const activeGoals = document.goals.filter((goal) => goal.active)
  const aimCount = objectives.length > 0 ? objectives.length : activeGoals.length
  const goalsMet = objectives.filter((objective) => objective.progress >= objective.target).length
  const daysKept = run?.days.filter((item) => item.status === 'completed').length ?? 0
  const daysMissed = run?.days.filter((item) => item.status === 'missed').length ?? 0
  const findings = profile?.loot.slice(-2).reverse() ?? []
  const setupReady = validateSetup(document.goals, document.tasks).ok

  if (!profile) return null

  const day = home.today
  const dayPips = run ? (
    <DayPips
      days={run.days}
      currentIndex={
        home.phase === 'run-closed' || home.phase === 'no-open-day' ? undefined : day?.index
      }
      label={day ? `Day ${day.index + 1} of 7` : 'No day today'}
    />
  ) : null

  const openToday = () => {
    if (!day) return
    openDay(day.id)
    const opened = useAppStore
      .getState()
      .document.run?.days.find((candidate) => candidate.id === day.id)
    if (opened?.map) navigate({ name: 'map' })
  }

  const heroAction = (() => {
    switch (home.cta) {
      case 'begin-run':
        return setupReady ? (
          <Button variant="primary" onClick={() => startRun()}>
            Begin a run
            <Icon name="chevron-right" />
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => navigate({ name: 'goals' })}>
            Review your goals
            <Icon name="chevron-right" />
          </Button>
        )
      case 'open-day':
        return (
          <Button variant="primary" onClick={openToday}>
            Open today’s path
            <Icon name="compass" />
          </Button>
        )
      case 'continue-day':
        return (
          <Button variant="primary" onClick={() => navigate({ name: 'map' })}>
            Continue the ascent
            <Icon name="chevron-right" />
          </Button>
        )
      case 'review-day':
        return day ? (
          <Button
            variant="primary"
            onClick={() => navigate({ name: 'day-summary', dayId: day.id })}
          >
            Review the day
            <Icon name="chevron-right" />
          </Button>
        ) : null
      case 'review-week':
        return (
          <Button variant="primary" onClick={() => navigate({ name: 'run-summary' })}>
            Read the week
            <Icon name="chevron-right" />
          </Button>
        )
      case 'none':
        return (
          <Button variant="secondary" disabled title="The next path opens at midnight.">
            Wait for tomorrow
          </Button>
        )
    }
  })()

  const heroCopy = (() => {
    switch (home.phase) {
      case 'no-run':
        return {
          micro: 'The first step',
          title: setupReady ? 'A quiet beginning.' : 'The path needs goals.',
          copy: setupReady
            ? 'A seven-day run turns your routines into a path. Begin when you are ready; nothing is lost by waiting.'
            : 'A run needs at least one goal and four routines. Review your goals before the climb begins.',
          foot: 'Seven days · One path each',
        }
      case 'day-available':
        return {
          micro: "Today's path",
          title: 'The path is still veiled.',
          copy: 'Opening the day draws four layers and a boss. The map is saved at once and will not change.',
          foot: day ? `Day ${day.index + 1} of 7 · ${formatShortDayKey(day.date)}` : 'Today',
        }
      case 'day-in-progress':
        return {
          micro: "Today's path",
          title: 'The Ashen Wood',
          copy: home.hasSelection
            ? 'Your step is chosen. Open the map to review it, complete it, or skip it.'
            : home.availableChoices > 0
              ? home.availableChoices > 1
                ? `${home.availableChoices} paths reach the gate. The trade-offs differ.`
                : 'One path reaches the gate; this layer offers no trade-off.'
              : 'This path has no open step. The day waits for the map to unfold.',
          foot: day ? `Day ${day.index + 1} of 7 · ${formatShortDayKey(day.date)}` : 'Today',
        }
      case 'day-completed':
        return {
          micro: "Today's path",
          title: 'The path behind.',
          copy: 'Five steps, one path. The rewards are recorded and already yours. The next path opens at midnight.',
          foot: day ? `Day ${day.index + 1} of 7 · ${formatShortDayKey(day.date)}` : 'Today',
        }
      case 'day-missed':
        return {
          micro: "Today's path",
          title: 'The path unclaimed.',
          copy: 'No path was kept today. The run continues, but missed days are not recovered. The next path opens at midnight.',
          foot: day ? `Day ${day.index + 1} of 7 · ${formatShortDayKey(day.date)}` : 'Today',
        }
      case 'day-locked':
        return {
          micro: "Today's path",
          title: 'The next day is still sealed.',
          copy: 'Only today’s day can be played. Return when the next sunrise opens the path.',
          foot: 'The next path opens at midnight',
        }
      case 'run-closed':
        return {
          micro: 'The week behind',
          title: 'A week recorded.',
          copy: 'Every day is recorded and the totals are yours to keep. Read the week to revisit its goals, bonus and relics.',
          foot: `${daysKept} of 7 days kept`,
        }
      case 'no-open-day':
        return {
          micro: 'The week behind',
          title: 'A week spent.',
          copy: 'No day can be opened now. Read the week to revisit its goals, bonus and relics, then begin a new run.',
          foot: `${daysKept} of 7 days kept`,
        }
    }
  })()

  const quietCopy = (() => {
    switch (home.phase) {
      case 'no-run':
        return 'Begin a run and the first path opens today.'
      case 'day-available':
        return 'Only today can be played. Open the path when you are ready; it is drawn once and kept.'
      case 'day-in-progress':
        return 'Your chosen step stays current until you resolve it. The next path opens at midnight.'
      case 'day-completed':
        return 'The next path opens at midnight.'
      case 'day-missed':
        return 'The next path opens at midnight. Missed days are not recovered.'
      case 'day-locked':
        return 'The next path opens at midnight.'
      case 'run-closed':
        return 'The next run opens when you choose to begin again.'
      case 'no-open-day':
        return 'No day can be opened now. Begin a new run from the weekly summary when you are ready.'
    }
  })()

  const weekNote = !run
    ? 'Not begun'
    : run.status === 'closed'
      ? 'Sealed'
      : home.daysAhead === 0
        ? 'Closes today'
        : `Closes in ${home.daysAhead} ${home.daysAhead === 1 ? 'day' : 'days'}`

  const kicker =
    home.phase === 'no-run'
      ? 'Camp · Before the run'
      : run?.status === 'closed'
        ? 'Camp · The week is sealed'
        : day
          ? `Camp · Day ${day.index + 1} of 7`
          : 'Camp · The week is spent'

  const title = (() => {
    switch (home.phase) {
      case 'no-run':
        return 'No run yet.'
      case 'day-available':
      case 'day-in-progress':
        return 'The fire is lit.'
      case 'day-completed':
        return 'The day is sealed.'
      case 'day-missed':
        return 'The day passed unclaimed.'
      case 'day-locked':
        return 'The next day is still sealed.'
      case 'run-closed':
        return 'The week is sealed.'
      case 'no-open-day':
        return 'The week is spent.'
    }
  })()

  const sub = (() => {
    switch (home.phase) {
      case 'no-run':
        return 'Your profile is ready. Begin a seven-day run when you feel ready to climb.'
      case 'day-available':
        return `Day ${(day?.index ?? 0) + 1} is ready. Open today’s path to see the choices; the map is drawn once and kept.`
      case 'day-in-progress':
        return home.hasSelection
          ? `Day ${(day?.index ?? 0) + 1} is underway. Continue from your chosen step.`
          : `Day ${(day?.index ?? 0) + 1} is underway. Choose one of the paths ahead.`
      case 'day-completed':
        return 'The path is recorded. Review the day while the next path waits for midnight.'
      case 'day-missed':
        return 'No path was kept today. The run continues; missed days are not recovered.'
      case 'day-locked':
        return 'Only today’s day can be played. The next path opens at midnight.'
      case 'run-closed':
        return 'Every day is recorded; the week’s totals are yours to keep.'
      case 'no-open-day':
        return 'No day can be opened now. Read the week to see its record.'
    }
  })()

  const current = currentDay(run)
  const levelInto = xpIntoLevel(profile.xp)
  const levelToNext = xpToNextLevel(profile.xp)

  return (
    <section className="screen screen--camp" data-screen="camp" aria-labelledby="camp-title">
      <ScreenHead
        kicker={kicker}
        title={title}
        titleId="camp-title"
        sub={sub}
        meta={
          <>
            {dayPips}
            <span className={`chip ${home.phase === 'day-missed' ? 'chip--quiet' : ''}`}>
              <Icon name={meta.icon} />
              {meta.label}
            </span>
          </>
        }
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
                <circle cx="52" cy="160" r="10" fill="var(--done-fill)" />
                <use href="#i-tent" x="45" y="153" width="14" height="14" className="hero-glyph" />
                <circle cx="118" cy="102" r="10" fill="var(--done-fill)" />
                <use href="#i-check" x="112" y="96" width="12" height="12" className="hero-glyph" />
                <circle cx="198" cy="70" r="12" fill="var(--surface-raised)" stroke="var(--accent)" strokeWidth="1.6" />
                <use href="#i-scroll" x="190" y="62" width="16" height="16" className="hero-glyph-accent" />
                <circle cx="254" cy="26" r="14" fill="var(--surface-raised)" stroke="var(--hairline-strong)" strokeDasharray="2 4" />
                <use href="#i-crown" x="245" y="17" width="18" height="18" className="hero-glyph-soft" />
              </svg>
            </div>
            <div className="hero-panel__body">
              <span className="micro">{heroCopy.micro}</span>
              <h2>{heroCopy.title}</h2>
              <p>{heroCopy.copy}</p>
              <div className="hero-panel__meta">
                {run ? (
                  <span className="hero-panel__pips">
                    <DayPips
                      days={run.days}
                      currentIndex={
                        home.phase === 'run-closed' || home.phase === 'no-open-day'
                          ? undefined
                          : day?.index
                      }
                    />
                  </span>
                ) : null}
                <span>{heroCopy.foot}</span>
              </div>
              {heroAction}
              {home.phase === 'day-available' || home.phase === 'day-in-progress' ? (
                <p className="hero-panel__secondary">
                  <Icon name="lock" />
                  <span>Only today can be played.</span>
                </p>
              ) : null}
            </div>
          </article>

          <Findings findings={findings} onReliquary={() => navigate({ name: 'profile' })} />

          <section className="section-block week-block" aria-labelledby="week-title">
            <div className="section-block__head">
              <h2 id="week-title">The week</h2>
              <span className="mini-note">{weekNote}</span>
            </div>
            {run ? (
              <>
                <WeekStrip run={run} today={day} />
                {daysMissed > 0 ? (
                  <p className="panel-note week-missed-note">
                    {daysMissed} {daysMissed === 1 ? 'day was' : 'days were'} missed. Missed days
                    are not recovered; the run continues with the next sunrise.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="quiet-note">
                <Icon name="moon" />
                <span>The week begins when you start a run.</span>
              </p>
            )}
          </section>

          <p className="quiet-note">
            <Icon name={home.phase === 'run-closed' ? 'crown' : 'moon'} />
            <span>{quietCopy}</span>
          </p>
        </div>

        <aside className="camp-rail" aria-label="Run overview">
          <ObjectivesPanel
            objectives={objectives}
            goals={document.goals}
            onViewAll={() => navigate({ name: 'goals' })}
          />

          <Panel pad aria-label="Run at a glance">
            <PanelHead label="Run at a glance" />
            <StatStrip label="Run totals">
              <Stat
                value={`${daysKept} / 7`}
                label="Days kept"
                progress={percent(daysKept, 7)}
              />
              <Stat
                value={`${goalsMet} / ${aimCount}`}
                label="Goals met"
                progress={percent(goalsMet, Math.max(1, aimCount))}
              />
              <Stat
                value={profile.loot.length}
                label="Relics"
                progress={percent(profile.loot.length, 12)}
              />
            </StatStrip>
          </Panel>

          <Panel pad className="traveller-panel" aria-label="Traveller">
            <PanelHead
              label="The traveller"
              aside={
                <span className="traveller-links">
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => navigate({ name: 'profile' })}
                  >
                    Profile
                  </button>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => navigate({ name: 'settings' })}
                  >
                    Settings
                  </button>
                </span>
              }
            />
            <StatStrip label="Profile totals">
              <Stat value={`Lv ${profile.level}`} label="Level" />
              <Stat value={profile.xp} label="Experience" />
              <Stat value={profile.gold} label="Gold" />
            </StatStrip>
            <div className="traveller-level">
              <Progress
                value={levelInto}
                max={100}
                label={`Experience into level ${profile.level}`}
                showLabel
              />
              <span className="mini-note">
                {levelToNext} XP to level {profile.level + 1}
              </span>
            </div>
          </Panel>

          {current && home.phase === 'day-in-progress' ? (
            <p className="quiet-note">
              <Icon name="compass" />
              <span>Return to the map to keep the path moving.</span>
            </p>
          ) : null}
        </aside>
      </div>
    </section>
  )
}
