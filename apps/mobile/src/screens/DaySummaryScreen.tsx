import { StyleSheet, View } from 'react-native'
import {
  buildDayPath,
  closingBonusCopy,
  dayPathReward,
} from '@lifespire/app-core/ui/daySummary'
import { NODE_TYPE_LABEL, RARITY_LABEL, formatDayKey, lootIcon } from '@lifespire/app-core/ui/format'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { Panel, PanelHead, ScreenHead } from '../components/Panel'
import { Progress } from '../components/Progress'
import { Screen } from '../components/Screen'
import { Text } from '../components/Text'
import { useAppStore } from '../state/store'

export function DaySummaryScreen({ dayId }: { dayId: string }) {
  const { colors } = useTheme()
  const run = useAppStore((state) => state.document.run)
  const navigate = useAppStore((state) => state.navigate)
  const day = run?.days.find((candidate) => candidate.id === dayId) ?? null

  if (!day) {
    return (
      <Screen>
        <ScreenHead kicker="The day" title="Summary" />
        <Panel>
          <EmptyState icon="scroll" title="This day is gone">
            The summary could not be found in the current run.
          </EmptyState>
          <Button variant="secondary" onPress={() => navigate({ name: 'home' })} full>
            Back to camp
          </Button>
        </Panel>
      </Screen>
    )
  }

  if (!day.summary) {
    return (
      <Screen>
        <ScreenHead kicker={formatDayKey(day.date)} title={`Day ${day.index + 1}`} />
        <Panel>
          <EmptyState
            icon={day.status === 'missed' ? 'moon' : 'compass'}
            title={day.status === 'missed' ? 'This day was missed' : 'This day is still open'}
            action={
              <Button variant="secondary" onPress={() => navigate({ name: 'map' })}>
                Back to the map
              </Button>
            }
          >
            {day.status === 'missed'
              ? 'The run moved on at midnight. Missed days cannot be recovered in this run.'
              : 'Resolve the boss to seal the day and read its summary.'}
          </EmptyState>
        </Panel>
      </Screen>
    )
  }

  const summary = day.summary
  const path = buildDayPath(day)
  const completed = path.filter((row) => row.action === 'complete').length
  const skipped = path.filter((row) => row.action === 'skip').length

  return (
    <Screen>
      <ScreenHead
        kicker={formatDayKey(day.date)}
        title={`Day ${day.index + 1} sealed`}
        subtitle={
          <Text variant="bodyMd" tone="muted">
            {completed} kept · {skipped} skipped · {summary.xp} XP · {summary.gold} gold
          </Text>
        }
        aside={
          <View style={[styles.seal, { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}>
            <Icon name={summary.bossCompleted ? 'crown' : 'moon'} size={22} color={colors.accentDeep} />
          </View>
        }
      />

      <Panel>
        <PanelHead label="The path" aside={<Text variant="caption" tone="soft">{path.length} steps</Text>} />
        <View style={styles.path}>
          {path.map((row) => (
            <View key={row.nodeId} style={[styles.pathRow, { borderColor: colors.hairline }]}>
              <View
                style={[
                  styles.pathIcon,
                  {
                    backgroundColor: row.action === 'complete' ? colors.ink : colors.surfaceSunken,
                    borderColor: row.action === 'complete' ? colors.ink : colors.hairline,
                  },
                ]}
              >
                <Icon
                  name={row.action === 'complete' ? 'check' : 'arrow-left'}
                  size={13}
                  color={row.action === 'complete' ? colors.onAccent : colors.inkSoft}
                />
              </View>
              <View style={styles.pathBody}>
                <Text variant="bodySm" numberOfLines={2}>
                  {row.title}
                </Text>
                <Text variant="caption" tone="muted">
                  {NODE_TYPE_LABEL[row.type]}
                  {row.goalTitle ? ` · ${row.goalTitle}` : ''} ·{' '}
                  {row.action === 'complete' ? 'Completed' : 'Skipped'}
                </Text>
              </View>
              <Text variant="caption" tone={row.action === 'complete' ? 'muted' : 'soft'}>
                {dayPathReward(row)}
              </Text>
            </View>
          ))}
        </View>
      </Panel>

      <Panel>
        <PanelHead label="The day's take" />
        <View style={styles.totals}>
          <Text variant="displayMd" tone="xp">{`+${summary.xp}`}</Text>
          <Text variant="caption" tone="muted">XP</Text>
          <Text variant="displayMd" tone="gold">{`+${summary.gold}`}</Text>
          <Text variant="caption" tone="muted">gold</Text>
        </View>
        <View style={styles.bonusRow}>
          <Text variant="bodySm">Boss closing bonus</Text>
          <Text variant="bodySm" tone={summary.bossCompleted ? 'accent' : 'soft'}>
            {closingBonusCopy(summary.bossCompleted, summary.closingBonusXp, summary.closingBonusGold)}
          </Text>
        </View>
        {summary.duplicateGold > 0 ? (
          <Text variant="caption" tone="gold">
            Includes {summary.duplicateGold} gold from duplicate relics.
          </Text>
        ) : null}
      </Panel>

      {summary.objectives.length > 0 ? (
        <Panel>
          <PanelHead label="Weekly targets" />
          <View style={styles.aims}>
            {summary.objectives.map((objective) => (
              <View key={objective.goalId} style={styles.aim}>
                <View style={styles.aimHead}>
                  <Text variant="bodySm" numberOfLines={1} style={styles.aimTitle}>
                    {objective.title}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {objective.before} → {objective.after} / {objective.target}
                  </Text>
                </View>
                <Progress value={objective.after} max={objective.target} />
              </View>
            ))}
          </View>
        </Panel>
      ) : null}

      {summary.loot.length > 0 ? (
        <Panel>
          <PanelHead label="Relics found" />
          <View style={styles.loot}>
            {summary.loot.map((item) => (
              <View key={item.id} style={styles.lootRow}>
                <Icon name={lootIcon(item.catalogId)} size={16} color={colors.accent} />
                <Text variant="bodySm" style={styles.lootName}>
                  {item.name}
                </Text>
                <Text variant="caption" tone="muted">
                  {RARITY_LABEL[item.rarity]}
                </Text>
              </View>
            ))}
          </View>
        </Panel>
      ) : null}

      <View style={styles.actions}>
        <Button onPress={() => navigate({ name: 'home' })} full>
          Back to camp
        </Button>
        <Button variant="secondary" icon="map" onPress={() => navigate({ name: 'map' })} full>
          Back to the map
        </Button>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  seal: { width: 52, height: 52, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  path: { gap: space.sm },
  pathRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: space.sm },
  pathIcon: { width: 28, height: 28, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pathBody: { flex: 1, gap: 2 },
  totals: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs, flexWrap: 'wrap' },
  bonusRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm, marginTop: space.sm },
  aims: { gap: space.sm },
  aim: { gap: 4 },
  aimHead: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  aimTitle: { flex: 1 },
  loot: { gap: space.sm },
  lootRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  lootName: { flex: 1 },
  actions: { gap: space.sm, marginTop: space.sm },
})
