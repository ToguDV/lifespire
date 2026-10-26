import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import {
  currentDay,
  nodeProgress,
  nodeStatus,
  objectiveProgress,
  resolveNodeById,
  rollWheelOutcome,
} from '@lifespire/core'
import type { MapNode, Run } from '@lifespire/core'
import { EFFORT_LABEL, NODE_TYPE_ICON, NODE_TYPE_LABEL, goalIconFor } from '@lifespire/app-core/ui/format'
import { effortNote, nodeFlavor, nodeTitle } from '@lifespire/app-core/ui/nodeCopy'
import { rewardFeedback } from '@lifespire/app-core/ui/daySummary'
import { useTheme } from '../theme/ThemeProvider'
import { space } from '../theme/tokens'
import { Button } from '../components/Button'
import { Chip } from '../components/Chip'
import { FactCell, FactsRow } from '../components/FactsRow'
import { HeroArt } from '../components/HeroArt'
import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'
import { Panel, ScreenHead } from '../components/Panel'
import { Pips } from '../components/Progress'
import { Screen } from '../components/Screen'
import { Text } from '../components/Text'
import { Wheel } from '../components/Wheel'
import type { WheelPhase } from '../components/Wheel'
import { playForRewardEvent } from '../lib/resolveFeedback'
import { playFeedback } from '../state/feedback'
import { useAppStore } from '../state/store'

type WheelRoll = NonNullable<ReturnType<typeof rollWheelOutcome>>

function AimProgress({ run, node }: { run: Run; node: MapNode }) {
  const { colors } = useTheme()
  if (!node.task) return null
  const objective = objectiveProgress(run, node.task.goalId)
  const before = objective?.progress ?? 0
  const target = objective?.target ?? 0
  const met = target > 0 && before >= target
  const after = met ? before : Math.min(target || before + 1, before + 1)
  return (
    <View
      style={styles.aim}
      accessible
      accessibilityLabel={
        target > 0
          ? `${node.task.goalTitle}: ${before} of ${target} complete. ${
              met ? 'Target met' : `After this step: ${after} of ${target}`
            }`
          : node.task.goalTitle
      }
    >
      {target > 0 ? <Pips total={target} filled={before} /> : null}
      <View style={styles.aimAfter}>
        <Icon name={met ? 'check' : 'plus'} size={13} color={colors.accentDeep} />
        <Text variant="micro" tone={met ? 'accent' : 'soft'}>
          {met ? 'Target met' : `After this step: ${after} of ${target}`}
        </Text>
      </View>
    </View>
  )
}

function Hint({ icon, children }: { icon: IconName; children: string }) {
  const { colors } = useTheme()
  return (
    <View style={styles.hint}>
      <Icon name={icon} size={15} color={colors.inkSoft} />
      <Text variant="bodySm" tone="muted" style={styles.hintText}>
        {children}
      </Text>
    </View>
  )
}

export function NodeScreen({ nodeId }: { nodeId: string }) {
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
  const bossTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [wheelPhase, setWheelPhase] = useState<WheelPhase>('idle')
  const [frozenRoll, setFrozenRoll] = useState<WheelRoll | null>(null)

  useEffect(
    () => () => {
      if (bossTimer.current !== null) clearTimeout(bossTimer.current)
    },
    [],
  )

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
        <ScreenHead
          kicker="Node detail"
          title="This step is not open."
          subtitle="Return to the map to choose an available node."
          aside={
            <Button small variant="secondary" onPress={() => navigate({ name: 'map' })}>
              Return to the map
            </Button>
          }
        />
      </Screen>
    )
  }

  const record = (action: 'complete' | 'skip') => {
    if (resolving.current) return
    resolving.current = true
    const bossBefore = day.map ? nodeStatus(day.map, day, day.map.boss.id) : null
    resolveNode(node.id, action)
    const state = useAppStore.getState()
    const resolvedDay = state.document.run?.days.find((candidate) => candidate.id === day.id)
    const event = resolvedDay?.rewards.find((candidate) => candidate.nodeId === node.id)
    if (!event) {
      resolving.current = false
      return
    }
    playForRewardEvent(event)
    if (
      resolvedDay?.map &&
      bossBefore !== 'available' &&
      bossBefore !== 'current'
    ) {
      const bossAfter = nodeStatus(resolvedDay.map, resolvedDay, resolvedDay.map.boss.id)
      if (bossAfter === 'available' || bossAfter === 'current') {
        bossTimer.current = setTimeout(() => playFeedback('bossUnlock'), 180)
      }
    }
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
  // Freeze the preview when the player commits to the spin so a sync that
  // changes goals mid-animation cannot relabel the sector under the pointer.
  const wheelRoll = frozenRoll ?? rolled
  const revealedWheel = isWheel && wheelPhase === 'revealed' ? wheelRoll : null
  const weeklyProgress = revealedWheel?.progress ? 1 : nodeProgress(run, node)
  const goalCrest = node.task ? (goalIconFor(document.goals, node.task.goalId) ?? 'banner') : null
  const crest = goalCrest ?? NODE_TYPE_ICON[node.type]
  const lootRolls = node.rewards.lootRolls
  const skipHint = 'Skipping grants no rewards; it only advances the path.'

  return (
    <Screen>
      <NodeBackLink />
      <Panel pad={false} style={styles.spread}>
        <HeroArt
          icon={crest}
          kicker={`${NODE_TYPE_LABEL[node.type]} node`}
          title={nodeTitle(node)}
          flavor={nodeFlavor(node)}
        />

        <View style={styles.body}>
          <View style={styles.tags}>
            <Chip variant="accent" icon={crest}>
              {node.task
                ? node.task.goalTitle
                : isWheel
                  ? NODE_TYPE_LABEL[node.type]
                  : `${NODE_TYPE_LABEL[node.type]} · no task`}
            </Chip>
          </View>

          {isWheel && wheelRoll ? (
            <Wheel
              key={node.id}
              segmentIndex={wheelRoll.segmentIndex}
              result={{
                outcome: wheelRoll.outcome,
                taskTitle: wheelRoll.task?.title ?? null,
                xp: wheelRoll.xp,
                gold: wheelRoll.gold,
                progress: wheelRoll.progress,
              }}
              onRecap={goRecap}
              onPhaseChange={(phase) => {
                if (phase === 'spinning' && !frozenRoll && rolled) setFrozenRoll(rolled)
                setWheelPhase(phase)
              }}
            />
          ) : null}

          <FactsRow style={styles.factsMargin}>
            <FactCell
              label="Effort"
              value={node.task ? EFFORT_LABEL[node.task.effort] : '—'}
              note={effortNote(node)}
            />
            {node.type === 'wheel' ? (
              <FactCell label="Reward" icon="wheel" value="Surprise" note="Task, gold, XP or rest" />
            ) : node.type === 'treasure' ? (
              <FactCell
                label="Reward"
                icon="coin"
                value={`+${node.rewards.gold}`}
                note={`${lootRolls} loot roll${lootRolls === 1 ? '' : 's'}`}
              />
            ) : (
              <FactCell
                label="Reward"
                icon="star"
                value={`+${node.rewards.xp}`}
                note={`${node.rewards.gold > 0 ? `+${node.rewards.gold} gold` : 'A small recovery'}${lootRolls > 0 ? ` · ${lootRolls} loot roll${lootRolls === 1 ? '' : 's'}` : ''}${node.type === 'boss' ? ' (includes closing bonus)' : ''}`}
              />
            )}
            <FactCell
              label="Goal"
              value={weeklyProgress > 0 ? '+1' : '—'}
              note={weeklyProgress > 0 ? 'This week' : 'No weekly progress'}
              last
            />
          </FactsRow>

          {node.task ? <AimProgress run={run} node={node} /> : null}
          {isWheel && wheelPhase !== 'revealed' ? (
            <Hint icon="wheel">Spin to reveal: task, gold, XP or rest.</Hint>
          ) : null}
          {node.type === 'boss' ? (
            <Hint icon="crown">Skipping closes the day without the closing bonus.</Hint>
          ) : null}

          {isWheel ? (
            wheelPhase === 'revealed' ? null : (
              <View style={styles.actions}>
                <Button
                  variant="quiet"
                  disabled={wheelPhase === 'spinning'}
                  accessibilityHint={skipHint}
                  onPress={() => record('skip')}
                  full
                >
                  Skip this step
                </Button>
              </View>
            )
          ) : (
            <View style={styles.actions}>
              <Button icon="check" onPress={() => record('complete')} full>
                Mark complete
              </Button>
              <Button
                variant="quiet"
                accessibilityHint={skipHint}
                onPress={() => record('skip')}
                full
              >
                Skip this step
              </Button>
            </View>
          )}
        </View>
      </Panel>
    </Screen>
  )
}

function NodeBackLink() {
  const navigate = useAppStore((state) => state.navigate)
  const { colors } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to the map"
      onPress={() => navigate({ name: 'map' })}
      android_ripple={{ color: colors.accentWash }}
      style={styles.backLink}
      hitSlop={12}
    >
      <Icon name="arrow-left" size={16} color={colors.inkMuted} />
      <Text variant="button" tone="muted">
        Back to the map
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    // 6px icon-text rhythm; no token covers it.
    gap: 6,
    minHeight: 48,
    justifyContent: 'center',
    paddingRight: 12,
  },
  spread: { overflow: 'hidden' },
  body: { padding: 18 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  factsMargin: { marginTop: 16 },
  aim: { gap: space.xs, marginTop: space.md },
  // 6px icon-text rhythm; no token covers it.
  aimAfter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.xs },
  hint: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs, marginTop: space.md },
  hintText: { flex: 1 },
  actions: { gap: space.sm, marginTop: space.sm },
})
