import { currentDay } from '../../domain/selectors'
import type { Run } from '../../domain/types'
import { useAppStore } from '../../state/store'
import { AimRow, Button, DayPips, Icon, Panel, PanelHead, ScreenHead } from '../components'
import { goalIcon, romanDay } from '../lib/format'

const STATUS_COPY: Record<string, string> = {
  available: 'Day open',
  in_progress: 'In progress',
  completed: 'Sealed',
  missed: 'Missed',
  locked: 'Ahead',
}

function MapRail({ run, dayId }: { run: Run; dayId: string | null }) {
  const document = useAppStore((state) => state.document)
  const navigate = useAppStore((state) => state.navigate)

  return (
    <aside className="map-rail" aria-label="Path details">
      <Panel pad>
        <PanelHead label="Next step" aside={<span className="chip chip--quiet">0 choices</span>} />
        <p className="map-rail__lede">
          No path is drawn yet. The SVG map, node choices and rewards are still to come;
          nothing is pending in your save.
        </p>
        <Button variant="secondary" full onClick={() => navigate({ name: 'home' })}>
          Back to camp
        </Button>
        <p className="map-rail__foot">
          <Icon name="lock" />
          Locked steps open as the path unfolds.
        </p>
        <div className="map-rail__preview">
          <span className="micro">Placeholder views</span>
          {dayId ? (
            <button
              type="button"
              className="text-link"
              onClick={() => navigate({ name: 'day-summary', dayId })}
            >
              Day summary
            </button>
          ) : null}
          <button
            type="button"
            className="text-link"
            onClick={() => navigate({ name: 'node', nodeId: 'preview' })}
          >
            Node detail
          </button>
        </div>
      </Panel>

      <Panel pad>
        <PanelHead
          label="Weekly aims"
          aside={
            <button type="button" className="text-link" onClick={() => navigate({ name: 'goals' })}>
              All aims
            </button>
          }
        />
        {run.objectives.map((objective) => (
          <AimRow
            key={objective.goalId}
            title={objective.goalTitle}
            progress={objective.progress}
            target={objective.target}
            icon={goalIcon(
              document.goals.findIndex((goal) => goal.id === objective.goalId),
            )}
          />
        ))}
      </Panel>

      <div className="legend" aria-label="Node legend">
        <span>
          <Icon name="scroll" />
          Task
        </span>
        <span>
          <Icon name="elite" />
          Elite
        </span>
        <span>
          <Icon name="campfire" />
          Rest
        </span>
        <span>
          <Icon name="chest" />
          Treasure
        </span>
        <span>
          <Icon name="crown" />
          Boss
        </span>
      </div>
    </aside>
  )
}

export function MapScreen() {
  const run = useAppStore((state) => state.document.run)
  const navigate = useAppStore((state) => state.navigate)
  const day = currentDay(run)
  const cleared = day?.path.length ?? 0

  if (!run) {
    return (
      <section className="screen screen--camp" data-screen="camp" aria-labelledby="map-empty-title">
        <ScreenHead
          kicker="The run"
          title="No run yet."
          titleId="map-empty-title"
          sub="The map opens when day 1 begins. Start a run from camp first."
          meta={
            <Button variant="secondary" size="sm" onClick={() => navigate({ name: 'home' })}>
              Go to camp
            </Button>
          }
        />
      </section>
    )
  }

  const closed = run.status === 'closed'
  const spent = !day
  const title = closed
    ? 'The week is sealed.'
    : spent
      ? 'No day remains.'
      : 'The map is veiled.'
  const sub = closed
    ? 'Every day has been recorded. Read the week to see the path you kept.'
    : spent
      ? 'Every day has been recorded. The weekly summary is the next page.'
      : 'The map opens when the day begins. Your aims and your week are already recorded.'
  const dayLabel = day
    ? `Day ${day.index + 1} of 7`
    : closed
      ? 'The week is sealed'
      : 'No day remains'

  return (
    <section
      className="screen screen--map screen--map-empty"
      data-screen="map"
      aria-labelledby="map-title"
    >
      <ScreenHead
        kicker={`Run I · ${dayLabel}`}
        title={title}
        titleId="map-title"
        sub={sub}
        meta={
          <>
            <DayPips days={run.days} currentIndex={day?.index} label={dayLabel} />
            <span className="chip">
              <Icon name={closed ? 'crown' : spent ? 'moon' : 'lock'} />
              {closed ? 'Sealed' : spent ? 'Spent' : STATUS_COPY[day?.status ?? 'locked']}
            </span>
          </>
        }
      />

      <div className="map-wrap">
        <div className="map-frame">
          <div className="map-frame__meta">
            <span className="micro">The ascent · {cleared} of 5 cleared</span>
            <span className="map-frame__day">
              {day ? `Day ${romanDay(day.index)}` : '—'}
            </span>
          </div>

          <div className="map-canvas-wrap">
            <svg className="map-lines map-lines--empty" viewBox="0 0 560 700" aria-hidden="true">
              <g className="contour">
                <path d="M-30 610c100-26 150 32 245 4s150-62 245-38 90 22 120 8" />
                <path d="M-20 470c92-22 140 34 232 8s148-56 238-36 92 14 130-2" />
                <path d="M-30 332c96-24 150 34 244 8s150-54 240-34 90 10 120-4" />
                <path d="M-20 204c88-22 142 32 234 8s150-52 238-32 92 8 128-4" />
                <path d="M-30 678c104-18 162 24 268 4s180-24 352-12" />
                <path d="M-30 112c112-16 166 22 270 4s190-20 350-10" />
              </g>
            </svg>

            <div className="map-empty">
              <span className="map-empty__medallion">
                <Icon name={closed || spent ? 'crown' : 'compass'} />
              </span>
              <span className="micro">
                {closed ? 'The week is sealed' : spent ? 'The week is spent' : 'No path drawn yet'}
              </span>
              <h2>
                {closed
                  ? 'Nothing more to climb.'
                  : spent
                    ? 'No day remains.'
                    : 'The map opens when the day begins.'}
              </h2>
              <p>
                {closed
                  ? 'The path is complete. Its rewards and totals live in the run summary.'
                  : spent
                    ? 'Every day has been recorded. The weekly summary is the next page.'
                    : 'The deterministic map is still to come. Your run is real and waiting.'}
              </p>
              <Button
                variant={closed || spent ? 'primary' : 'secondary'}
                onClick={() =>
                  navigate(closed || spent ? { name: 'run-summary' } : { name: 'home' })
                }
              >
                {closed || spent ? 'Read the week' : 'Return to camp'}
                <Icon name="chevron-right" />
              </Button>
              <div className="map-empty__links">
                {day ? (
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => navigate({ name: 'day-summary', dayId: day.id })}
                  >
                    Day summary
                  </button>
                ) : null}
                <button
                  type="button"
                  className="text-link"
                  onClick={() => navigate({ name: 'node', nodeId: 'preview' })}
                >
                  Node detail
                </button>
              </div>
            </div>
          </div>
          <Icon name="compass" className="map-compass" />
        </div>

        <MapRail run={run} dayId={day?.id ?? null} />
      </div>
    </section>
  )
}
