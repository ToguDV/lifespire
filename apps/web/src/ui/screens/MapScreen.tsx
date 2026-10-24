import type { ReactNode } from 'react'
import {
  availableNodeIds,
  currentDay,
  nodeProgress,
  resolveNodeById,
} from '../../domain/selectors'
import type { Day, GameMap, Goal, MapNode, NodeType, Run } from '../../domain/types'
import { useAppStore } from '../../state/store'
import {
  AimRow,
  Button,
  DayPips,
  Icon,
  MapGraph,
  Panel,
  PanelHead,
  ScreenHead,
} from '../components'
import type { IconName } from '../components'
import {
  EFFORT_LABEL,
  NODE_TYPE_ICON,
  NODE_TYPE_LABEL,
  goalIconFor,
  goalIconName,
  romanDay,
} from '../lib/format'
import { MAP_HEIGHT, MAP_WIDTH } from '../lib/mapLayout'
import { playFeedback } from '../lib/feedback'
import { nodeRewardLine, nodeTitle } from '../lib/nodeCopy'

const STATUS_COPY: Record<string, string> = {
  available: 'Day open',
  in_progress: 'In progress',
  completed: 'Sealed',
  missed: 'Missed',
  locked: 'Ahead',
}

const LEGEND: Array<{ type: NodeType; icon?: IconName; copy: string }> = [
  {
    type: 'task',
    icon: 'banner',
    copy: 'Your goal crest · +1 toward weekly target · XP and gold by effort',
  },
  {
    type: 'elite',
    icon: 'star',
    copy: 'Goal crest with a star · doubled reward and a loot roll',
  },
  { type: 'rest', copy: '+5 XP · no weekly progress' },
  { type: 'treasure', copy: '+15 gold and a loot roll · no progress' },
  {
    type: 'wheel',
    icon: 'wheel',
    copy: 'Mystery · task, gold, XP or rest · a task grants weekly progress',
  },
  {
    type: 'boss',
    icon: 'crown',
    copy: 'Your goal crest in the gate · closing bonus when completed',
  },
]

function ChoiceButton({
  node,
  icon,
  open,
  progress,
  onChoose,
}: {
  node: MapNode
  icon: IconName
  open: boolean
  progress: 0 | 1
  onChoose: (nodeId: string) => void
}) {
  const meta = [NODE_TYPE_LABEL[node.type]]
  if (node.task) meta.push(`${EFFORT_LABEL[node.task.effort]} effort`)
  meta.push(nodeRewardLine(node, progress))

  return (
    <button
      className={open ? 'choice choice--open' : 'choice'}
      type="button"
      onClick={() => onChoose(node.id)}
    >
      <span className="choice__icon">
        <Icon name={icon} />
      </span>
      <span className="choice__body">
        <strong>{nodeTitle(node)}</strong>
        <small>{meta.join(' · ')}</small>
      </span>
      <Icon name="chevron-right" />
    </button>
  )
}

function MapRail({
  run,
  day,
  map,
  goals,
  onChoose,
  onGoals,
}: {
  run: Run
  day: Day | null
  map: GameMap | null
  goals: readonly Goal[]
  onChoose: (nodeId: string) => void
  onGoals: () => void
}) {
  const available = map && day ? availableNodeIds(map, day) : []
  const nodes = map
    ? available
        .map((nodeId) => resolveNodeById(map, nodeId))
        .filter((node): node is MapNode => node !== null)
    : []
  const current = map?.currentNodeId ? resolveNodeById(map, map.currentNodeId) : null
  const runClosed = run.status === 'closed' || !day
  const daySealed = day?.status === 'completed' || day?.status === 'missed'
  const dayLocked = day?.status === 'locked'

  return (
    <aside className="map-rail" aria-label="Path details">
      <Panel pad>
        <PanelHead
          label="Next step"
          aside={
            <span className="chip chip--quiet">
              {nodes.length} {nodes.length === 1 ? 'choice' : 'choices'}
            </span>
          }
        />

        {nodes.length > 0 ? (
          <>
            <p className="map-rail__lede">
              {current
                ? 'This step is chosen. Open it to review the task and its rewards.'
                : nodes.length > 1
                  ? `${nodes.length} paths reach the gate; the trade-offs differ.`
                  : 'One path reaches the gate; this layer offers no trade-off.'}
            </p>
            {nodes.map((node, index) => (
              <ChoiceButton
                key={node.id}
                node={node}
                icon={
                  goalIconFor(goals, node.task?.goalId) ?? NODE_TYPE_ICON[node.type]
                }
                open={index === 0}
                progress={nodeProgress(run, node)}
                onChoose={onChoose}
              />
            ))}
          </>
        ) : (
          <p className="map-rail__lede">
            {runClosed
              ? 'The week is sealed. Read the run summary for its path and totals.'
              : daySealed
                ? 'This day is sealed. Read the day summary for its rewards and weekly progress.'
                : dayLocked
                  ? 'This day has not begun. Only today’s day can be played.'
                  : map
                    ? 'No step is open on this path. The next choice appears once this milestone can resolve nodes.'
                    : 'Open today’s path to draw the map. Once drawn, it will not change.'}
          </p>
        )}

        <p className="map-rail__foot">
          <Icon name={current ? 'check' : 'lock'} />
          {runClosed || daySealed || dayLocked
            ? 'No step can be chosen on this day.'
            : current
              ? 'The chosen step stays current until the daily loop arrives.'
              : 'Locked steps open as the path unfolds.'}
        </p>
      </Panel>

      <Panel pad>
        <PanelHead
          label="Weekly goals"
          aside={
            <button type="button" className="text-link" onClick={onGoals}>
              All goals
            </button>
          }
        />
        {run.objectives.length > 0 ? (
          run.objectives.map((objective) => {
            const goalIndex = goals.findIndex((goal) => goal.id === objective.goalId)
            const goal = goalIndex >= 0 ? goals[goalIndex] : undefined
            return (
              <AimRow
                key={objective.goalId}
                title={objective.goalTitle}
                progress={objective.progress}
                target={objective.target}
                icon={goalIconName(goal?.icon, goalIndex)}
              />
            )
          })
        ) : (
          <p className="panel-note">No weekly goals are recorded for this run.</p>
        )}
      </Panel>

      <div className="legend legend--detailed" aria-label="Node legend">
        {LEGEND.map((item) => (
          <span key={item.type}>
            <Icon name={item.icon ?? NODE_TYPE_ICON[item.type]} />
            <b>{NODE_TYPE_LABEL[item.type]}</b>
            <small>{item.copy}</small>
          </span>
        ))}
      </div>
    </aside>
  )
}

interface EmptyMapProps {
  icon: IconName
  micro: string
  title: string
  copy: string
  day: Day | null
  action: ReactNode
}

function EmptyMapFrame({ icon, micro, title, copy, day, action }: EmptyMapProps) {
  return (
    <div className="map-frame">
      <div className="map-frame__meta">
        <span className="micro">The ascent · beyond the veil</span>
        <span className="map-frame__day">
          {day ? `Day ${romanDay(day.index)}` : '—'}
        </span>
      </div>

      <div className="map-canvas-wrap">
        <svg
          className="map-lines map-lines--empty"
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          aria-hidden="true"
          focusable="false"
        >
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
            <Icon name={icon} />
          </span>
          <span className="micro">{micro}</span>
          <h2>{title}</h2>
          <p>{copy}</p>
          {action}
        </div>
      </div>

      <Icon name="compass" className="map-compass" />
    </div>
  )
}

export function MapScreen() {
  const run = useAppStore((state) => state.document.run)
  const goals = useAppStore((state) => state.document.goals)
  const navigate = useAppStore((state) => state.navigate)
  const openDay = useAppStore((state) => state.openDay)
  const selectNode = useAppStore((state) => state.selectNode)
  const todayKey = useAppStore((state) => state.todayKey)

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

  const activeDay = currentDay(run)
  const today = todayKey()
  const todayDay = run.days.find((candidate) => candidate.date === today) ?? null
  const day =
    todayDay && (todayDay.status === 'completed' || todayDay.status === 'missed')
      ? todayDay
      : activeDay
  const map = day?.map ?? null
  const resolvedCount = day?.path.length ?? 0
  const sealedDay = day?.status === 'completed' || day?.status === 'missed'
  const lockedDay = day?.status === 'locked'
  const hasMap = Boolean(map) && !sealedDay && !lockedDay
  const canOpen = Boolean(day) && !sealedDay && !lockedDay && !map
  const closedRun = run.status === 'closed' || !day

  let title = 'The Ashen Wood'
  let sub = ''
  let chipIcon: IconName = 'lock'
  let chipLabel = STATUS_COPY[day?.status ?? 'locked']

  if (closedRun) {
    title = run.status === 'closed' ? 'The week is sealed.' : 'No day remains.'
    sub =
      'Every day has been recorded. Read the week to see the path you kept and the totals it earned.'
    chipIcon = 'crown'
    chipLabel = 'Sealed'
  } else if (sealedDay && day) {
    title = day.status === 'missed' ? 'This day was missed.' : 'This day is sealed.'
    sub =
      day.status === 'missed'
        ? 'The day passed without a path. This run does not recover missed days.'
        : 'The path is recorded. Read the day summary for its rewards and weekly progress.'
    chipIcon = day.status === 'missed' ? 'moon' : 'check'
    chipLabel = day.status === 'missed' ? 'Missed' : 'Sealed'
  } else if (lockedDay) {
    title = 'The next day is still sealed.'
    sub = 'Only today’s day can be played. Return when the next day begins.'
    chipIcon = 'lock'
    chipLabel = 'Ahead'
  } else if (!map) {
    title = 'The path is still veiled.'
    sub = 'Today’s map is drawn once and kept. Open it to see the choices.'
    chipIcon = 'compass'
    chipLabel = 'Veiled'
  } else if (day) {
    const availableCount = availableNodeIds(map, day).length
    title = 'The Ashen Wood'
    sub = map.currentNodeId
      ? 'The step is chosen. Open it to review the task and its rewards.'
      : availableCount > 0
        ? `${availableCount} ${availableCount === 1 ? 'path' : 'paths'} ahead. Choose one to continue the day.`
        : 'No step is open on this path. The daily loop arrives in the next milestone.'
    chipIcon = 'check'
    chipLabel = `${resolvedCount} of ${map.layers.length + 1} resolved`
  }

  const chooseNode = (nodeId: string) => {
    selectNode(nodeId)
    const nextRun = useAppStore.getState().document.run
    const nextDay = currentDay(nextRun)
    if (nextDay?.map?.currentNodeId === nodeId) {
      playFeedback('select')
      navigate({ name: 'node', nodeId })
    }
  }

  const dayLabel = day ? `Day ${day.index + 1} of 7` : 'No day remains'
  const kicker = run.status === 'closed' ? 'Run I · The week is sealed' : `Run I · ${dayLabel}`
  const action = (() => {
    if (closedRun) {
      return (
        <Button variant="primary" onClick={() => navigate({ name: 'run-summary' })}>
          Read the week
          <Icon name="chevron-right" />
        </Button>
      )
    }
    if (sealedDay && day) {
      return (
        <Button
          variant="primary"
          onClick={() => navigate({ name: 'day-summary', dayId: day.id })}
        >
          Read the day summary
          <Icon name="chevron-right" />
        </Button>
      )
    }
    if (lockedDay) {
      return (
        <Button variant="secondary" onClick={() => navigate({ name: 'home' })}>
          Return to camp
          <Icon name="chevron-right" />
        </Button>
      )
    }
    if (canOpen && day) {
      return (
        <Button variant="primary" onClick={() => openDay(day.id)}>
          Open today’s path
          <Icon name="compass" />
        </Button>
      )
    }
    return null
  })()

  const emptyCopy = (() => {
    if (closedRun) {
      return {
        icon: 'crown' as IconName,
        micro: 'The week is sealed',
        title: 'Nothing more to climb.',
        copy: 'The path is complete. Its rewards and totals live in the run summary.',
      }
    }
    if (sealedDay && day) {
      return day.status === 'missed'
        ? {
            icon: 'moon' as IconName,
            micro: 'The day was missed',
            title: 'No path was kept.',
            copy: 'The day is recorded without rewards. The run continues with the next day.',
          }
        : {
            icon: 'check' as IconName,
            micro: 'The day is sealed',
            title: 'Nothing more to climb.',
            copy: 'The path is complete. Its rewards and weekly progress live in the day summary.',
          }
    }
    if (lockedDay) {
      return {
        icon: 'lock' as IconName,
        micro: 'The day is ahead',
        title: 'The next day is still sealed.',
        copy: 'A day can be opened only on its own date. Return to camp and wait for the next sunrise.',
      }
    }
    return {
      icon: 'compass' as IconName,
      micro: 'No path drawn yet',
      title: 'The path is still veiled.',
      copy: 'Opening the day draws its layers and a boss. The map is saved at once and will not change.',
    }
  })()

  return (
    <section className="screen screen--map" data-screen="map" aria-labelledby="map-title">
      <ScreenHead
        kicker={kicker}
        title={title}
        titleId="map-title"
        sub={sub}
        meta={
          <>
            <DayPips days={run.days} currentIndex={day?.index} label={dayLabel} />
            <span className="chip">
              <Icon name={chipIcon} />
              {chipLabel}
            </span>
          </>
        }
      />

      <div className="map-wrap">
        {hasMap && map && day ? (
          <div className="map-frame">
            <div className="map-frame__meta">
              <span className="micro">
                The ascent · {resolvedCount} of {map.layers.length + 1} resolved
              </span>
              <span className="map-frame__day">Day {romanDay(day.index)}</span>
            </div>
            <MapGraph
              map={map}
              day={day}
              goals={goals}
              run={run}
              onSelect={chooseNode}
            />
          </div>
        ) : (
          <EmptyMapFrame
            icon={emptyCopy.icon}
            micro={emptyCopy.micro}
            title={emptyCopy.title}
            copy={emptyCopy.copy}
            day={day}
            action={action}
          />
        )}

        <MapRail
          run={run}
          day={day}
          map={hasMap ? map : null}
          goals={goals}
          onChoose={chooseNode}
          onGoals={() => navigate({ name: 'goals' })}
        />
      </div>
    </section>
  )
}
