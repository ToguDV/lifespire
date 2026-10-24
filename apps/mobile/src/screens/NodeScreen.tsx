import { useMemo, useRef, useState } from 'react'
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
  const goalCrest = node.task ? (goalIconFor(document.goals, node.task.goalId) ?? 'banner') : null
  const crest = goalCrest ?? NODE_TYPE_ICON[node.type]
  const lootRolls = node.rewards.lootRolls

  return (
    <Screen>
      <NodeBackLink />
      <Panel pad={false} style={styles.spread}>
        <View style={[styles.art, { backgroundColor: colors.surfaceSunken, borderColor: colors.hairline }]}>
          <View style={styles.medallionStage}>
            <View style={[styles.ringOuter, { borderColor: colors.hairline }]} pointerEvents="none" />
            <View style={[styles.ringInner, { borderColor: colors.hairlineStrong }]} pointerEvents="none" />
            <View style={[styles.halo, { backgroundColor: colors.accentSoft }]} />
            <View style={[styles.medallion, { backgroundColor: colors.surfaceRaised, borderColor: colors.accent }]}>
              <Icon name={crest} size={34} color={colors.accentDeep} />
            </View>
          </View>
          <Text variant="micro" tone="muted" style={styles.kicker}>
            {isWheel ? 'Wheel node' : nodeTypeLine(node)}
          </Text>
          <Text style={[styles.title, { color: colors.ink }]} accessibilityRole="header">
            {nodeTitle(node)}
          </Text>
          <Text style={[styles.flavor, { color: colors.inkMuted }]}>{nodeFlavor(node)}</Text>
        </View>

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

          <View style={[styles.facts, { backgroundColor: colors.surfaceRaised, borderColor: colors.hairline }]}>
            <NodeFact
              label="Effort"
              value={node.task ? EFFORT_LABEL[node.task.effort] : '—'}
              note={effortNote(node)}
            />
            {node.type === 'wheel' ? (
              <NodeFact label="Outcome" icon="wheel" value="Surprise" note="Task, gold, XP or rest" />
            ) : node.type === 'treasure' ? (
              <NodeFact
                label="Fortune"
                icon="coin"
                value={`+${node.rewards.gold}`}
                note={`${lootRolls} loot roll${lootRolls === 1 ? '' : 's'}`}
              />
            ) : (
              <NodeFact
                label="Experience"
                icon="star"
                value={`+${node.rewards.xp}`}
                note={`${node.rewards.gold > 0 ? `+${node.rewards.gold} gold` : 'A small recovery'}${lootRolls > 0 ? ` · ${lootRolls} loot roll${lootRolls === 1 ? '' : 's'}` : ''}`}
              />
            )}
            <NodeFact
              label="Goal"
              value={weeklyProgress > 0 ? '+1' : '—'}
              note={weeklyProgress > 0 && node.task ? `${node.task.goalTitle} this week` : 'No weekly progress'}
              last
            />
          </View>

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
              <Button icon="check" onPress={() => record('complete')} full>
                Mark complete
              </Button>
              <Button variant="quiet" onPress={() => record('skip')} full>
                Skip this step
              </Button>
            </View>
          )}

          <Text variant="caption" tone="soft" style={styles.skipNote}>
            Skipping grants no XP, gold, loot or weekly progress; it only advances the path.
            {node.type === 'boss' ? ' Skipping the boss closes the day without the closing bonus.' : ''}
          </Text>
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
    >
      <Icon name="arrow-left" size={16} color={colors.inkMuted} />
      <Text variant="button" tone="muted">
        Back to the map
      </Text>
    </Pressable>
  )
}

function NodeFact({
  label,
  value,
  note,
  icon,
  last = false,
}: {
  label: string
  value: string
  note: string
  icon?: 'wheel' | 'coin' | 'star'
  last?: boolean
}) {
  const { colors } = useTheme()
  return (
    <View style={[styles.fact, last ? null : { borderColor: colors.hairline, borderRightWidth: 1 }]}>
      <Text variant="micro" tone="muted" style={styles.factLabel}>
        {label.toUpperCase()}
      </Text>
      <View style={styles.factValue}>
        {icon ? <Icon name={icon} size={14} color={colors.accentDeep} /> : null}
        <Text style={[styles.factStrong, { color: colors.inkStrong }]}>{value}</Text>
      </View>
      <Text style={[styles.factNote, { color: colors.inkSoft }]} numberOfLines={3}>
        {note}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 8,
    paddingRight: 12,
  },
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
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  facts: {
    flexDirection: 'row',
    marginTop: 16,
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  fact: { flex: 1, gap: 4, paddingVertical: 11, paddingHorizontal: 10 },
  factLabel: { fontSize: 10, letterSpacing: 1 },
  factValue: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  factStrong: {
    fontFamily: fonts.display,
    fontSize: 15,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  factNote: { fontSize: 10, lineHeight: 13 },
  aim: { gap: space.xs, marginTop: space.md },
  aimHead: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  aimCount: { fontVariant: ['tabular-nums'] },
  aimAfter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 9 },
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
  actions: { gap: space.sm },
  wheelNote: { textAlign: 'center', marginVertical: space.sm },
  skipNote: { marginBottom: space.md, textAlign: 'center' },
})
