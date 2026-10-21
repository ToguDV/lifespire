import { useEffect, useRef, useState } from 'react'
import { BOSS_CLOSING_BONUS } from '../../domain/balance'
import {
  currentDay,
  nodeStatus,
  objectiveProgress,
  resolveNodeById,
} from '../../domain/selectors'
import type { MapNode, Run } from '../../domain/types'
import { useAppStore } from '../../state/store'
import { Button, Icon, Panel, Pips } from '../components'
import { rewardFeedback } from '../lib/daySummary'
import { EFFORT_LABEL, NODE_TYPE_ICON, NODE_TYPE_LABEL } from '../lib/format'
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
  const navigate = useAppStore((state) => state.navigate)
  const resolveNode = useAppStore((state) => state.resolveNode)
  const [resolving, setResolving] = useState(false)
  const resolvingRef = useRef(false)

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

  const record = (action: 'complete' | 'skip') => {
    if (!node || !day || resolvingRef.current) return
    resolvingRef.current = true
    setResolving(true)

    resolveNode(node.id, action)

    const state = useAppStore.getState()
    const resolvedDay = state.document.run?.days.find((candidate) => candidate.id === day.id)
    const event = resolvedDay?.rewards.find((candidate) => candidate.nodeId === node.id)

    if (!event) {
      resolvingRef.current = false
      setResolving(false)
      return
    }

    if (node.type === 'boss') {
      navigate({ name: 'day-summary', dayId: day.id })
      return
    }

    state.showToast(rewardFeedback(event))
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
  const lootRolls = node.rewards.lootRolls

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
              <Icon name={NODE_TYPE_ICON[node.type]} />
            </div>
            <span className="micro">{nodeTypeLine(node)}</span>
            <h1 id="node-title">{nodeTitle(node)}</h1>
            <p className="node-flavor">{nodeFlavor(node)}</p>
          </header>

          <div className="node-spread__body">
            <div className="node-tags">
              <span className="chip chip--accent">
                <Icon name={taskBearing ? 'banner' : NODE_TYPE_ICON[node.type]} />
                {node.task ? node.task.goalTitle : `${NODE_TYPE_LABEL[node.type]} · no task`}
              </span>

              {node.rewards.progress > 0 ? (
                <span className="chip">
                  <Icon name="plus" />
                  +1 weekly aim
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

              {node.type === 'treasure' ? (
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
                <span className="micro">Aim</span>
                <strong>{node.rewards.progress > 0 ? '+1' : '—'}</strong>
                <small>
                  {node.task ? `${node.task.goalTitle} this week` : 'No weekly progress'}
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
                    This step is outside the weekly aims recorded at the start of the run.
                  </span>
                </p>
              )
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
              All weekly aims
            </button>

            <NodeSkipNote boss={node.type === 'boss'} />

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
          </div>
        </article>
      </div>
    </section>
  )
}
