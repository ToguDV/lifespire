import { Pressable, StyleSheet, View } from 'react-native'
import {
  availableNodeIds,
  currentDay,
  nodeProgress,
  resolveNodeById,
} from '@lifespire/core'
import type { Goal, NodeType } from '@lifespire/core'
import {
  EFFORT_LABEL,
  NODE_TYPE_ICON,
  NODE_TYPE_LABEL,
  goalIconFor,
} from '@lifespire/app-core/ui/format'
import { nodeRewardLine, nodeTitle } from '@lifespire/app-core/ui/nodeCopy'
import { useTheme } from '../theme/ThemeProvider'
import { fonts, radius, space } from '../theme/tokens'
import { Button } from '../components/Button'
import { Chip } from '../components/Chip'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'
import { MapCanvas } from '../components/MapCanvas'
import { Panel, PanelHead, ScreenHead } from '../components/Panel'
import { DayPips, Progress } from '../components/Progress'
import { Screen } from '../components/Screen'
import { Text } from '../components/Text'
import { useAppStore } from '../state/store'

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

export function MapScreen() {
  const { colors } = useTheme()
  const document = useAppStore((state) => state.document)
  const navigate = useAppStore((state) => state.navigate)
  const openDay = useAppStore((state) => state.openDay)
  const selectNode = useAppStore((state) => state.selectNode)
  const run = document.run
  const day = currentDay(run)
  const map = day?.map ?? null
  const choices = map && day ? availableNodeIds(map, day) : []

  const choose = (nodeId: string) => {
    selectNode(nodeId)
    navigate({ name: 'node', nodeId })
  }

  if (!run || !day) {
    return (
      <Screen>
        <ScreenHead kicker="The climb" title="Map" />
        <Panel>
          <EmptyState icon="map" title="No map to walk">
            There is no playable day right now. Return to camp to begin a run or read the week.
          </EmptyState>
          <Button variant="secondary" onPress={() => navigate({ name: 'home' })} full>
            Return to camp
          </Button>
        </Panel>
      </Screen>
    )
  }

  return (
    <Screen>
      <ScreenHead
        kicker={`Run I · Day ${day.index + 1} of 7`}
        title="The climb"
        subtitle={
          <Text variant="bodyMd" tone="muted">
            {day.status === 'available'
              ? 'The map is still folded. Open the day to draw it.'
              : day.status === 'in_progress'
                ? 'Choose a connected node. A chosen step stays until you resolve it.'
                : day.status === 'completed'
                  ? 'This day is sealed. Read its summary or wait for midnight.'
                  : 'This day is no longer playable.'}
          </Text>
        }
        aside={<DayPips days={run.days} currentIndex={day.index} />}
      />

      {!map ? (
        <Panel>
          <EmptyState icon="map" title="Today's map is unopened">
            Opening the day draws its layers once and locks them for the rest of the day.
          </EmptyState>
          <Button
            onPress={() => openDay(day.id)}
            disabled={day.status !== 'available'}
            full
          >
            Open today's map
          </Button>
        </Panel>
      ) : (
        <>
          <MapCanvas map={map} day={day} goals={document.goals} onSelect={choose} />

          <Panel>
            <PanelHead
              label="Next step"
              aside={
                <Chip variant="quiet">
                  {choices.length} {choices.length === 1 ? 'choice' : 'choices'}
                </Chip>
              }
            />
            {choices.length === 0 ? (
              <Text variant="bodySm" tone="muted">
                {day.status === 'completed' || day.status === 'missed'
                  ? 'This day is sealed. Read the day summary for its rewards and weekly progress.'
                  : 'No connected node is open. Resolve the current step or read the day summary.'}
              </Text>
            ) : (
              <>
                <Text variant="bodySm" tone="muted" style={styles.lede}>
                  {map?.currentNodeId
                    ? 'This step is chosen. Open it to review the task and its rewards.'
                    : choices.length > 1
                      ? `${choices.length} paths reach the gate; the trade-offs differ.`
                      : 'One path reaches the gate; this layer offers no trade-off.'}
                </Text>
                <View style={styles.choices}>
                  {choices.map((nodeId, index) => (
                    <ChoiceRow
                      key={nodeId}
                      nodeId={nodeId}
                      map={map}
                      run={run}
                      goals={document.goals}
                      open={index === 0}
                      onChoose={choose}
                    />
                  ))}
                </View>
              </>
            )}
            <View style={styles.foot}>
              <Icon
                name={map?.currentNodeId ? 'check' : 'lock'}
                size={13}
                color={colors.inkSoft}
              />
              <Text variant="caption" tone="soft" style={styles.footText}>
                {map?.currentNodeId
                  ? 'The chosen step stays current until the daily loop arrives.'
                  : 'Locked steps open as the path unfolds.'}
              </Text>
            </View>
          </Panel>

          <Panel>
            <PanelHead
              label="Weekly targets"
              aside={
                <Button small variant="ghost" onPress={() => navigate({ name: 'goals' })}>
                  All goals
                </Button>
              }
            />
            <View style={styles.aims}>
              {run.objectives.map((objective) => (
                <View key={objective.goalId} style={styles.aim}>
                  <View style={styles.aimHead}>
                    <Text variant="bodySm" numberOfLines={1} style={styles.aimTitle}>
                      {objective.goalTitle}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {objective.progress}/{objective.target}
                    </Text>
                  </View>
                  <Progress value={objective.progress} max={objective.target} />
                </View>
              ))}
            </View>
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
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
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
  aim: { gap: 4 },
  aimHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  aimTitle: { flex: 1 },
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
