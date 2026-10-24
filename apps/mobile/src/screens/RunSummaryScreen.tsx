import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { Goal, Run } from '@lifespire/core'
import {
  allAimsBonusCopy,
  duplicateGoldCopy,
  guaranteedRareCopy,
  objectiveAggregate,
  objectiveBonusCopy,
  weeklyBonusTotalCopy,
} from '@lifespire/app-core/ui/runSummary'
import { RARITY_LABEL, lootIcon } from '@lifespire/app-core/ui/format'
import { getNow } from '@lifespire/app-core/state/clock'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { Button } from '../components/Button'
import { Dialog } from '../components/Dialog'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { Panel, PanelHead, ScreenHead } from '../components/Panel'
import { DayPips, Progress } from '../components/Progress'
import { Screen } from '../components/Screen'
import { Text } from '../components/Text'
import { useAppStore } from '../state/store'

export function RunSummaryScreen() {
  const { colors } = useTheme()
  const document = useAppStore((state) => state.document)
  const navigate = useAppStore((state) => state.navigate)
  const finalizeRun = useAppStore((state) => state.finalizeRun)
  const startNewRun = useAppStore((state) => state.startNewRun)
  const run = document.run
  const profile = document.profile
  const requested = useRef(false)
  const [newRunOpen, setNewRunOpen] = useState(false)
  const [targets, setTargets] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!run || run.status !== 'closed' || run.summary || requested.current) return
    requested.current = true
    finalizeRun()
  }, [run, finalizeRun])

  if (!run) {
    return (
      <Screen>
        <ScreenHead kicker="The week" title="Run summary" />
        <Panel>
          <EmptyState icon="crown" title="No run yet">
            Begin a run from camp to start the week.
          </EmptyState>
          <Button variant="secondary" onPress={() => navigate({ name: 'home' })} full>
            Back to camp
          </Button>
        </Panel>
      </Screen>
    )
  }

  if (run.status === 'active') {
    return <ActiveRun run={run} />
  }

  if (!run.summary) {
    return (
      <Screen>
        <ScreenHead kicker="The week" title="Sealing the week" />
        <Panel>
          <EmptyState icon="crown" title="The week is closing">
            The weekly bonus is being written. Pull to refresh or return to camp.
          </EmptyState>
        </Panel>
      </Screen>
    )
  }

  const summary = run.summary
  const aggregate = objectiveAggregate(summary.objectives)
  const openNewRun = () => {
    setTargets(Object.fromEntries(document.goals.filter((goal) => goal.active).map((goal) => [goal.id, goal.weeklyObjective])))
    setNewRunOpen(true)
  }
  const begin = () => {
    const goals: Goal[] = document.goals.map((goal) =>
      targets[goal.id] ? { ...goal, weeklyObjective: targets[goal.id]! } : goal,
    )
    if (startNewRun(getNow(), goals)) setNewRunOpen(false)
  }

  return (
    <Screen>
      <ScreenHead
        kicker="The week is sealed"
        title="The week is sealed"
        subtitle={
          <Text variant="bodyMd" tone="muted">
            {summary.totals.daysPlayed} days played · {summary.totals.daysMissed} missed ·{' '}
            {summary.totals.nodesCompleted} steps kept
          </Text>
        }
        aside={
          <View style={[styles.seal, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
            <Icon name="crown" size={24} color={colors.accentDeep} />
          </View>
        }
      />

      <Panel>
        <PanelHead label="The week" aside={<DayPips days={run.days} />} />
        <View style={styles.bonusRow}>
          <Text variant="bodySm">All weekly targets</Text>
          <Text variant="bodySm" tone={summary.allComplete ? 'accent' : 'muted'}>
            {aggregate.met}/{aggregate.total}
          </Text>
        </View>
        <Progress value={aggregate.progress} max={aggregate.target} />
        <Text variant="caption" tone="muted" style={styles.copy}>
          {allAimsBonusCopy(summary.allComplete)}
        </Text>
        <Text variant="bodySm" tone="accent">
          {weeklyBonusTotalCopy(summary)}
        </Text>
        <Text variant="caption" tone="soft">
          {guaranteedRareCopy(summary.allComplete, summary.guaranteedRare)}
        </Text>
      </Panel>

      <Panel>
        <PanelHead label="Weekly targets" />
        <View style={styles.aims}>
          {summary.objectives.map((objective) => (
            <View key={objective.goalId} style={styles.aim}>
              <View style={styles.aimHead}>
                <Text variant="bodySm" numberOfLines={1} style={styles.aimTitle}>
                  {objective.title}
                </Text>
                <Text variant="caption" tone={objective.met ? 'accent' : 'muted'}>
                  {objective.progress}/{objective.target}
                </Text>
              </View>
              <Progress value={objective.progress} max={objective.target} />
              <Text variant="caption" tone={objective.met ? 'accent' : 'soft'}>
                {objectiveBonusCopy(objective)}
              </Text>
            </View>
          ))}
        </View>
      </Panel>

      <Panel>
        <PanelHead label="Relics and totals" />
        <View style={styles.totals}>
          <Text variant="displayMd" tone="xp">{`+${summary.totals.xp}`}</Text>
          <Text variant="caption" tone="muted">XP</Text>
          <Text variant="displayMd" tone="gold">{`+${summary.totals.gold}`}</Text>
          <Text variant="caption" tone="muted">gold</Text>
        </View>
        {summary.loot.length > 0 ? (
          <View style={styles.loot}>
            {summary.loot.map((item) => (
              <View key={item.id} style={styles.lootRow}>
                <Icon name={lootIcon(item.catalogId)} size={16} color={colors.accent} />
                <Text variant="bodySm" style={styles.lootName}>{item.name}</Text>
                <Text variant="caption" tone="muted">{RARITY_LABEL[item.rarity]}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text variant="bodySm" tone="muted">No relics were added this week.</Text>
        )}
        <Text variant="caption" tone="soft" style={styles.copy}>
          {duplicateGoldCopy(summary.duplicateGold)}
        </Text>
      </Panel>

      {profile ? (
        <Panel>
          <PanelHead label="The traveller" />
          <Text variant="bodySm" tone="muted">
            {profile.name} · Level {profile.level} · {profile.xp} XP · {profile.gold} gold ·{' '}
            {profile.loot.length} relics
          </Text>
        </Panel>
      ) : null}

      <View style={styles.actions}>
        <Button onPress={openNewRun} full>
          Begin a new run
        </Button>
        <Button variant="secondary" onPress={() => navigate({ name: 'home' })} full>
          Back to camp
        </Button>
      </View>

      <Dialog
        visible={newRunOpen}
        title="Begin a new run"
        onClose={() => setNewRunOpen(false)}
        actions={
          <>
            <Button variant="quiet" onPress={() => setNewRunOpen(false)}>Cancel</Button>
            <Button onPress={begin}>Begin the run</Button>
          </>
        }
      >
        <Text variant="bodySm" tone="muted">
          Adjust each weekly target for the new week. Your profile, gold, XP and relics are kept.
        </Text>
        <View style={styles.targets}>
          {document.goals.filter((goal) => goal.active).map((goal) => (
            <View key={goal.id} style={[styles.target, { borderColor: colors.hairline }]}>
              <View style={styles.targetBody}>
                <Icon name={goal.icon} size={16} color={colors.accent} />
                <Text variant="bodySm" numberOfLines={1} style={styles.targetTitle}>{goal.title}</Text>
              </View>
              <View style={styles.stepper}>
                <Button
                  variant="secondary"
                  small
                  accessibilityLabel={`Decrease target for ${goal.title}`}
                  onPress={() => setTargets((current) => ({ ...current, [goal.id]: Math.max(1, (current[goal.id] ?? goal.weeklyObjective) - 1) }))}
                >
                  −
                </Button>
                <Text variant="headingSm">{targets[goal.id] ?? goal.weeklyObjective}</Text>
                <Button
                  variant="secondary"
                  small
                  accessibilityLabel={`Increase target for ${goal.title}`}
                  onPress={() => setTargets((current) => ({ ...current, [goal.id]: Math.min(7, (current[goal.id] ?? goal.weeklyObjective) + 1) }))}
                >
                  +
                </Button>
              </View>
            </View>
          ))}
        </View>
      </Dialog>
    </Screen>
  )
}

function ActiveRun({ run }: { run: Run }) {
  const { colors } = useTheme()
  const navigate = useAppStore((state) => state.navigate)
  const kept = run.days.filter((day) => day.status === 'completed').length
  const missed = run.days.filter((day) => day.status === 'missed').length
  return (
    <Screen>
      <ScreenHead
        kicker="The week is still unfolding"
        title="Run summary"
        subtitle={
          <Text variant="bodyMd" tone="muted">
            {kept} kept · {missed} missed · {7 - kept - missed} still ahead
          </Text>
        }
        aside={<DayPips days={run.days} />}
      />
      <Panel>
        <PanelHead label="Weekly targets" />
        <View style={styles.aims}>
          {run.objectives.map((objective) => (
            <View key={objective.goalId} style={styles.aim}>
              <View style={styles.aimHead}>
                <Text variant="bodySm" numberOfLines={1} style={styles.aimTitle}>{objective.goalTitle}</Text>
                <Text variant="caption" tone="muted">{objective.progress}/{objective.target}</Text>
              </View>
              <Progress value={objective.progress} max={objective.target} />
            </View>
          ))}
        </View>
      </Panel>
      <Panel>
        <PanelHead label="Totals so far" />
        <View style={styles.totals}>
          <Text variant="displayMd" tone="xp">{`+${run.totals.xp}`}</Text>
          <Text variant="caption" tone="muted">XP</Text>
          <Text variant="displayMd" tone="gold">{`+${run.totals.gold}`}</Text>
          <Text variant="caption" tone="muted">gold</Text>
        </View>
        <Text variant="caption" tone="soft">
          The weekly bonus is granted once, when the run closes.
        </Text>
      </Panel>
      <Button onPress={() => navigate({ name: 'home' })} full>Back to camp</Button>
      <View style={[styles.note, { borderColor: colors.hairline }]}>
        <Icon name="lock" size={15} color={colors.inkMuted} />
        <Text variant="caption" tone="muted" style={styles.noteText}>
          A run cannot be closed early. Keep the remaining days or let midnight mark them missed.
        </Text>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  seal: { width: 52, height: 52, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bonusRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  copy: { marginTop: space.xs, marginBottom: space.xs },
  aims: { gap: space.sm },
  aim: { gap: 4 },
  aimHead: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  aimTitle: { flex: 1 },
  totals: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs, flexWrap: 'wrap' },
  loot: { gap: space.sm, marginTop: space.sm },
  lootRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  lootName: { flex: 1 },
  actions: { gap: space.sm, marginTop: space.sm },
  targets: { gap: space.sm, marginTop: space.md },
  target: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: radius.md, padding: space.sm },
  targetBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.xs },
  targetTitle: { flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs, borderWidth: 1, borderRadius: radius.md, padding: space.sm, marginTop: space.sm },
  noteText: { flex: 1 },
})
