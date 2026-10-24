import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import {
  currentDay,
  nodeStatus,
  resolveNodeById,
  rollWheelOutcome,
} from '@lifespire/core'
import type { WheelOutcome } from '@lifespire/core'
import { useTheme } from '../theme/ThemeProvider'
import { fonts, radius, space } from '../theme/tokens'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { Panel } from '../components/Panel'
import { Screen } from '../components/Screen'
import { Text } from '../components/Text'
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

function rewardLines(outcome: {
  outcome: WheelOutcome
  xp: number
  gold: number
  progress: number
}): string[] {
  if (outcome.outcome === 'task') {
    return [
      `+${outcome.xp} XP`,
      `+${outcome.gold} gold`,
      ...(outcome.progress > 0 ? ['+1 toward weekly target'] : []),
    ]
  }
  if (outcome.outcome === 'gold') return [`+${outcome.gold} gold`]
  return [`+${outcome.xp} XP`]
}

/**
 * Second step of the wheel claim: the outcome is recomputed with the same
 * deterministic seed as the node preview, so this recap can never promise more
 * than the resolution grants. Nothing is recorded until Done.
 */
export function RewardScreen({ nodeId }: { nodeId: string }) {
  const { colors } = useTheme()
  const document = useAppStore((state) => state.document)
  const navigate = useAppStore((state) => state.navigate)
  const finishReward = useAppStore((state) => state.finishReward)
  const resolveNode = useAppStore((state) => state.resolveNode)
  const confirmingRef = useRef(false)
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
      setTimeout(() => playFeedback('levelUp'), 450)
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
      <Screen>
        <Panel>
          <EmptyState icon="wheel" title="No reward is waiting">
            Return to the map to choose an available node.
          </EmptyState>
          <Button variant="secondary" onPress={() => navigate({ name: 'map' })} full>
            Return to the map
          </Button>
        </Panel>
      </Screen>
    )
  }

  const title = outcomeTitle(outcome)
  const lines = rewardLines(outcome)
  const goalTitle = outcome.task?.goalTitle ?? null

  return (
    <Screen>
      <Panel pad={false} style={styles.spread}>
        <View style={[styles.art, { backgroundColor: colors.surfaceSunken, borderColor: colors.hairline }]}>
          <View style={styles.medallionStage}>
            <View style={[styles.ringOuter, { borderColor: colors.hairline }]} pointerEvents="none" />
            <View style={[styles.ringInner, { borderColor: colors.hairlineStrong }]} pointerEvents="none" />
            <View style={[styles.halo, { backgroundColor: colors.accentSoft }]} />
            <View style={[styles.medallion, { backgroundColor: colors.surfaceRaised, borderColor: colors.accent }]}>
              <Icon name="wheel" size={34} color={colors.accentDeep} />
            </View>
          </View>
          <Text variant="micro" tone="muted" style={styles.kicker}>
            Wheel reward
          </Text>
          <Text style={[styles.title, { color: colors.ink }]} accessibilityRole="header">
            Your reward
          </Text>
          <Text style={[styles.flavor, { color: colors.inkMuted }]}>
            The wheel has settled. Keeping the step records this.
          </Text>
        </View>

        <View style={styles.body}>
          <View style={[styles.facts, { backgroundColor: colors.surfaceRaised, borderColor: colors.hairline }]}>
            <View style={[styles.fact, { borderColor: colors.hairline, borderRightWidth: 1 }]}>
              <Text variant="micro" tone="muted" style={styles.factLabel}>
                OUTCOME
              </Text>
              <Text style={[styles.factStrong, { color: colors.inkStrong }]}>{title}</Text>
              <Text style={[styles.factNote, { color: colors.inkSoft }]}>{lines.join(' · ')}</Text>
            </View>
            <View style={styles.fact}>
              <Text variant="micro" tone="muted" style={styles.factLabel}>
                WEEKLY PROGRESS
              </Text>
              <Text style={[styles.factStrong, { color: colors.inkStrong }]}>
                {outcome.progress > 0 ? '+1' : '—'}
              </Text>
              <Text style={[styles.factNote, { color: colors.inkSoft }]}>
                {outcome.progress > 0 && goalTitle ? `${goalTitle} this week` : 'No weekly progress'}
              </Text>
            </View>
          </View>

          <View style={[styles.confirmNote, { backgroundColor: colors.accentWash, borderColor: colors.hairline }]}>
            <Icon name="check" size={16} color={colors.accent} />
            <Text variant="bodySm" tone="muted" style={styles.confirmText}>
              Keeping the step records the reward above and advances the path.
            </Text>
          </View>

          <View style={styles.actions}>
            <Button icon="check" onPress={confirm} disabled={confirming} full>
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
  art: {
    position: 'relative',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  medallionStage: {
    width: 190,
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: radius.full,
    borderWidth: 1,
    opacity: 0.8,
  },
  ringInner: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: radius.full,
    borderWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.65,
  },
  halo: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: radius.full,
  },
  medallion: {
    width: 78,
    height: 78,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: { marginTop: 18, textAlign: 'center' },
  title: {
    marginTop: 5,
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 33,
    textAlign: 'center',
  },
  flavor: {
    marginTop: 9,
    paddingHorizontal: 8,
    fontFamily: fonts.displayItalic,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  body: { padding: 18 },
  facts: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  fact: { flex: 1, gap: 4, paddingVertical: 11, paddingHorizontal: 10 },
  factLabel: { fontSize: 10, letterSpacing: 1 },
  factStrong: {
    fontFamily: fonts.display,
    fontSize: 15,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  factNote: { fontSize: 10, lineHeight: 13 },
  confirmNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.xs,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm,
    marginTop: space.md,
  },
  confirmText: { flex: 1 },
  actions: { marginTop: space.md },
})
