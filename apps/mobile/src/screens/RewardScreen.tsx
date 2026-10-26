import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import {
  currentDay,
  nodeStatus,
  resolveNodeById,
  rollWheelOutcome,
} from '@lifespire/core'
import type { WheelOutcome } from '@lifespire/core'
import { space } from '../theme/tokens'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { FactCell, FactsRow } from '../components/FactsRow'
import { HeroArt } from '../components/HeroArt'
import { Panel } from '../components/Panel'
import { Screen } from '../components/Screen'
import { playFeedback } from '../state/feedback'
import { playForRewardEvent } from '../lib/resolveFeedback'
import { useAppStore } from '../state/store'

function outcomeTitle(outcome: {
  outcome: WheelOutcome
  task: { title: string } | null
}): string {
  if (outcome.outcome === 'task') return outcome.task?.title ?? 'A task'
  if (outcome.outcome === 'gold') return 'A gold cache'
  if (outcome.outcome === 'xp') return 'A surge of experience'
  return 'A quiet rest'
}

/**
 * Second step of the wheel claim: the outcome is recomputed with the same
 * deterministic seed as the node preview, so this recap can never promise more
 * than the resolution grants. Nothing is recorded until Done.
 */
export function RewardScreen({ nodeId }: { nodeId: string }) {
  const document = useAppStore((state) => state.document)
  const finishReward = useAppStore((state) => state.finishReward)
  const resolveNode = useAppStore((state) => state.resolveNode)
  const confirmingRef = useRef(false)
  const levelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [confirming, setConfirming] = useState(false)
  const run = document.run
  const day = currentDay(run)
  const map = day?.map ?? null
  const node = map ? resolveNodeById(map, nodeId) : null
  const status = map && day && node ? nodeStatus(map, day, node.id) : null
  const currentId = map?.currentNodeId ?? null

  const redirectTo = (() => {
    if (!run || !day || !map || !node || day.status !== 'in_progress') return 'map'
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

  useEffect(
    () => () => {
      if (levelTimer.current !== null) clearTimeout(levelTimer.current)
    },
    [],
  )

  const outcome = useMemo(() => {
    if (!run || !day || !node || node.type !== 'wheel') return null
    return rollWheelOutcome({
      runId: run.id,
      dayIndex: day.index,
      nodeId: node.id,
      goals: document.goals,
      tasks: document.tasks,
      objectives: run.objectives,
    })
  }, [run, day, node, document.goals, document.tasks])

  const confirm = () => {
    if (!node || !day || !outcome || confirmingRef.current) return
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
      levelTimer.current = setTimeout(() => playFeedback('levelUp'), 450)
    }

    state.showRewardToast(event)
    state.finishReward({ name: 'map' })
  }

  if (
    !run ||
    !day ||
    !map ||
    !node ||
    !outcome ||
    status !== 'current' ||
    redirectTo
  ) {
    return (
      <Screen bottomInset={false}>
        <Panel>
          <EmptyState icon="wheel" title="No reward is waiting.">
            Return to the map to choose an available node.
          </EmptyState>
          <Button variant="secondary" onPress={() => finishReward({ name: 'map' })} full>
            Return to the map
          </Button>
        </Panel>
      </Screen>
    )
  }

  const title = outcomeTitle(outcome)
  const rewards = [
    ...(outcome.xp > 0 ? [`+${outcome.xp} XP`] : []),
    ...(outcome.gold > 0 ? [`+${outcome.gold} gold`] : []),
    ...(outcome.progress > 0 ? ['+1 goal'] : []),
    ...(outcome.task ? [outcome.task.goalTitle] : []),
  ]

  return (
    <Screen bottomInset={false}>
      <Panel pad={false} style={styles.spread}>
        <HeroArt icon="wheel" kicker="Wheel reward" title="Your reward" />

        <View style={styles.body}>
          <FactsRow>
            <FactCell label="Outcome" value={title} note={rewards.join(' · ')} last />
          </FactsRow>

          <View style={styles.actions}>
            <Button
              icon="check"
              onPress={confirm}
              disabled={confirming}
              accessibilityHint="Keeping the step records the reward and advances the path."
              full
            >
              Done
            </Button>
          </View>
        </View>
      </Panel>
    </Screen>
  )
}

const styles = StyleSheet.create({
  spread: { overflow: 'hidden' },
  body: { padding: 18 },
  actions: { marginTop: space.md },
})
