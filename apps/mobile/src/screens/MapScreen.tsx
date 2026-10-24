import { StyleSheet, View } from 'react-native'
import {
  availableNodeIds,
  currentDay,
  nodeProgress,
  resolveNodeById,
} from '@lifespire/core'
import type { Goal, MapNode, NodeType } from '@lifespire/core'
import {
  NODE_TYPE_ICON,
  NODE_TYPE_LABEL,
  goalIconFor,
} from '@lifespire/app-core/ui/format'
import { nodeRewardLine, nodeTitle } from '@lifespire/app-core/ui/nodeCopy'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { Button } from '../components/Button'
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
  { type: 'task', icon: 'banner', copy: 'Goal crest · +1 weekly target · XP and gold by effort' },
  { type: 'elite', icon: 'star', copy: 'Goal crest with a star · doubled reward and a loot roll' },
  { type: 'rest', copy: '+5 XP · no weekly progress' },
  { type: 'treasure', copy: '+15 gold and a loot roll · no progress' },
  { type: 'wheel', icon: 'wheel', copy: 'Mystery · task, gold, XP or rest' },
  { type: 'boss', icon: 'crown', copy: 'Main task · high reward and closing bonus' },
]

function nodeIcon(node: MapNode, goals: Goal[]): IconName {
  if (node.task) return goalIconFor(goals, node.task.goalId) ?? 'banner'
  return NODE_TYPE_ICON[node.type]
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
          <Panel pad={false} style={styles.mapPanel}>
            <MapCanvas map={map} day={day} goals={document.goals} onSelect={choose} />
          </Panel>

          <Panel>
            <PanelHead
              label="Next step"
              aside={
                <Text variant="caption" tone="soft">
                  {choices.length} open
                </Text>
              }
            />
            {choices.length === 0 ? (
              <Text variant="bodySm" tone="muted">
                No connected node is open. Resolve the current step or read the day summary.
              </Text>
            ) : (
              <View style={styles.choices}>
                {choices.map((nodeId) => {
                  const node = resolveNodeById(map, nodeId)
                  if (!node) return null
                  return (
                    <View key={nodeId} style={[styles.choice, { borderColor: colors.hairline }]}>
                      <View style={styles.choiceHead}>
                        <View style={[styles.crest, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
                          <Icon name={nodeIcon(node, document.goals)} size={16} color={colors.accentDeep} />
                        </View>
                        <View style={styles.choiceBody}>
                          <Text variant="headingSm">{nodeTitle(node)}</Text>
                          <Text variant="caption" tone="muted">
                            {NODE_TYPE_LABEL[node.type]} · {nodeRewardLine(node, nodeProgress(run, node))}
                          </Text>
                        </View>
                      </View>
                      <Button small variant="secondary" onPress={() => choose(nodeId)}>
                        {node.type === 'boss' ? 'Face the boss' : 'Choose this step'}
                      </Button>
                    </View>
                  )
                })}
              </View>
            )}
          </Panel>

          <Panel>
            <PanelHead label="Weekly targets" />
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
              {LEGEND.map((item) => (
                <View key={item.type} style={styles.legendRow}>
                  <View style={[styles.legendIcon, { borderColor: colors.hairline, backgroundColor: colors.surface }]}>
                    <Icon name={item.icon ?? NODE_TYPE_ICON[item.type]} size={14} color={colors.inkMuted} />
                  </View>
                  <Text variant="caption" tone="muted" style={styles.legendCopy}>
                    <Text variant="caption" tone="default">
                      {NODE_TYPE_LABEL[item.type]}
                    </Text>
                    {' · '}
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
  mapPanel: { overflow: 'hidden', marginBottom: space.md },
  choices: { gap: space.sm },
  choice: { borderWidth: 1, borderRadius: radius.md, padding: space.sm, gap: space.sm },
  choiceHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  crest: { width: 34, height: 34, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  choiceBody: { flex: 1, gap: 2 },
  aims: { gap: space.sm },
  aim: { gap: 4 },
  aimHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  aimTitle: { flex: 1 },
  legend: { gap: space.sm },
  legendRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  legendIcon: { width: 28, height: 28, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  legendCopy: { flex: 1 },
})
