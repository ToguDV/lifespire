import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
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
import { EFFORT_LABEL, NODE_TYPE_ICON, NODE_TYPE_LABEL, goalIconFor } from '@lifespire/app-core/ui/format'
import {
  effortNote,
  nodeFlavor,
  nodeTitle,
  nodeTypeLine,
} from '@lifespire/app-core/ui/nodeCopy'
import { rewardFeedback } from '@lifespire/app-core/ui/daySummary'
import { useTheme } from '../theme/ThemeProvider'
import { fonts, radius, space } from '../theme/tokens'
import { Button } from '../components/Button'
import { Chip } from '../components/Chip'
import { EmptyState } from '../components/EmptyState'
import { FactCell, FactsRow } from '../components/FactsRow'
import { HeroArt } from '../components/HeroArt'
import { Icon } from '../components/Icon'
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
    <View style={styles.aim}>
      <View style={styles.aimHead}>
        <Text variant="bodySm">{node.task.goalTitle}</Text>
        <Text variant="caption" tone="muted" style={styles.aimCount}>
          {before} of {target} this week
        </Text>
      </View>
      {target > 0 ? <Pips total={target} filled={before} /> : null}
      <View style={styles.aimAfter}>
        <Icon name={met ? 'check' : 'plus'} size={13} color={colors.accentDeep} />
        <Text variant="micro" tone={met ? 'accent' : 'soft'}>
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

function Note({ icon, text }: { icon: 'campfire' | 'chest' | 'wheel' | 'elite' | 'crown' | 'lock'; text: string }) {
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
  const weeklyGoalTitle = revealedWheel?.task?.goalTitle ?? node.task?.goalTitle ?? null
  const goalCrest = node.task ? (goalIconFor(document.goals, node.task.goalId) ?? 'banner') : null
  const crest = goalCrest ?? NODE_TYPE_ICON[node.type]
  const lootRolls = node.rewards.lootRolls
  const skipNote = `Skipping grants no XP, gold, loot or weekly progress; it only advances the path.${
    node.type === 'boss' ? ' Skipping the boss closes the day without the closing bonus.' : ''
  }`

  return (
    <Screen>
      <NodeBackLink />
      <Panel pad={false} style={styles.spread}>
        <HeroArt
          icon={crest}
          kicker={isWheel ? 'Wheel node' : nodeTypeLine(node)}
          title={nodeTitle(node)}
          flavor={nodeFlavor(node)}
        />

        <View style={styles.body}>
          <View style={styles.tags}>
            <Chip variant="accent" icon={crest}>
              {node.task ? node.task.goalTitle : isWheel ? NODE_TYPE_LABEL[node.type] : `${NODE_TYPE_LABEL[node.type]} · no task`}
            </Chip>
            {weeklyProgress > 0 ? (
              <Chip icon="plus">+1 toward weekly target</Chip>
            ) : (
              <Chip variant="quiet">No weekly progress</Chip>
            )}
            {lootRolls > 0 ? (
              <Chip icon="gem">
                {lootRolls} loot roll{lootRolls === 1 ? '' : 's'}
              </Chip>
            ) : null}
            {node.type === 'boss' ? (
              <Chip variant="quiet" icon="crown">
                Closing bonus
              </Chip>
            ) : null}
            <Chip variant="quiet" icon="check">
              Chosen
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
              <FactCell label="Outcome" icon="wheel" value="Surprise" note="Task, gold, XP or rest" />
            ) : node.type === 'treasure' ? (
              <FactCell
                label="Fortune"
                icon="coin"
                value={`+${node.rewards.gold}`}
                note={`${lootRolls} loot roll${lootRolls === 1 ? '' : 's'}`}
              />
            ) : (
              <FactCell
                label="Experience"
                icon="star"
                value={`+${node.rewards.xp}`}
                note={`${node.rewards.gold > 0 ? `+${node.rewards.gold} gold` : 'A small recovery'}${lootRolls > 0 ? ` · ${lootRolls} loot roll${lootRolls === 1 ? '' : 's'}` : ''}`}
              />
            )}
            <FactCell
              label="Goal"
              value={weeklyProgress > 0 ? '+1' : '—'}
              note={weeklyProgress > 0 && weeklyGoalTitle ? `${weeklyGoalTitle} this week` : 'No weekly progress'}
              last
            />
          </FactsRow>

          {node.task ? <AimProgress run={run} node={node} /> : null}
          <NodeNotes node={node} />

          {node.type === 'boss' ? (
            <View style={[styles.bonus, { borderColor: colors.hairline, backgroundColor: colors.surfaceRaised }]}>
              <Text variant="micro" tone="muted">
                CLOSING BONUS
              </Text>
              <Text style={[styles.bonusValue, { color: colors.ink }]}>
                +{BOSS_CLOSING_BONUS.xp} XP · +{BOSS_CLOSING_BONUS.gold} gold
              </Text>
              <Text variant="bodySm" tone="muted">
                Already included in the boss total above. Granted only when the boss is completed.
              </Text>
            </View>
          ) : null}

          <Button small variant="ghost" onPress={() => navigate({ name: 'goals' })}>
            All weekly goals
          </Button>

          {isWheel ? (
            wheelPhase === 'revealed' ? null : (
              <>
                <Note icon="lock" text={skipNote} />
                <View style={styles.actions}>
                  <Button
                    variant="quiet"
                    disabled={wheelPhase === 'spinning'}
                    onPress={() => record('skip')}
                    full
                  >
                    Skip this step
                  </Button>
                </View>
              </>
            )
          ) : (
            <>
              <Note icon="lock" text={skipNote} />
              <View style={styles.actions}>
                <Button icon="check" onPress={() => record('complete')} full>
                  Mark complete
                </Button>
                <Button variant="quiet" onPress={() => record('skip')} full>
                  Skip this step
                </Button>
              </View>
            </>
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
  aimHead: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  aimCount: { fontVariant: ['tabular-nums'] },
  // 6px icon-text rhythm; no token covers it.
  aimAfter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.xs },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs, borderWidth: 1, borderRadius: radius.md, padding: space.sm, marginTop: space.md },
  noteText: { flex: 1 },
  bonus: {
    marginTop: 16,
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
  },
  bonusValue: { fontFamily: fonts.display, fontSize: 15, lineHeight: 19 },
  actions: { gap: space.sm, marginTop: space.sm },
})
