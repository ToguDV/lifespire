import { useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import {
  BOSS_CLOSING_BONUS,
  currentDay,
  nodeProgress,
  nodeStatus,
  objectiveProgress,
  resolveNodeById,
  rollWheelOutcome,
} from '@lifespire/core'
import type { MapNode, Run } from '@lifespire/core'
import { NODE_TYPE_ICON, NODE_TYPE_LABEL, goalIconFor } from '@lifespire/app-core/ui/format'
import {
  effortNote,
  nodeFlavor,
  nodeRewardLine,
  nodeTitle,
  nodeTypeLine,
} from '@lifespire/app-core/ui/nodeCopy'
import { rewardFeedback } from '@lifespire/app-core/ui/daySummary'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { Button } from '../components/Button'
import { EffortDots } from '../components/EffortDots'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { Panel, PanelHead, ScreenHead } from '../components/Panel'
import { Pips } from '../components/Progress'
import { Screen } from '../components/Screen'
import { Text } from '../components/Text'
import { Wheel } from '../components/Wheel'
import { playForRewardEvent } from '../lib/resolveFeedback'
import { useAppStore } from '../state/store'

function AimProgress({ run, node }: { run: Run; node: MapNode }) {
  const { colors } = useTheme()
  if (!node.task) return null
  const objective = objectiveProgress(run, node.task.goalId)
  const before = objective?.progress ?? 0
  const target = objective?.target ?? 0
  const met = target > 0 && before >= target
  const after = met ? before : Math.min(target || before + 1, before + 1)
  return (
    <View style={styles.aim}>
      <View style={styles.aimHead}>
        <Text variant="bodySm">{node.task.goalTitle}</Text>
        <Text variant="caption" tone="muted">
          {before} of {target} this week
        </Text>
      </View>
      {target > 0 ? <Pips total={target} filled={before} /> : null}
      <View style={styles.aimAfter}>
        <Icon name={met ? 'check' : 'plus'} size={13} color={met ? colors.accent : colors.inkMuted} />
        <Text variant="caption" tone={met ? 'accent' : 'muted'}>
          {met ? 'Already met' : `After this step · ${after} of ${target}`}
        </Text>
      </View>
    </View>
  )
}

function NodeNotes({ node }: { node: MapNode }) {
  if (node.type === 'rest') {
    return (
      <Note icon="campfire" text={`No task. This rest grants ${node.rewards.xp} XP and does not advance the week.`} />
    )
  }
  if (node.type === 'treasure') {
    return (
      <Note
        icon="chest"
        text={`No task. This cache grants ${node.rewards.gold} gold and ${node.rewards.lootRolls} loot roll; weekly progress is unchanged.`}
      />
    )
  }
  if (node.type === 'wheel') {
    return (
      <Note
        icon="wheel"
        text="A turn of the wheel: it may ask for a task (more likely for goals still pending), or grant gold, XP or rest. The result is revealed when you keep the step."
      />
    )
  }
  if (node.type === 'elite') {
    return (
      <Note
        icon="elite"
        text="Elite rewards are doubled and include a loot roll. Weekly progress still advances by one."
      />
    )
  }
  if (node.type === 'boss') {
    return (
      <Note
        icon="crown"
        text={`Completing the boss closes the day with a closing bonus of ${BOSS_CLOSING_BONUS.xp} XP and ${BOSS_CLOSING_BONUS.gold} gold. Skipping closes it without the bonus.`}
      />
    )
  }
  return null
}

function Note({ icon, text }: { icon: 'campfire' | 'chest' | 'wheel' | 'elite' | 'crown'; text: string }) {
  const { colors } = useTheme()
  return (
    <View style={[styles.note, { backgroundColor: colors.accentWash, borderColor: colors.hairline }]}>
      <Icon name={icon} size={16} color={colors.accent} />
      <Text variant="bodySm" tone="muted" style={styles.noteText}>
        {text}
      </Text>
    </View>
  )
}

export function NodeScreen({ nodeId }: { nodeId: string }) {
  const { colors } = useTheme()
  const document = useAppStore((state) => state.document)
  const navigate = useAppStore((state) => state.navigate)
  const resolveNode = useAppStore((state) => state.resolveNode)
  const showRewardToast = useAppStore((state) => state.showRewardToast)
  const showToast = useAppStore((state) => state.showToast)
  const run = document.run
  const day = currentDay(run)
  const map = day?.map ?? null
  const node = map ? resolveNodeById(map, nodeId) : null
  const status = map && day && node ? nodeStatus(map, day, nodeId) : 'locked'
  const resolving = useRef(false)
  const [spinning, setSpinning] = useState(node?.type === 'wheel')

  const rolled = useMemo(() => {
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

  if (!node || !day || !map || !run || status !== 'current') {
    return (
      <Screen>
        <ScreenHead kicker="The climb" title="Step" />
        <Panel>
          <EmptyState icon="lock" title="This step is not open">
            Only the current node can be resolved. Return to the map and choose a connected step.
          </EmptyState>
          <Button variant="secondary" onPress={() => navigate({ name: 'map' })} full>
            Back to the map
          </Button>
        </Panel>
      </Screen>
    )
  }

  const record = (action: 'complete' | 'skip') => {
    if (resolving.current) return
    resolving.current = true
    resolveNode(node.id, action)
    const state = useAppStore.getState()
    const resolvedDay = state.document.run?.days.find((candidate) => candidate.id === day.id)
    const event = resolvedDay?.rewards.find((candidate) => candidate.nodeId === node.id)
    if (!event) {
      resolving.current = false
      return
    }
    playForRewardEvent(event)
    if (node.type === 'boss') {
      navigate({ name: 'day-summary', dayId: day.id })
      return
    }
    if (action === 'complete') {
      showRewardToast(event)
    } else {
      showToast(rewardFeedback(event))
    }
    navigate({ name: 'map' })
  }

  const goRecap = () => {
    const state = useAppStore.getState()
    if (state.view.name === 'node' && state.view.nodeId === node.id) {
      state.navigate({ name: 'reward', nodeId: node.id })
    }
  }

  const isWheel = node.type === 'wheel'
  const weeklyProgress = nodeProgress(run, node)
  const crest = node.task ? goalIconFor(document.goals, node.task.goalId) ?? 'banner' : NODE_TYPE_ICON[node.type]

  return (
    <Screen>
      <ScreenHead
        kicker={nodeTypeLine(node)}
        title={nodeTitle(node)}
        subtitle={
          <Text variant="bodyMd" tone="muted">
            {nodeFlavor(node)}
          </Text>
        }
        aside={
          <View style={[styles.crest, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
            <Icon name={crest} size={22} color={colors.accentDeep} />
          </View>
        }
      />

      <Panel>
        <PanelHead
          label="The step"
          aside={
            node.task ? (
              <EffortDots effort={node.task.effort} />
            ) : (
              <Text variant="caption" tone="soft">
                {NODE_TYPE_LABEL[node.type]}
              </Text>
            )
          }
        />
        {node.task ? (
          <>
            <Text variant="headingSm">{node.task.goalTitle}</Text>
            <Text variant="caption" tone="muted">
              {effortNote(node)}
            </Text>
            <View style={styles.rewards}>
              {node.rewards.xp > 0 ? (
                <Text variant="bodySm" tone="xp">{`+${node.rewards.xp} XP`}</Text>
              ) : null}
              {node.rewards.gold > 0 ? (
                <Text variant="bodySm" tone="gold">{`+${node.rewards.gold} gold`}</Text>
              ) : null}
              {node.rewards.lootRolls > 0 ? (
                <Text variant="bodySm" tone="accent">
                  {node.rewards.lootRolls} loot roll
                </Text>
              ) : null}
              {weeklyProgress > 0 ? (
                <Text variant="bodySm" tone="accent">
                  +1 weekly target
                </Text>
              ) : null}
            </View>
            <AimProgress run={run} node={node} />
          </>
        ) : (
          <Text variant="bodyMd" tone="muted">
            {nodeRewardLine(node, weeklyProgress)}
          </Text>
        )}
        <NodeNotes node={node} />
      </Panel>

      {isWheel ? (
        <Panel>
          <PanelHead label="The wheel" aside={<Text variant="caption" tone="soft">{spinning ? 'Turning' : 'Settled'}</Text>} />
          <Wheel
            segmentIndex={rolled?.segmentIndex ?? 0}
            disabled={!spinning}
            onSettled={() => {
              setSpinning(false)
              goRecap()
            }}
          />
          <Text variant="caption" tone="muted" style={styles.wheelNote}>
            The outcome is fixed when you spin. After it settles the recap opens on its own and
            there is no second spin.
          </Text>
          <Button variant="quiet" onPress={() => record('skip')} full>
            Skip the wheel
          </Button>
        </Panel>
      ) : (
        <View style={styles.actions}>
          <Button onPress={() => record('complete')} full>
            {node.type === 'boss' ? 'Complete the boss' : 'Mark it done'}
          </Button>
          <Button variant="secondary" onPress={() => record('skip')} full>
            Skip this step
          </Button>
        </View>
      )}

      <Text variant="caption" tone="soft" style={styles.skipNote}>
        Skipping grants no XP, gold, loot or weekly progress; it only advances the path.
        {node.type === 'boss' ? ' Skipping the boss closes the day without the closing bonus.' : ''}
      </Text>

      <Button variant="quiet" icon="arrow-left" onPress={() => navigate({ name: 'map' })} full>
        Back to the map
      </Button>
    </Screen>
  )
}

const styles = StyleSheet.create({
  crest: { width: 52, height: 52, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  aim: { gap: space.xs, marginTop: space.md },
  aimHead: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  aimAfter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs, borderWidth: 1, borderRadius: radius.md, padding: space.sm, marginTop: space.md },
  noteText: { flex: 1 },
  rewards: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.sm },
  actions: { gap: space.sm, marginTop: space.sm },
  wheelNote: { textAlign: 'center', marginVertical: space.sm },
  skipNote: { marginVertical: space.md, textAlign: 'center' },
})
