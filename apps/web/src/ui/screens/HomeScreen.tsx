import { useState } from 'react'
import { validateSetup } from '../../content/demo'
import type { Day, Goal, LootItem, Run, RunObjective } from '../../domain/types'
import { useAppStore } from '../../state/store'
import { AimRow, Button, DayPips, Dialog, Icon, Panel, PanelHead, TutorialDialog } from '../components'
import { markTutorialSeen, useSeenTutorialCards } from '../lib/tutorial'
import type { IconName } from '../components'
import { homeState, weekMarker } from '../lib/dashboard'
import type { HomePhase } from '../lib/dashboard'
import {
  formatShortIsoDay,
  goalIconFor,
  goalIconName,
  lootIcon,
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
          icon: goalIconFor(goals, objective.goalId) ?? 'banner',
        }))
      : goals
          .filter((goal) => goal.active)
          .map((goal, index) => ({
            key: goal.id,
            title: goal.title,
            progress: 0,
            target: goal.weeklyObjective,
            icon: goalIconName(goal.icon, index),
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
  if (findings.length === 0) return null

  return (
    <section className="section-block" aria-labelledby="finds-title">
      <div className="section-block__head">
        <h2 id="finds-title">Recent finds</h2>
        <button type="button" className="text-link" onClick={onReliquary}>
          Reliquary
        </button>
      </div>
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
    </section>
  )
}

export function HomeScreen() {
  const document = useAppStore((state) => state.document)
  const navigate = useAppStore((state) => state.navigate)
  const startRun = useAppStore((state) => state.startRun)
  const openDay = useAppStore((state) => state.openDay)
  const resetCurrentDay = useAppStore((state) => state.resetCurrentDay)
  const todayKey = useAppStore((state) => state.todayKey)
  const [confirmResetDay, setConfirmResetDay] = useState(false)
  const seenTutorial = useSeenTutorialCards()

  const run = document.run
  const profile = document.profile
  const today = todayKey()
  const home = homeState(run, today)
  const meta = PHASE_META[home.phase]
  const objectives = run?.objectives ?? []
  const daysMissed = run?.days.filter((item) => item.status === 'missed').length ?? 0
  const findings = profile?.loot.slice(-2).reverse() ?? []
  const setupReady = validateSetup(document.goals, document.tasks).ok

  if (!profile) return null

  const day = home.today
  const dayNumber = day ? day.index + 1 : 0
  const canResetDay =
    run?.status === 'active' &&
    day?.date === today &&
    (day.status === 'available' || day.status === 'in_progress' || day.status === 'completed') &&
    (day.map !== null || day.path.length > 0 || day.rewards.length > 0)
  const showCampTutorial =
    run?.status === 'active' && day?.date === today && !seenTutorial.has('camp')

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
            Read the day
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
        return null
    }
  })()

  const kicker = (() => {
    switch (home.phase) {
      case 'no-run':
        return 'Camp · Before the run'
      case 'run-closed':
        return 'Camp · Week sealed'
      case 'no-open-day':
        return 'Camp · Week spent'
      default:
        return day ? `Camp · Day ${dayNumber} of 7` : 'Camp · The week'
    }
  })()

  const copy = (() => {
    switch (home.phase) {
      case 'no-run':
        return setupReady
          ? { title: 'No run yet.', line: 'Your goals are ready.' }
          : { title: 'The path needs goals.', line: 'A run needs one goal and four routines.' }
      case 'day-available':
        return { title: 'Today’s path is ready.', line: 'Open it once; the map will not change.' }
      case 'day-in-progress':
        return {
          title: `Day ${dayNumber} is open.`,
          line: home.hasSelection
            ? 'One step is chosen.'
            : home.availableChoices > 0
              ? `${home.availableChoices} paths ahead.`
              : 'No step is open.',
        }
      case 'day-completed':
        return { title: 'The day is sealed.', line: 'The next path opens at midnight.' }
      case 'day-missed':
        return { title: 'The day passed unclaimed.', line: 'Missed days are not recovered.' }
      case 'day-locked':
        return { title: 'The next day is sealed.', line: 'Only today can be played.' }
      case 'run-closed':
        return { title: 'The week is sealed.', line: 'The totals are yours.' }
      case 'no-open-day':
        return { title: 'The week is spent.', line: 'Begin a new run from the week summary.' }
    }
  })()

  return (
    <section className="screen screen--camp" data-screen="camp" aria-labelledby="camp-title">
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
              <div className="hero-panel__kicker">
                <span className="micro">{kicker}</span>
                <span className={`chip ${home.phase === 'day-missed' ? 'chip--quiet' : ''}`}>
                  <Icon name={meta.icon} />
                  {meta.label}
                </span>
              </div>
              <h1 id="camp-title">{copy.title}</h1>
              <p>{copy.line}</p>
              {run ? (
                <div className="hero-panel__meta">
                  <span className="hero-panel__pips">
                    <DayPips
                      days={run.days}
                      currentIndex={
                        home.phase === 'run-closed' || home.phase === 'no-open-day'
                          ? undefined
                          : day?.index
                      }
                      label={day ? `Day ${day.index + 1} of 7` : 'No day today'}
                    />
                  </span>
                </div>
              ) : null}
              {heroAction}
              {canResetDay ? (
                <p style={{ marginTop: 10 }}>
                  <Button variant="quiet" size="sm" onClick={() => setConfirmResetDay(true)}>
                    <Icon name="archive" />
                    Reset today
                  </Button>
                </p>
              ) : null}
              {showCampTutorial ? (
                <TutorialDialog
                  card="camp"
                  icon="tent"
                  title="The camp is your base"
                  body="Each morning a new path opens on the map. Complete nodes, gather loot, and seal the boss before midnight."
                  primaryLabel="See the map"
                  onPrimary={() => {
                    markTutorialSeen('camp')
                    navigate({ name: 'map' })
                  }}
                  onHide={() => markTutorialSeen('camp')}
                />
              ) : null}
            </div>
          </article>

          <Findings findings={findings} onReliquary={() => navigate({ name: 'profile' })} />

          <section className="section-block week-block" aria-labelledby="week-title">
            <div className="section-block__head">
              <h2 id="week-title">The week</h2>
            </div>
            {run ? (
              <>
                <WeekStrip run={run} today={day} />
                {daysMissed > 0 ? (
                  <p className="panel-note week-missed-note">
                    {daysMissed === 1
                      ? '1 day was missed and is not recovered.'
                      : `${daysMissed} days were missed and are not recovered.`}
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
        </div>

        <aside className="camp-rail" aria-label="Run overview">
          <ObjectivesPanel
            objectives={objectives}
            goals={document.goals}
            onViewAll={() => navigate({ name: 'goals' })}
          />
        </aside>
      </div>
      <Dialog
        open={confirmResetDay}
        eyebrow="Camp"
        title="Reset today?"
        description="Today returns to unwritten: its map, path, XP, gold, loot and weekly progress are taken back. Yesterday and tomorrow are untouched."
        onClose={() => setConfirmResetDay(false)}
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirmResetDay(false)}>
              Keep today
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmResetDay(false)
                resetCurrentDay()
              }}
            >
              <Icon name="archive" />
              Reset today
            </Button>
          </>
        }
      >
        <p className="panel-note">
          Use this to replay the day with the current goals. New goals join the week tomorrow, or
          today after the reset.
        </p>
      </Dialog>
    </section>
  )
}
