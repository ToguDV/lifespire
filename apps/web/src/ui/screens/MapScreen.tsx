import { useState } from 'react'
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
  Button,
  DayPips,
  Dialog,
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
  romanDay,
} from '../lib/format'
import { MAP_HEIGHT, MAP_WIDTH } from '../lib/mapLayout'
import { playFeedback } from '../lib/feedback'
import { nodeRewardLine, nodeTitle } from '../lib/nodeCopy'

const LEGEND: Array<{ type: NodeType; icon?: IconName; copy: string }> = [
  { type: 'task', icon: 'banner', copy: '+1 goal · XP/gold by effort' },
  { type: 'elite', icon: 'star', copy: '+1 goal · double reward · loot roll' },
  { type: 'rest', copy: '+5 XP' },
  { type: 'treasure', copy: '+15 gold · loot roll' },
  { type: 'wheel', copy: 'task, gold, XP or rest' },
  { type: 'boss', copy: '+1 goal · closing bonus' },
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
  const noChoiceState = runClosed || daySealed || dayLocked
  const onTrack = run.objectives.filter(
    (objective) => objective.progress >= objective.target,
  ).length
  const totalGoals = run.objectives.length

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
          nodes.map((node, index) => (
            <ChoiceButton
              key={node.id}
              node={node}
              icon={goalIconFor(goals, node.task?.goalId) ?? NODE_TYPE_ICON[node.type]}
              open={index === 0}
              progress={nodeProgress(run, node)}
              onChoose={onChoose}
            />
          ))
        ) : noChoiceState ? (
          <p className="map-rail__foot">
            <Icon name={current ? 'check' : 'lock'} />
            No step can be chosen on this day.
          </p>
        ) : (
          <p className="map-rail__lede">No step is open on this path.</p>
        )}
      </Panel>

      {totalGoals > 0 ? (
        <Panel pad>
          <PanelHead
            label={`${onTrack} of ${totalGoals} goals on track`}
            aside={
              <button type="button" className="text-link" onClick={onGoals}>
                All goals
              </button>
            }
          />
        </Panel>
      ) : null}

      <details className="legend legend--key">
        <summary>Node key</summary>
        <div className="legend--detailed" aria-label="Node legend">
          {LEGEND.map((item) => (
            <span key={item.type}>
              <Icon name={item.icon ?? NODE_TYPE_ICON[item.type]} />
              <b>{NODE_TYPE_LABEL[item.type]}</b>
              <small>{item.copy}</small>
            </span>
          ))}
        </div>
      </details>
    </aside>
  )
}

interface EmptyMapProps {
  icon: IconName
  day: Day | null
  action: ReactNode
}

function EmptyMapFrame({ icon, day, action }: EmptyMapProps) {
  return (
    <div className="map-frame">
      <div className="map-frame__meta">
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
  const resetCurrentDay = useAppStore((state) => state.resetCurrentDay)
  const selectNode = useAppStore((state) => state.selectNode)
  const todayKey = useAppStore((state) => state.todayKey)
  const [confirmResetDay, setConfirmResetDay] = useState(false)
  const [coachDismissed, setCoachDismissed] = useState(() => {
    try {
      return window.sessionStorage.getItem('lifespire:coach-day1') === 'done'
    } catch {
      return false
    }
  })

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

  // One state, one title, one line, one chip.
  let title = 'The path is veiled.'
  let sub = 'Open it once; it will not change.'
  let chipIcon: IconName = 'compass'
  let chipLabel = 'Veiled'

  if (closedRun) {
    title = 'The week is sealed.'
    sub = 'Read the totals.'
    chipIcon = 'crown'
    chipLabel = 'Sealed'
  } else if (sealedDay && day) {
    const missed = day.status === 'missed'
    title = missed ? 'The day was missed.' : 'The day is sealed.'
    sub = missed ? 'No path was kept.' : 'Read what it granted.'
    chipIcon = missed ? 'moon' : 'check'
    chipLabel = missed ? 'Missed' : 'Sealed'
  } else if (lockedDay) {
    title = 'The next day is sealed.'
    sub = 'Only today can be played.'
    chipIcon = 'lock'
    chipLabel = 'Ahead'
  } else if (map && day) {
    const availableCount = availableNodeIds(map, day).length
    title = 'The Ashen Wood'
    sub = map.currentNodeId
      ? 'One step is chosen.'
      : availableCount > 0
        ? `${availableCount} ${availableCount === 1 ? 'path' : 'paths'} ahead.`
        : 'No step is open.'
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
  const kicker =
    run.status === 'closed'
      ? 'The ascent · Week sealed'
      : day
        ? `The ascent · ${dayLabel}`
        : 'The ascent · No day remains'
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
          Read the day
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

  const showCoach =
    !coachDismissed && day?.index === 0 && day.path.length === 0 && hasMap
  const canResetDay =
    run.status === 'active' &&
    day?.date === today &&
    (day.status === 'available' || day.status === 'in_progress' || day.status === 'completed') &&
    (day.map !== null || day.path.length > 0 || day.rewards.length > 0)
  const dismissCoach = () => {
    setCoachDismissed(true)
    try {
      window.sessionStorage.setItem('lifespire:coach-day1', 'done')
    } catch {
      /* session-only hint; ignore storage failures */
    }
  }

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
            {canResetDay ? (
              <Button variant="quiet" size="sm" onClick={() => setConfirmResetDay(true)}>
                <Icon name="archive" />
                Reset today
              </Button>
            ) : null}
          </>
        }
      />

      {showCoach ? (
        <Panel pad>
          <PanelHead label="Tutorial · Your first climb" />
          <p className="panel-note">
            1. Choose a glowing node. 2. Do it in real life and mark Complete. 3. Reach the boss
            to seal the day. Resetting today takes back its rewards.
          </p>
          <p style={{ marginTop: 8 }}>
            <Button variant="secondary" size="sm" onClick={dismissCoach}>
              Got it — hide tutorial
            </Button>
          </p>
        </Panel>
      ) : null}

      <div className="map-wrap">
        {hasMap && map && day ? (
          <div className="map-frame">
            <div className="map-frame__meta">
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
          <EmptyMapFrame icon={chipIcon} day={day} action={action} />
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
      <Dialog
        open={confirmResetDay}
        eyebrow="The ascent"
        title="Reset today?"
        description="Today returns to unwritten: its map, path, XP, gold, loot and weekly progress are taken back."
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
                navigate({ name: 'home' })
              }}
            >
              <Icon name="archive" />
              Reset today
            </Button>
          </>
        }
      >
        <p className="panel-note">Yesterday and tomorrow are untouched.</p>
      </Dialog>
    </section>
  )
}
