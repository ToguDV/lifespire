import { useEffect, useRef, useState } from 'react'
import { BOSS_CLOSING_BONUS, WHEEL_SECTORS } from '../../domain/balance'
import {
  currentDay,
  nodeProgress,
  nodeStatus,
  objectiveProgress,
  resolveNodeById,
} from '../../domain/selectors'
import type { MapNode, Run } from '../../domain/types'
import { rollWheelOutcome } from '../../domain/lifecycle'
import { useAppStore } from '../../state/store'
import { Button, Icon, Panel, Pips } from '../components'
import { playFeedback } from '../lib/feedback'
import { rewardFeedback } from '../lib/daySummary'
import { playForRewardEvent } from '../lib/resolveFeedback'
import { EFFORT_LABEL, NODE_TYPE_ICON, NODE_TYPE_LABEL, goalIconFor } from '../lib/format'
import {
  WHEEL_RECAP_DELAY_MS,
  WHEEL_SPIN_DURATION_MS,
  WHEEL_SPIN_TURNS,
  easeOutQuart,
  nextWheelRotation,
  prefersReducedMotion,
  sectorIndexAtRotation,
  wheelSectorCenter,
  wheelSectorDegrees,
} from '../lib/wheel'
import { playWheelReveal, playWheelTick } from '../lib/wheelSound'
import {
  effortNote,
  nodeFlavor,
  nodeTitle,
  nodeTypeLine,
} from '../lib/nodeCopy'

function NodeSkipNote({ boss }: { boss: boolean }) {
  return (
    <p className="node-skip-note" id="node-skip-note">
      <Icon name="lock" />
      <span>
        {boss
          ? 'Skipping the boss closes the day without the closing bonus.'
          : 'Skipping grants no XP, gold, loot or weekly progress; it only advances the path.'}
      </span>
    </p>
  )
}

function AimProgress({ run, node }: { run: Run; node: MapNode }) {
  if (!node.task) return null
  const objective = objectiveProgress(run, node.task.goalId)
  const before = objective?.progress ?? 0
  const target = objective?.target ?? 0
  const met = target > 0 && before >= target
  const after = met ? before : Math.min(target || before + 1, before + 1)

  return (
    <div className="node-aim">
      <div className="node-aim__head">
        <strong>{node.task.goalTitle}</strong>
        <span>
          {before} of {target} this week
        </span>
      </div>
      {target > 0 ? <Pips value={before} max={target} label={`${node.task.goalTitle}: ${before} of ${target} complete`} /> : null}
      <p className="node-aim__after">
        <Icon name={met ? 'check' : 'plus'} />
        {met
          ? `Already met · ${before} of ${target} this week`
          : `After this step · ${after} of ${target} this week`}
      </p>
    </div>
  )
}

function NodeNotes({ node }: { node: MapNode }) {
  if (node.type === 'rest') {
    return (
      <p className="node-note">
        <Icon name="campfire" />
        <span>
          No task is attached. This rest grants {node.rewards.xp} XP and does not advance the
          week.
        </span>
      </p>
    )
  }
  if (node.type === 'treasure') {
    return (
      <p className="node-note">
        <Icon name="chest" />
        <span>
          No task is attached. This cache grants {node.rewards.gold} gold and{' '}
          {node.rewards.lootRolls} loot roll; weekly progress is unchanged.
        </span>
      </p>
    )
  }
  if (node.type === 'wheel') {
    return (
      <p className="node-note">
        <Icon name="wheel" />
        <span>
          A turn of the wheel: it may ask for a task (more likely for goals that are still
          pending), or grant gold, XP, or a rest. The result is revealed when you keep the
          step.
        </span>
      </p>
    )
  }
  if (node.type === 'elite') {
    return (
      <p className="node-note">
        <Icon name="elite" />
        <span>
          Elite rewards are doubled and include a loot roll. Weekly progress still advances by
          one.
        </span>
      </p>
    )
  }
  if (node.type === 'boss') {
    return (
      <p className="node-note">
        <Icon name="crown" />
        <span>
          Completing the boss closes the day and grants the closing bonus shown below. Skipping
          it closes the day without that bonus.
        </span>
      </p>
    )
  }
  return (
    <p className="node-note">
      <Icon name="check" />
      <span>Rewards land the moment you mark the step complete.</span>
    </p>
  )
}

export function NodeScreen() {
  const view = useAppStore((state) => state.view)
  const run = useAppStore((state) => state.document.run)
  const goals = useAppStore((state) => state.document.goals)
  const tasks = useAppStore((state) => state.document.tasks)
  const navigate = useAppStore((state) => state.navigate)
  const resolveNode = useAppStore((state) => state.resolveNode)
  const showToast = useAppStore((state) => state.showToast)
  const [resolving, setResolving] = useState(false)
  const resolvingRef = useRef(false)
  const [spinning, setSpinning] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [rotation, setRotation] = useState(0)
  const spinRafRef = useRef<number | null>(null)
  const advanceTimeoutRef = useRef<number | null>(null)
  const pointerRef = useRef<HTMLSpanElement>(null)
  const pointerAnimRef = useRef<Animation | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  const day = currentDay(run)
  const map = day?.map ?? null
  const nodeId = view.name === 'node' ? view.nodeId : null
  const node = nodeId && map ? resolveNodeById(map, nodeId) : null
  const status = node && map && day ? nodeStatus(map, day, node.id) : null
  const currentId = map?.currentNodeId ?? null

  const redirectTo = (() => {
    if (!nodeId || !run || !day || !map || !node || day.status !== 'in_progress') {
      return 'map'
    }
    if (currentId && node.id !== currentId) return currentId
    if (!currentId || status !== 'current') return 'map'
    return null
  })()

  useEffect(() => {
    if (!redirectTo) return
    if (redirectTo === 'map') navigate({ name: 'map' })
    else navigate({ name: 'node', nodeId: redirectTo })
  }, [redirectTo, navigate])

  const [trackedNodeId, setTrackedNodeId] = useState(nodeId)
  if (trackedNodeId !== nodeId) {
    setTrackedNodeId(nodeId)
    setSpinning(false)
    setRevealed(false)
    setRotation(0)
  }

  useEffect(
    () => () => {
      if (spinRafRef.current !== null) {
        cancelAnimationFrame(spinRafRef.current)
        spinRafRef.current = null
      }
      if (advanceTimeoutRef.current !== null) {
        window.clearTimeout(advanceTimeoutRef.current)
        advanceTimeoutRef.current = null
      }
      pointerAnimRef.current?.cancel()
      pointerAnimRef.current = null
    },
    [nodeId],
  )

  useEffect(() => {
    if (revealed) resultRef.current?.focus({ preventScroll: true })
  }, [revealed])

  const record = (action: 'complete' | 'skip') => {
    if (!node || !day || resolvingRef.current) return
    resolvingRef.current = true
    setResolving(true)

    const levelBefore = useAppStore.getState().document.profile?.level ?? null
    resolveNode(node.id, action)

    const state = useAppStore.getState()
    const resolvedDay = state.document.run?.days.find((candidate) => candidate.id === day.id)
    const event = resolvedDay?.rewards.find((candidate) => candidate.nodeId === node.id)

    if (!event) {
      resolvingRef.current = false
      setResolving(false)
      return
    }

    playForRewardEvent(event)
    const levelAfter = state.document.profile?.level ?? null
    if (action === 'complete' && levelBefore !== null && levelAfter !== null && levelAfter > levelBefore) {
      try {
        window.setTimeout(() => playFeedback('levelUp'), 450)
      } catch {
        // Decorative only.
      }
    }

    if (node.type === 'boss') {
      navigate({ name: 'day-summary', dayId: day.id })
      return
    }

    if (action === 'complete') {
      state.showRewardToast(event)
    } else {
      showToast(rewardFeedback(event))
    }
    navigate({ name: 'map' })
  }

  if (!node || !day || !map || !run || status !== 'current' || redirectTo) {
    return (
      <section className="screen screen--node" data-screen="node" aria-labelledby="node-title">
        <button className="node-back" type="button" onClick={() => navigate({ name: 'map' })}>
          <Icon name="arrow-left" />
          Back to the map
        </button>
        <div className="node-detail">
          <Panel framed className="node-spread">
            <div className="empty-state">
              <span className="empty-state__medallion">
                <Icon name="compass" />
              </span>
              <span className="micro">Node detail</span>
              <h1 id="node-title">This step is not open.</h1>
              <p>Return to the map to choose an available node.</p>
              <Button variant="secondary" onClick={() => navigate({ name: 'map' })}>
                Return to the map
                <Icon name="chevron-right" />
              </Button>
            </div>
          </Panel>
        </div>
      </section>
    )
  }

  const objective = node.task ? objectiveProgress(run, node.task.goalId) : null
  const taskBearing = node.task !== null
  const goalCrest = goalIconFor(goals, node.task?.goalId)
  const lootRolls = node.rewards.lootRolls

  const sectorDegrees = wheelSectorDegrees()
  const sectorIcon = (cat: (typeof WHEEL_SECTORS)[number]) =>
    cat === 'task' ? 'scroll' : cat === 'gold' ? 'coin' : cat === 'xp' ? 'star' : 'campfire'

  const sectorPath = (i: number) => {
    const center = wheelSectorCenter(i, sectorDegrees)
    const half = sectorDegrees / 2
    const start = center - half
    const end = center + half
    const toRad = (d: number) => (d * Math.PI) / 180
    const x1 = 100 + 90 * Math.cos(toRad(start))
    const y1 = 100 + 90 * Math.sin(toRad(start))
    const x2 = 100 + 90 * Math.cos(toRad(end))
    const y2 = 100 + 90 * Math.sin(toRad(end))
    return `M100,100 L${x1},${y1} A90,90 0 0,1 ${x2},${y2} Z`
  }

  const sectorIconPos = (i: number) => {
    const center = wheelSectorCenter(i, sectorDegrees)
    const rad = (center * Math.PI) / 180
    return { x: 100 + 62 * Math.cos(rad), y: 100 + 62 * Math.sin(rad) }
  }
  const isWheel = node.type === 'wheel'

  const rolledOutcome =
    isWheel && run && day
      ? rollWheelOutcome({
          runId: run.id,
          dayIndex: day.index,
          nodeId: node.id,
          goals,
          tasks,
          objectives: run.objectives,
        })
      : null

  // Before the wheel settles the node itself grants no progress; afterwards the
  // recap and the Goal block must agree with the rolled outcome.
  const settledWheel = isWheel && revealed ? rolledOutcome : null
  const weeklyProgress: 0 | 1 = settledWheel?.progress ? 1 : nodeProgress(run, node)
  const weeklyGoalTitle = settledWheel?.task?.goalTitle ?? node.task?.goalTitle ?? null

  const spinWheel = () => {
    if (spinning || revealed) return
    const spinNodeId = node?.id
    if (!spinNodeId) return
    if (prefersReducedMotion()) {
      navigate({ name: 'reward', nodeId: spinNodeId })
      return
    }
    const segmentIndex = rolledOutcome?.segmentIndex ?? 0
    const from = rotation
    const to = nextWheelRotation(from, segmentIndex, WHEEL_SPIN_TURNS, sectorDegrees)
    const total = to - from
    setSpinning(true)
    let start: number | null = null
    let lastSector = sectorIndexAtRotation(from, sectorDegrees)

    // The settled outcome is final: after a short beat the recap opens on
    // its own and there is no way back to spin again.
    const forceRecap = () => {
      const state = useAppStore.getState()
      if (state.view.name === 'node' && state.view.nodeId === spinNodeId) {
        state.navigate({ name: 'reward', nodeId: spinNodeId })
      }
    }

    const flickPointer = () => {
      const target = pointerRef.current
      if (!target || typeof target.animate !== 'function') return
      pointerAnimRef.current?.cancel()
      pointerAnimRef.current = target.animate(
        [
          { transform: 'translateX(-50%) rotate(0deg)' },
          { transform: 'translateX(-50%) rotate(-18deg)', offset: 0.4 },
          { transform: 'translateX(-50%) rotate(0deg)' },
        ],
        { duration: 110 },
      )
    }

    const step = (nowMs: number) => {
      if (start === null) start = nowMs
      const t = Math.min(1, (nowMs - start) / WHEEL_SPIN_DURATION_MS)
      const angle = from + total * easeOutQuart(t)
      setRotation(angle)
      const sector = sectorIndexAtRotation(angle, sectorDegrees)
      if (sector !== lastSector) {
        lastSector = sector
        // easeOutQuart derivative: velocity fades to zero, so the tick rate
        // follows the wheel like a real ratchet.
        const velocity = (total * 4 * (1 - t) ** 3) / (WHEEL_SPIN_DURATION_MS / 1000)
        playWheelTick(velocity / 900)
        flickPointer()
      }
      if (t < 1) {
        spinRafRef.current = requestAnimationFrame(step)
        return
      }
      spinRafRef.current = null
      setSpinning(false)
      setRevealed(true)
      playWheelReveal()
      if (advanceTimeoutRef.current !== null) window.clearTimeout(advanceTimeoutRef.current)
      advanceTimeoutRef.current = window.setTimeout(() => {
        advanceTimeoutRef.current = null
        forceRecap()
      }, WHEEL_RECAP_DELAY_MS)
    }
    spinRafRef.current = requestAnimationFrame(step)
  }

  return (
    <section className="screen screen--node" data-screen="node" aria-labelledby="node-title">
      <button className="node-back" type="button" onClick={() => navigate({ name: 'map' })}>
        <Icon name="arrow-left" />
        Back to the map
      </button>

      <div className="node-detail">
        <article className="panel node-spread" data-variant={node.type}>
          <header className="node-spread__art">
            <div className="node-medallion">
              <Icon name={goalCrest ?? NODE_TYPE_ICON[node.type]} />
            </div>
            <span className="micro">
              {isWheel ? 'Wheel node' : nodeTypeLine(node)}
            </span>
            <h1 id="node-title">{nodeTitle(node)}</h1>
            <p className="node-flavor">{nodeFlavor(node)}</p>
          </header>

          <div className="node-spread__body">
            <div className="node-tags">
              <span className="chip chip--accent">
                <Icon name={goalCrest ?? NODE_TYPE_ICON[node.type]} />
                {node.task
                  ? node.task.goalTitle
                  : isWheel
                    ? NODE_TYPE_LABEL[node.type]
                    : `${NODE_TYPE_LABEL[node.type]} · no task`}
              </span>

              {weeklyProgress > 0 ? (
                <span className="chip">
                  <Icon name="plus" />
                  +1 toward weekly target
                </span>
              ) : (
                <span className="chip chip--quiet">No weekly progress</span>
              )}

              {lootRolls > 0 ? (
                <span className="chip">
                  <Icon name="gem" />
                  {lootRolls} loot roll
                </span>
              ) : null}

              {node.type === 'boss' ? (
                <span className="chip chip--quiet">
                  <Icon name="crown" />
                  Closing bonus
                </span>
              ) : null}

              <span className="chip chip--quiet">
                <Icon name="check" />
                Chosen
              </span>
            </div>

            <div className="node-facts">
              <div className="node-fact">
                <span className="micro">Effort</span>
                <strong>
                  {node.task ? EFFORT_LABEL[node.task.effort] : '—'}
                </strong>
                <small>{effortNote(node)}</small>
              </div>

              {node.type === 'wheel' ? (
                <div className="node-fact">
                  <span className="micro">Outcome</span>
                  <strong>
                    <Icon name="wheel" />
                    Surprise
                  </strong>
                  <small>Task, gold, XP or rest</small>
                </div>
              ) : node.type === 'treasure' ? (
                <div className="node-fact">
                  <span className="micro">Fortune</span>
                  <strong>
                    <Icon name="coin" />
                    +{node.rewards.gold}
                  </strong>
                  <small>{lootRolls} loot roll</small>
                </div>
              ) : (
                <div className="node-fact">
                  <span className="micro">Experience</span>
                  <strong>
                    <Icon name="star" />
                    +{node.rewards.xp}
                  </strong>
                  <small>
                    {node.rewards.gold > 0 ? `+${node.rewards.gold} gold` : 'A small recovery'}
                    {lootRolls > 0 ? ` · ${lootRolls} loot roll` : ''}
                  </small>
                </div>
              )}

              <div className="node-fact">
                <span className="micro">Goal</span>
                <strong>{weeklyProgress > 0 ? '+1' : '—'}</strong>
                <small>
                  {weeklyProgress > 0 && weeklyGoalTitle
                    ? `${weeklyGoalTitle} this week`
                    : 'No weekly progress'}
                </small>
              </div>
            </div>

            {taskBearing ? (
              objective ? (
                <AimProgress run={run} node={node} />
              ) : (
                <p className="node-aim-empty">
                  <Icon name="banner" />
                  <span>
                    This step is outside the weekly goals recorded at the start of the run.
                  </span>
                </p>
              )
            ) : null}

            {isWheel ? (
              <div
                className="wheel-spinner"
                data-spinning={spinning ? 'true' : 'false'}
                data-revealed={revealed ? 'true' : 'false'}
              >
                <div className="wheel__frame">
                  <div className="wheel" style={{ transform: `rotate(${rotation}deg)` }}>
                    <svg viewBox="0 0 200 200" className="wheel__svg" aria-hidden="true">
                      <g className="wheel__segments">
                        {WHEEL_SECTORS.map((cat, i) => (
                          <path
                            key={i}
                            d={sectorPath(i)}
                            className={`wheel__seg wheel__seg--${cat}${revealed && rolledOutcome?.segmentIndex === i ? ' wheel__seg--winner' : ''}`}
                          />
                        ))}
                      </g>
                      <g className="wheel__icons">
                        {WHEEL_SECTORS.map((cat, i) => {
                          const pos = sectorIconPos(i)
                          return (
                            <g key={i} transform={`translate(${pos.x}, ${pos.y})`}>
                              <g transform="translate(-10, -10)">
                                <Icon name={sectorIcon(cat)} />
                              </g>
                            </g>
                          )
                        })}
                      </g>
                    </svg>
                  </div>
                  <span ref={pointerRef} className="wheel__pointer" aria-hidden="true" />
                  <span
                    className={`wheel__hub wheel__hub--${revealed && rolledOutcome ? rolledOutcome.outcome : 'mystery'}`}
                    aria-hidden="true"
                  >
                    {revealed && rolledOutcome ? (
                      <Icon name={sectorIcon(rolledOutcome.outcome)} />
                    ) : (
                      <span className="wheel__hub-text">?</span>
                    )}
                  </span>
                </div>

                {!revealed && !spinning ? (
                  <Button variant="primary" onClick={spinWheel}>
                    <Icon name="wheel" />
                    Spin the wheel
                  </Button>
                ) : null}

                {spinning ? (
                  <p className="wheel__status" role="status">
                    Spinning…
                  </p>
                ) : null}

                {revealed && rolledOutcome ? (
                  <div
                    className="wheel__result"
                    aria-live="polite"
                    ref={resultRef}
                    tabIndex={-1}
                  >
                    <p className="wheel__result-line">
                      {rolledOutcome.outcome === 'task'
                        ? `Task: ${rolledOutcome.task?.title ?? 'a task'}`
                        : rolledOutcome.outcome === 'gold'
                          ? `Gold`
                          : rolledOutcome.outcome === 'xp'
                            ? `Experience`
                            : `Rest`}
                    </p>
                    <p className="wheel__result-reward">
                      {rolledOutcome.outcome === 'task'
                        ? `+${rolledOutcome.xp} XP · +${rolledOutcome.gold} gold${
                            rolledOutcome.progress > 0 ? ' · +1 toward weekly target' : ''
                          }`
                        : rolledOutcome.outcome === 'gold'
                          ? `+${rolledOutcome.gold} gold`
                          : rolledOutcome.outcome === 'xp'
                            ? `+${rolledOutcome.xp} XP`
                            : `+${rolledOutcome.xp} XP`}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <NodeNotes node={node} />

            {node.type === 'boss' ? (
              <div className="node-bonus">
                <span className="micro">Closing bonus</span>
                <strong>
                  +{BOSS_CLOSING_BONUS.xp} XP · +{BOSS_CLOSING_BONUS.gold} gold
                </strong>
                <p>
                  Already included in the boss total above. Granted only when the boss is
                  completed.
                </p>
              </div>
            ) : null}

            <button
              type="button"
              className="text-link node-goals-link"
              onClick={() => navigate({ name: 'goals' })}
            >
              All weekly goals
            </button>

            {isWheel && revealed ? null : <NodeSkipNote boss={node.type === 'boss'} />}

            {isWheel ? (
              revealed ? null : (
                <div className="node-actions" aria-busy={resolving}>
                  <Button
                    variant="quiet"
                    disabled={resolving || spinning}
                    aria-describedby="node-skip-note"
                    onClick={() => record('skip')}
                  >
                    Skip this step
                  </Button>
                </div>
              )
            ) : (
              <div className="node-actions" aria-busy={resolving}>
                <Button
                  variant="primary"
                  disabled={resolving}
                  onClick={() => record('complete')}
                >
                  <Icon name="check" />
                  Mark complete
                </Button>
                <Button
                  variant="quiet"
                  disabled={resolving}
                  aria-describedby="node-skip-note"
                  onClick={() => record('skip')}
                >
                  Skip this step
                </Button>
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  )
}
