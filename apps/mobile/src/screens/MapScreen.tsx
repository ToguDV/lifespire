import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Svg, { G, Path } from 'react-native-svg'
import {
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
import { deriveMapDayState, railFoot, railLedeCopy } from '../lib/mapState'
import { playFeedback } from '../state/feedback'
import { useTheme } from '../theme/ThemeProvider'
import { fonts, radius, shadows, space } from '../theme/tokens'
import { AimRow } from '../components/AimRow'
import { Button } from '../components/Button'
import { Chip } from '../components/Chip'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'
import { MapCanvas } from '../components/MapCanvas'
import { Panel, PanelHead, ScreenHead } from '../components/Panel'
import { Screen } from '../components/Screen'
import { Text } from '../components/Text'
import { useAppStore } from '../state/store'

const STATUS_COPY: Record<string, string> = {
  available: 'Day open',
  in_progress: 'In progress',
  completed: 'Sealed',
  missed: 'Missed',
  locked: 'Ahead',
}

const LEGEND: Array<{ type: NodeType; icon?: IconName; copy: string }> = [
  {
    type: 'task',
    icon: 'banner',
    copy: 'Your goal crest · +1 toward weekly target · XP and gold by effort',
  },
  {
    type: 'elite',
    icon: 'star',
    copy: 'Goal crest with a star · doubled reward and a loot roll',
  },
  { type: 'rest', copy: '+5 XP · no weekly progress' },
  { type: 'treasure', copy: '+15 gold and a loot roll · no progress' },
  {
    type: 'wheel',
    icon: 'wheel',
    copy: 'Mystery · task, gold, XP or rest · a task grants weekly progress',
  },
  {
    type: 'boss',
    icon: 'crown',
    copy: 'Your goal crest in the gate · closing bonus when completed',
  },
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
  run: Run | null
  day: Day | null
  map: GameMap | null
  goals: Goal[]
  onChoose: (nodeId: string) => void
  onGoals: () => void
}) {
  const { colors } = useTheme()
  const available = map && day ? availableNodeIds(map, day) : []
  const nodes = map
    ? available
        .map((nodeId) => resolveNodeById(map, nodeId))
        .filter((node): node is MapNode => node !== null)
    : []
  const current = map?.currentNodeId ? resolveNodeById(map, map.currentNodeId) : null
  const lead = railLedeCopy(run, day, map)
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
          <>
            <Text variant="bodySm" tone="muted" style={styles.lede}>
              {current
                ? 'This step is chosen. Open it to review the task and its rewards.'
                : nodes.length > 1
                  ? `${nodes.length} paths reach the gate; the trade-offs differ.`
                  : 'One path reaches the gate; this layer offers no trade-off.'}
            </Text>
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
          </>
        ) : (
          <Text variant="bodySm" tone="muted">
            {lead}
          </Text>
        )}
        <View style={styles.foot}>
          <Icon name={footIcon} size={13} color={colors.inkSoft} />
          <Text variant="caption" tone="soft" style={styles.footText}>
            {railFoot(run, day, current)}
          </Text>
        </View>
      </Panel>

      <Panel>
        <PanelHead
          label="Weekly targets"
          aside={
            <Button small variant="ghost" onPress={onGoals}>
              All goals
            </Button>
          }
        />
        {run && run.objectives.length > 0 ? (
          <View style={styles.aims}>
            {run.objectives.map((objective) => (
              <AimRow
                key={objective.goalId}
                icon={goalIconFor(goals, objective.goalId) ?? 'banner'}
                title={objective.goalTitle}
                progress={objective.progress}
                target={objective.target}
              />
            ))}
          </View>
        ) : (
          <Text variant="bodySm" tone="muted">
            No weekly goals are recorded for this run.
          </Text>
        )}
      </Panel>

      <Panel>
        <PanelHead label="Legend" />
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
              <Text style={[styles.legendType, { color: colors.doneInk }]}>
                {NODE_TYPE_LABEL[item.type]}
              </Text>
              <Text variant="caption" tone="soft" style={styles.legendCopy}>
                {item.copy}
              </Text>
            </View>
          ))}
        </View>
      </Panel>
    </>
  )
}

function EmptyMapFrame({
  icon,
  micro,
  title,
  copy,
  day,
  action,
}: {
  icon: IconName
  micro: string
  title: string
  copy: string
  day: Day | null
  action: ReactNode
}) {
  const { colors } = useTheme()
  return (
    <View
      style={[styles.frame, { backgroundColor: colors.surface, borderColor: colors.hairline, ...shadows.soft }]}
    >
      <View style={styles.frameMeta} pointerEvents="none">
        <Text variant="micro" tone="soft">
          THE ASCENT · BEYOND THE VEIL
        </Text>
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
        <EmptyState icon={icon} kicker={micro} title={title} action={action}>
          {copy}
        </EmptyState>
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
    const goCamp = (
      <Button variant="secondary" full onPress={() => navigate({ name: 'home' })}>
        Go to camp
      </Button>
    )
    return (
      <Screen>
        <ScreenHead
          kicker="The run"
          title="No run yet."
          aside={
            <Chip variant="quiet" icon="moon">
              Unstarted
            </Chip>
          }
        />
        <EmptyMapFrame
          icon="moon"
          micro="No run yet"
          title="Nothing to climb yet."
          copy="The map opens when day 1 begins. Start a run from camp first."
          day={null}
          action={goCamp}
        />
        <MapRail
          run={null}
          day={null}
          map={null}
          goals={goals}
          onChoose={choose}
          onGoals={() => navigate({ name: 'goals' })}
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

  let title = 'The Ashen Wood'
  let chipIcon: IconName = 'lock'
  let chipLabel = STATUS_COPY[day?.status ?? 'locked'] ?? 'Ahead'

  if (closedRun) {
    title = run.status === 'closed' ? 'The week is sealed.' : 'No day remains.'
    chipIcon = 'crown'
    chipLabel = 'Sealed'
  } else if (sealedDay && day) {
    title = day.status === 'missed' ? 'This day was missed.' : 'This day is sealed.'
    chipIcon = day.status === 'missed' ? 'moon' : 'check'
    chipLabel = day.status === 'missed' ? 'Missed' : 'Sealed'
  } else if (lockedDay) {
    title = 'The next day is still sealed.'
    chipIcon = 'lock'
    chipLabel = 'Ahead'
  } else if (!map) {
    title = 'The path is still veiled.'
    chipIcon = 'compass'
    chipLabel = 'Veiled'
  } else if (day) {
    chipIcon = 'check'
    chipLabel = `${resolvedCount} of ${map.layers.length + 1} resolved`
  }

  const kicker = run.status === 'closed'
    ? 'Run I · The week is sealed'
    : day
      ? `Run I · Day ${day.index + 1} of 7`
      : 'Run I · No day remains'

  let action: ReactNode = null
  if (closedRun) {
    action = (
      <Button variant="primary" full onPress={() => navigate({ name: 'run-summary' })}>
        Read the week
      </Button>
    )
  } else if (sealedDay && day) {
    action = (
      <Button
        variant="primary"
        full
        onPress={() => navigate({ name: 'day-summary', dayId: day.id })}
      >
        Read the day summary
      </Button>
    )
  } else if (lockedDay) {
    action = (
      <Button variant="secondary" full onPress={() => navigate({ name: 'home' })}>
        Return to camp
      </Button>
    )
  } else if (canOpen && day) {
    action = (
      <Button variant="primary" full onPress={() => openDay(day.id)}>
        Open today’s path
      </Button>
    )
  }

  const emptyCopy = closedRun
    ? {
        icon: 'crown' as IconName,
        micro: 'The week is sealed',
        title: 'Nothing more to climb.',
        copy: 'The path is complete. Its rewards and totals live in the run summary.',
      }
    : sealedDay && day
      ? day.status === 'missed'
        ? {
            icon: 'moon' as IconName,
            micro: 'The day was missed',
            title: 'No path was kept.',
            copy: 'The day is recorded without rewards. The run continues with the next day.',
          }
        : {
            icon: 'check' as IconName,
            micro: 'The day is sealed',
            title: 'Nothing more to climb.',
            copy: 'The path is complete. Its rewards and weekly progress live in the day summary.',
          }
      : lockedDay
        ? {
            icon: 'lock' as IconName,
            micro: 'The day is ahead',
            title: 'The next day is still sealed.',
            copy: 'A day can be opened only on its own date. Return to camp and wait for the next sunrise.',
          }
        : {
            icon: 'compass' as IconName,
            micro: 'No path drawn yet',
            title: 'The path is still veiled.',
            copy: 'Opening the day draws its layers and a boss. The map is saved at once and will not change.',
          }

  return (
    <Screen>
      <ScreenHead
        kicker={kicker}
        title={title}
        aside={
          <Chip variant="quiet" icon={chipIcon}>
            {chipLabel}
          </Chip>
        }
      />

      {hasMap && map && day ? (
        <MapCanvas map={map} day={day} goals={goals} run={run} onSelect={choose} />
      ) : (
        <EmptyMapFrame
          icon={emptyCopy.icon}
          micro={emptyCopy.micro}
          title={emptyCopy.title}
          copy={emptyCopy.copy}
          day={day}
          action={action}
        />
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
    justifyContent: 'space-between',
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
  compass: { position: 'absolute', right: 18, bottom: 16, zIndex: 3, opacity: 0.5 },
  lede: { marginBottom: space.sm },
  choices: { gap: 9 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
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
  foot: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: space.sm },
  footText: { flex: 1 },
  aims: { gap: space.sm },
  legend: { gap: 0 },
  legendRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 2 },
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
