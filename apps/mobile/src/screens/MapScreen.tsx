import { useState } from 'react'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Svg, { G, Path } from 'react-native-svg'
import {
  RUN_DAYS,
  availableNodeIds,
  currentDay,
  nodeProgress,
  resolveNodeById,
} from '@lifespire/core'
import type { Day, GameMap, Goal, MapNode, NodeType, Run } from '@lifespire/core'
import {
  EFFORT_LABEL,
  NODE_TYPE_ICON,
  NODE_TYPE_LABEL,
  goalIconFor,
  romanDay,
} from '@lifespire/app-core/ui/format'
import { MAP_HEIGHT, MAP_WIDTH } from '@lifespire/app-core/ui/mapLayout'
import { nodeRewardLine, nodeTitle } from '@lifespire/app-core/ui/nodeCopy'
import { deriveMapDayState } from '../lib/mapState'
import { playFeedback } from '../state/feedback'
import { useTheme } from '../theme/ThemeProvider'
import { fonts, radius, shadows, space } from '../theme/tokens'
import { Button } from '../components/Button'
import { Chip } from '../components/Chip'
import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'
import { MapCanvas } from '../components/MapCanvas'
import { Panel, PanelHead, ScreenHead } from '../components/Panel'
import { Screen } from '../components/Screen'
import { Text } from '../components/Text'
import { useAppStore } from '../state/store'

const LEGEND: Array<{ type: NodeType; icon?: IconName; copy: string }> = [
  { type: 'task', icon: 'banner', copy: '+1 goal · XP/gold by effort' },
  { type: 'elite', icon: 'star', copy: '+1 goal · double reward · loot roll' },
  { type: 'rest', copy: '+5 XP' },
  { type: 'treasure', copy: '+15 gold · loot roll' },
  { type: 'wheel', copy: 'task, gold, XP or rest' },
  { type: 'boss', icon: 'crown', copy: '+1 goal · closing bonus' },
]

/** Decorative silhouettes behind the empty frame, from the web map. */
const EMPTY_CONTOURS = [
  'M-30 610c100-26 150 32 245 4s150-62 245-38 90 22 120 8',
  'M-20 470c92-22 140 34 232 8s148-56 238-36 92 14 130-2',
  'M-30 332c96-24 150 34 244 8s150-54 240-34 90 10 120-4',
  'M-20 204c88-22 142 32 234 8s150-52 238-32 92 8 128-4',
  'M-30 678c104-18 162 24 268 4s180-24 352-12',
  'M-30 112c112-16 166 22 270 4s190-20 350-10',
]

function ChoiceRow({
  nodeId,
  map,
  run,
  goals,
  open,
  onChoose,
}: {
  nodeId: string
  map: Parameters<typeof resolveNodeById>[0]
  run: Parameters<typeof nodeProgress>[0]
  goals: Goal[]
  open: boolean
  onChoose: (nodeId: string) => void
}) {
  const { colors } = useTheme()
  const node = resolveNodeById(map, nodeId)
  if (!node) return null
  const meta = [NODE_TYPE_LABEL[node.type]]
  if (node.task) meta.push(`${EFFORT_LABEL[node.task.effort]} effort`)
  meta.push(nodeRewardLine(node, nodeProgress(run, node)))
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${nodeTitle(node)}, ${meta.join(', ')}`}
      onPress={() => onChoose(nodeId)}
      android_ripple={{ color: colors.accentWash }}
      style={({ pressed }) => [
        styles.choice,
        {
          backgroundColor: colors.surfaceRaised,
          borderColor: open ? colors.accent : colors.hairline,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.choiceIcon,
          {
            backgroundColor: open ? colors.accentSoft : colors.surface,
            borderColor: open ? colors.accent : colors.hairline,
          },
        ]}
      >
        <Icon
          name={goalIconFor(goals, node.task?.goalId) ?? NODE_TYPE_ICON[node.type]}
          size={18}
          color={colors.accentDeep}
        />
      </View>
      <View style={styles.choiceBody}>
        <Text style={[styles.choiceTitle, { color: colors.inkStrong }]} numberOfLines={1}>
          {nodeTitle(node)}
        </Text>
        <Text style={[styles.choiceMeta, { color: colors.inkSoft }]} numberOfLines={2}>
          {meta.join(' · ')}
        </Text>
      </View>
      <Icon name="chevron-right" size={15} color={colors.inkSoft} />
    </Pressable>
  )
}

function MapRail({
  run,
  day,
  map,
  goals,
  onChoose,
  onGoals,
}: {
  run: Run
  day: Day | null
  map: GameMap | null
  goals: Goal[]
  onChoose: (nodeId: string) => void
  onGoals: () => void
}) {
  const { colors } = useTheme()
  const [legendOpen, setLegendOpen] = useState(false)
  const available = map && day ? availableNodeIds(map, day) : []
  const nodes = map
    ? available
        .map((nodeId) => resolveNodeById(map, nodeId))
        .filter((node): node is MapNode => node !== null)
    : []
  const current = map?.currentNodeId ? resolveNodeById(map, map.currentNodeId) : null
  const runClosed = run.status === 'closed' || !day
  const daySealed = day?.status === 'completed' || day?.status === 'missed'
  const dayLocked = day?.status === 'locked'
  const noChoiceState = runClosed || daySealed || dayLocked
  const onTrack = run.objectives.filter(
    (objective) => objective.progress >= objective.target,
  ).length
  const totalGoals = run.objectives.length
  const footIcon: IconName = current ? 'check' : 'lock'

  return (
    <>
      <Panel>
        <PanelHead
          label="Next step"
          aside={
            <Chip variant="quiet">
              {nodes.length} {nodes.length === 1 ? 'choice' : 'choices'}
            </Chip>
          }
        />
        {map && nodes.length > 0 ? (
          <View style={styles.choices}>
            {nodes.map((node, index) => (
              <ChoiceRow
                key={node.id}
                nodeId={node.id}
                map={map}
                run={run}
                goals={goals}
                open={index === 0}
                onChoose={onChoose}
              />
            ))}
          </View>
        ) : (
          <View style={styles.foot}>
            <Icon name={footIcon} size={13} color={colors.inkSoft} />
            <Text variant="caption" tone="soft" style={styles.footText}>
              {noChoiceState ? 'No step can be chosen on this day.' : 'No step is open on this path.'}
            </Text>
          </View>
        )}
      </Panel>

      {totalGoals > 0 ? (
        <Panel>
          <PanelHead
            label={`${onTrack} of ${totalGoals} goals on track`}
            aside={
              <Button small variant="ghost" onPress={onGoals}>
                All goals
              </Button>
            }
          />
        </Panel>
      ) : null}

      <Panel>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Node key"
          accessibilityState={{ expanded: legendOpen }}
          accessibilityHint={legendOpen ? 'Hide the node key.' : 'Show the node key.'}
          onPress={() => setLegendOpen((value) => !value)}
          style={styles.legendToggle}
        >
          <Text variant="micro" tone="muted">
            NODE KEY
          </Text>
          <View style={legendOpen ? styles.chevronOpen : undefined}>
            <Icon name="chevron-right" size={15} color={colors.inkMuted} />
          </View>
        </Pressable>
        {legendOpen ? (
          <View style={styles.legend}>
            {LEGEND.map((item, index) => (
              <View
                key={item.type}
                style={[
                  styles.legendRow,
                  index > 0 ? { borderTopWidth: 1, borderColor: colors.hairline } : null,
                ]}
              >
                <Icon name={item.icon ?? NODE_TYPE_ICON[item.type]} size={14} color={colors.inkMuted} />
                <Text style={[styles.legendType, { color: colors.inkMuted }]}>
                  {NODE_TYPE_LABEL[item.type]}
                </Text>
                <Text variant="caption" tone="soft" style={styles.legendCopy}>
                  {item.copy}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Panel>
    </>
  )
}

function EmptyMapFrame({
  icon,
  day,
  action,
}: {
  icon: IconName
  day: Day | null
  action: ReactNode
}) {
  const { colors } = useTheme()
  return (
    <View
      style={[styles.frame, { backgroundColor: colors.surface, borderColor: colors.hairline, ...shadows.soft }]}
    >
      <View style={styles.frameMeta} pointerEvents="none">
        <Text style={[styles.frameDay, { color: colors.inkSoft }]}>
          {day ? `Day ${romanDay(day.index)}` : '—'}
        </Text>
      </View>
      <View style={[styles.frameInset, { borderColor: colors.hairline }]} pointerEvents="none" />
      <View style={styles.emptyBody}>
        <Svg
          style={StyleSheet.absoluteFill}
          width="100%"
          height="100%"
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          preserveAspectRatio="xMidYMid slice"
          pointerEvents="none"
          accessible={false}
        >
          <G stroke={colors.hairline} strokeWidth={1} opacity={0.75} fill="none">
            {EMPTY_CONTOURS.map((d, index) => (
              <Path key={index} d={d} vectorEffect="non-scaling-stroke" />
            ))}
          </G>
        </Svg>
        <View style={styles.emptyContent}>
          <View style={[styles.emptyRing, { backgroundColor: colors.accentWash }]}>
            <View
              style={[
                styles.emptyMedallion,
                { borderColor: colors.accent, backgroundColor: colors.accentSoft },
              ]}
            >
              <Icon name={icon} size={26} color={colors.accentDeep} />
            </View>
          </View>
          {action}
        </View>
      </View>
      <View style={styles.compass} pointerEvents="none">
        <Icon name="compass" size={26} color={colors.inkSoft} />
      </View>
    </View>
  )
}

export function MapScreen() {
  const document = useAppStore((state) => state.document)
  const navigate = useAppStore((state) => state.navigate)
  const openDay = useAppStore((state) => state.openDay)
  const selectNode = useAppStore((state) => state.selectNode)
  const todayKey = useAppStore((state) => state.todayKey)
  const run = document.run
  const goals = document.goals
  const today = todayKey()

  const choose = (nodeId: string) => {
    selectNode(nodeId)
    const nextRun = useAppStore.getState().document.run
    const nextDay = currentDay(nextRun)
    if (nextDay?.map?.currentNodeId === nodeId) {
      playFeedback('select')
      navigate({ name: 'node', nodeId })
    }
  }

  if (!run) {
    return (
      <Screen>
        <ScreenHead
          kicker="The run"
          title="No run yet."
          subtitle="The map opens when day 1 begins. Start a run from camp first."
          aside={
            <Button small variant="secondary" onPress={() => navigate({ name: 'home' })}>
              Go to camp
            </Button>
          }
        />
      </Screen>
    )
  }

  const {
    day,
    map,
    resolvedCount,
    sealedDay,
    lockedDay,
    hasMap,
    canOpen,
    closedRun,
  } = deriveMapDayState(run, today)

  // One state, one title, one line, one chip.
  let title = 'The path is veiled.'
  let sub = 'Open it once; it will not change.'
  let chipIcon: IconName = 'compass'
  let chipLabel = 'Veiled'

  if (closedRun) {
    title = 'The week is sealed.'
    sub = 'Read the totals.'
    chipIcon = 'crown'
    chipLabel = 'Sealed'
  } else if (sealedDay && day) {
    const missed = day.status === 'missed'
    title = missed ? 'The day was missed.' : 'The day is sealed.'
    sub = missed ? 'No path was kept.' : 'Read what it granted.'
    chipIcon = missed ? 'moon' : 'check'
    chipLabel = missed ? 'Missed' : 'Sealed'
  } else if (lockedDay) {
    title = 'The next day is sealed.'
    sub = 'Only today can be played.'
    chipIcon = 'lock'
    chipLabel = 'Ahead'
  } else if (map && day) {
    const availableCount = availableNodeIds(map, day).length
    title = 'The Ashen Wood'
    sub = map.currentNodeId
      ? 'One step is chosen.'
      : availableCount > 0
        ? `${availableCount} ${availableCount === 1 ? 'path' : 'paths'} ahead.`
        : 'No step is open.'
    chipIcon = 'check'
    chipLabel = `${resolvedCount} of ${map.layers.length + 1} resolved`
  }

  const kicker = run.status === 'closed'
    ? 'The ascent · Week sealed'
    : day
      ? `The ascent · Day ${day.index + 1} of ${RUN_DAYS}`
      : 'The ascent · No day remains'

  let action: ReactNode = null
  if (closedRun) {
    action = (
      <Button variant="primary" onPress={() => navigate({ name: 'run-summary' })}>
        Read the week
      </Button>
    )
  } else if (sealedDay && day) {
    action = (
      <Button
        variant="primary"
        onPress={() => navigate({ name: 'day-summary', dayId: day.id })}
      >
        Read the day
      </Button>
    )
  } else if (lockedDay) {
    action = (
      <Button variant="secondary" onPress={() => navigate({ name: 'home' })}>
        Return to camp
      </Button>
    )
  } else if (canOpen && day) {
    action = (
      <Button variant="primary" onPress={() => openDay(day.id)}>
        Open today’s path
      </Button>
    )
  }

  return (
    <Screen>
      <ScreenHead
        kicker={kicker}
        title={title}
        subtitle={sub}
        aside={
          <Chip variant="quiet" icon={chipIcon}>
            {chipLabel}
          </Chip>
        }
      />

      {hasMap && map && day ? (
        <MapCanvas map={map} day={day} goals={goals} run={run} onSelect={choose} />
      ) : (
        <EmptyMapFrame icon={chipIcon} day={day} action={action} />
      )}

      <MapRail
        run={run}
        day={day}
        map={hasMap ? map : null}
        goals={goals}
        onChoose={choose}
        onGoals={() => navigate({ name: 'goals' })}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  frame: {
    position: 'relative',
    borderWidth: 1,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  frameMeta: {
    position: 'absolute',
    top: 15,
    left: 18,
    right: 18,
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  frameDay: {
    fontFamily: fonts.displayItalic,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  frameInset: {
    position: 'absolute',
    top: 7,
    left: 7,
    right: 7,
    bottom: 7,
    zIndex: 1,
    borderWidth: 1,
    // 12px inner inset keeps pixel parity with the web map frame.
    borderRadius: 12,
    opacity: 0.45,
  },
  emptyBody: {
    minHeight: 460,
    zIndex: 2,
    justifyContent: 'center',
    paddingTop: 48,
    paddingBottom: 20,
  },
  emptyContent: { alignItems: 'center', gap: 18, paddingHorizontal: 16 },
  emptyRing: {
    width: 76,
    height: 76,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMedallion: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compass: { position: 'absolute', right: 18, bottom: 16, zIndex: 3, opacity: 0.5 },
  choices: { gap: space.xs },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    // 10px keeps the web choice-row density; no token covers it.
    padding: 10,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  choiceIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceBody: { flex: 1, gap: 2 },
  // 15/10.5px keep pixel parity with the web choice rows.
  choiceTitle: {
    fontFamily: fonts.display,
    fontSize: 15,
    lineHeight: 18,
  },
  choiceMeta: {
    fontFamily: fonts.uiBold,
    fontSize: 10.5,
    lineHeight: 13,
    letterSpacing: 0.64,
    textTransform: 'uppercase',
  },
  foot: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  footText: { flex: 1 },
  legendToggle: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  legend: { gap: 0, marginTop: space.xs },
  // 2px row padding and 10px legend type keep web parity; no token covers them.
  legendRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs, paddingVertical: 2 },
  legendType: {
    width: 62,
    fontFamily: fonts.uiBold,
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  legendCopy: { flex: 1 },
})
