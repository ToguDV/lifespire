import { useEffect, useRef, useState } from 'react'
import { currentDay, nodeStatus, resolveNodeById } from '../../domain/selectors'
import { rollWheelOutcome } from '../../domain/lifecycle'
import { useAppStore } from '../../state/store'
import { Button, Icon, Panel } from '../components'
import { playFeedback } from '../lib/feedback'
import { playForRewardEvent } from '../lib/resolveFeedback'

/**
 * Second step of the wheel claim: the outcome is recomputed with the same
 * deterministic seed as the node preview, so this recap can never promise
 * more than the resolution grants. Nothing is recorded until Done.
 */
export function RewardScreen() {
  const view = useAppStore((state) => state.view)
  const run = useAppStore((state) => state.document.run)
  const goals = useAppStore((state) => state.document.goals)
  const tasks = useAppStore((state) => state.document.tasks)
  const finishReward = useAppStore((state) => state.finishReward)
  const resolveNode = useAppStore((state) => state.resolveNode)
  const [confirming, setConfirming] = useState(false)
  const confirmingRef = useRef(false)

  const day = currentDay(run)
  const map = day?.map ?? null
  const nodeId = view.name === 'reward' ? view.nodeId : null
  const node = nodeId && map ? resolveNodeById(map, nodeId) : null
  const status = node && map && day ? nodeStatus(map, day, node.id) : null
  const currentId = map?.currentNodeId ?? null

  const redirectTo = (() => {
    if (!nodeId || !run || !day || !map || !node || day.status !== 'in_progress') {
      return 'map'
    }
    if (node.type !== 'wheel') return 'map'
    if (currentId && node.id !== currentId) return currentId
    if (!currentId || status !== 'current') return 'map'
    return null
  })()

  useEffect(() => {
    if (!redirectTo) return
    if (redirectTo === 'map') finishReward({ name: 'map' })
    else finishReward({ name: 'node', nodeId: redirectTo })
  }, [redirectTo, finishReward])

  const outcome =
    node && node.type === 'wheel' && run && day
      ? rollWheelOutcome({
          runId: run.id,
          dayIndex: day.index,
          nodeId: node.id,
          goals,
          tasks,
          objectives: run.objectives,
        })
      : null

  const confirm = () => {
    if (!node || !day || confirmingRef.current) return
    confirmingRef.current = true
    setConfirming(true)

    const levelBefore = useAppStore.getState().document.profile?.level ?? null
    resolveNode(node.id, 'complete')

    const state = useAppStore.getState()
    const resolvedDay = state.document.run?.days.find((candidate) => candidate.id === day.id)
    const event = resolvedDay?.rewards.find((candidate) => candidate.nodeId === node.id)

    if (!event) {
      confirmingRef.current = false
      setConfirming(false)
      return
    }

    playForRewardEvent(event)
    const levelAfter = state.document.profile?.level ?? null
    if (levelBefore !== null && levelAfter !== null && levelAfter > levelBefore) {
      try {
        window.setTimeout(() => playFeedback('levelUp'), 450)
      } catch {
        // Decorative only.
      }
    }

    state.showRewardToast(event)
    state.finishReward({ name: 'map' })
  }

  if (!node || !day || !map || !run || !outcome || status !== 'current' || redirectTo) {
    return (
      <section className="screen screen--node" data-screen="reward" aria-labelledby="reward-title">
        <button className="node-back" type="button" onClick={() => finishReward({ name: 'map' })}>
          <Icon name="arrow-left" />
          Back to the map
        </button>
        <div className="node-detail">
          <Panel framed className="node-spread">
            <div className="empty-state">
              <span className="empty-state__medallion">
                <Icon name="wheel" />
              </span>
              <span className="micro">Reward</span>
              <h1 id="reward-title">No reward is waiting.</h1>
              <p>Return to the map to choose an available node.</p>
              <Button variant="secondary" onClick={() => finishReward({ name: 'map' })}>
                Return to the map
                <Icon name="chevron-right" />
              </Button>
            </div>
          </Panel>
        </div>
      </section>
    )
  }

  const rewardParts = [
    `+${outcome.xp} XP`,
    `+${outcome.gold} gold`,
    ...(outcome.progress > 0 ? ['+1 goal'] : []),
    ...(outcome.task ? [outcome.task.goalTitle] : []),
  ]

  const outcomeTitle =
    outcome.outcome === 'task'
      ? (outcome.task?.title ?? 'A task')
      : outcome.outcome === 'gold'
        ? 'A gold cache'
        : outcome.outcome === 'xp'
          ? 'A surge of experience'
          : 'A quiet rest'

  return (
    <section className="screen screen--node" data-screen="reward" aria-labelledby="reward-title">
      <div className="node-detail">
        <article className="panel node-spread">
          <header className="node-spread__art">
            <div className="node-medallion">
              <Icon name="wheel" />
            </div>
            <span className="micro">Wheel reward</span>
            <h1 id="reward-title">Your reward</h1>
          </header>

          <div className="node-spread__body">
            <div className="node-facts node-facts--single">
              <div className="node-fact">
                <span className="micro">Outcome</span>
                <strong>{outcomeTitle}</strong>
                <small>{rewardParts.join(' · ')}</small>
              </div>
            </div>

            <span className="sr-only" id="reward-confirm-note">
              Keeping the step records the reward and advances the path.
            </span>

            <div className="node-actions" aria-busy={confirming}>
              <Button
                variant="primary"
                disabled={confirming}
                aria-describedby="reward-confirm-note"
                onClick={confirm}
              >
                <Icon name="check" />
                Done
              </Button>
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}
