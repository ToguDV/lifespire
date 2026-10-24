import { useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import {
  currentDay,
  resolveNodeById,
  rollWheelOutcome,
} from '@lifespire/core'
import { rewardFeedback } from '@lifespire/app-core/ui/daySummary'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { Panel, PanelHead, ScreenHead } from '../components/Panel'
import { Screen } from '../components/Screen'
import { Text } from '../components/Text'
import { playForRewardEvent } from '../lib/resolveFeedback'
import { useAppStore } from '../state/store'

const OUTCOME_TITLE = {
  task: 'The wheel asks for a step',
  gold: 'The wheel grants gold',
  xp: 'The wheel grants experience',
  rest: 'The wheel grants rest',
} as const

export function RewardScreen({ nodeId }: { nodeId: string }) {
  const { colors } = useTheme()
  const document = useAppStore((state) => state.document)
  const navigate = useAppStore((state) => state.navigate)
  const resolveNode = useAppStore((state) => state.resolveNode)
  const showRewardToast = useAppStore((state) => state.showRewardToast)
  const resolving = useRef(false)
  const run = document.run
  const day = currentDay(run)
  const node = day?.map ? resolveNodeById(day.map, nodeId) : null

  const rolled = useMemo(() => {
    if (!run || !day || !node) return null
    return rollWheelOutcome({
      runId: run.id,
      dayIndex: day.index,
      nodeId: node.id,
      goals: document.goals,
      tasks: document.tasks,
      objectives: run.objectives,
    })
  }, [run, day, node, document.goals, document.tasks])

  if (!run || !day || !node || !rolled) {
    return (
      <Screen>
        <ScreenHead kicker="The wheel" title="Reward" />
        <Panel>
          <EmptyState icon="wheel" title="Nothing to claim">
            This reward is no longer available.
          </EmptyState>
          <Button variant="secondary" onPress={() => navigate({ name: 'map' })} full>
            Back to the map
          </Button>
        </Panel>
      </Screen>
    )
  }

  const done = () => {
    if (resolving.current) return
    resolving.current = true
    resolveNode(node.id, 'complete')
    const state = useAppStore.getState()
    const resolvedDay = state.document.run?.days.find((candidate) => candidate.id === day.id)
    const event = resolvedDay?.rewards.find((candidate) => candidate.nodeId === node.id)
    if (!event) {
      resolving.current = false
      return
    }
    playForRewardEvent(event)
    showRewardToast(event)
    navigate({ name: 'map' })
  }

  return (
    <Screen>
      <ScreenHead
        kicker="The wheel settles"
        title={OUTCOME_TITLE[rolled.outcome]}
        subtitle={
          <Text variant="bodyMd" tone="muted">
            The outcome was fixed the moment you spun. There is no second spin.
          </Text>
        }
        aside={
          <View style={[styles.crest, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
            <Icon name="wheel" size={24} color={colors.accentDeep} />
          </View>
        }
      />

      <Panel>
        <PanelHead label="Outcome" aside={<Text variant="caption" tone="accent">{rolled.outcome.toUpperCase()}</Text>} />
        {rolled.task ? (
          <View style={styles.task}>
            <Text variant="headingMd">{rolled.task.title}</Text>
            <Text variant="caption" tone="muted">
              {rolled.task.goalTitle}
            </Text>
          </View>
        ) : null}
        <View style={styles.rewards}>
          {rolled.xp > 0 ? <Text variant="bodyLg" tone="xp">{`+${rolled.xp} XP`}</Text> : null}
          {rolled.gold > 0 ? <Text variant="bodyLg" tone="gold">{`+${rolled.gold} gold`}</Text> : null}
          {rolled.progress > 0 ? (
            <Text variant="bodyLg" tone="accent">
              +1 weekly target
            </Text>
          ) : null}
          {rolled.outcome === 'rest' ? (
            <Text variant="bodySm" tone="muted">
              A quiet outcome. Nothing is asked of the week.
            </Text>
          ) : null}
        </View>
        <Text variant="caption" tone="soft" style={styles.feedback}>
          {rewardFeedback({
            action: 'complete',
            nodeType: 'wheel',
            wheelOutcome: rolled.outcome,
            xp: rolled.xp,
            gold: rolled.gold,
            lootItem: null,
            duplicateGold: 0,
            duplicateCatalogId: null,
            progress: rolled.progress,
            taskTitle: rolled.task?.title ?? null,
          })}
        </Text>
      </Panel>

      <Button onPress={done} full>
        Done
      </Button>
      <Text variant="caption" tone="soft" style={styles.note}>
        Done records the outcome and returns to the map. The wheel cannot be spun again.
      </Text>
    </Screen>
  )
}

const styles = StyleSheet.create({
  crest: { width: 52, height: 52, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  task: { gap: 2, marginBottom: space.md },
  rewards: { gap: space.xs },
  feedback: { marginTop: space.md },
  note: { textAlign: 'center', marginTop: space.sm },
})
