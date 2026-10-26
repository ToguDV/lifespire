import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import {
  MAX_WEEKLY_OBJECTIVE,
  MIN_WEEKLY_OBJECTIVE,
  RUN_DAYS,
  currentDay,
} from '@lifespire/core'
import type { Goal, Run } from '@lifespire/core'
import {
  initialWeeklyTargets,
  validateNewRunSetup,
} from '@lifespire/app-core/ui/newRun'
import type { WeeklyTargets } from '@lifespire/app-core/ui/newRun'
import {
  objectiveAggregate,
  objectiveBonusCopy,
} from '@lifespire/app-core/ui/runSummary'
import { goalIconFor, romanDay } from '@lifespire/app-core/ui/format'
import { useTheme } from '../theme/ThemeProvider'
import { fonts, radius, space } from '../theme/tokens'
import { AimRow } from '../components/AimRow'
import { Button } from '../components/Button'
import { Dialog } from '../components/Dialog'
import { Icon } from '../components/Icon'
import { Panel, ScreenHead } from '../components/Panel'
import { DayPips } from '../components/Progress'
import { Screen } from '../components/Screen'
import { Stat, StatStrip } from '../components/Stat'
import {
  ReportLootGrid,
  ReportSeal,
  ReportSection,
  ReportSectionHead,
  ReportTotals,
} from '../components/SummaryReport'
import { Text } from '../components/Text'
import { useAppStore } from '../state/store'

function EmptyWeekState({
  kicker,
  title,
  body,
  onCamp,
}: {
  kicker: string
  title: string
  body: string
  onCamp: () => void
}) {
  return (
    <Screen>
      <ScreenHead
        kicker={kicker}
        title={title}
        subtitle={body}
        aside={
          <Button small variant="secondary" onPress={onCamp}>
            Go to camp
          </Button>
        }
      />
    </Screen>
  )
}

export function RunSummaryScreen() {
  const { colors } = useTheme()
  const document = useAppStore((state) => state.document)
  const navigate = useAppStore((state) => state.navigate)
  const finalizeRun = useAppStore((state) => state.finalizeRun)
  const startNewRun = useAppStore((state) => state.startNewRun)
  const run = document.run
  const requested = useRef(false)
  const [newRunOpen, setNewRunOpen] = useState(false)
  const [newRunError, setNewRunError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [targets, setTargets] = useState<WeeklyTargets>({})

  useEffect(() => {
    if (!run || run.status !== 'closed' || run.summary || requested.current) return
    requested.current = true
    finalizeRun()
  }, [run, finalizeRun])

  if (!run) {
    return (
      <EmptyWeekState
        kicker="The week"
        title="Returning to camp."
        body="A run summary appears after a seven-day run has been recorded."
        onCamp={() => navigate({ name: 'home' })}
      />
    )
  }

  if (run.status === 'active') {
    return <ActiveRun run={run} />
  }

  if (!run.summary) {
    return (
      <EmptyWeekState
        kicker="The week"
        title="Sealing the week."
        body="The weekly bonus is being calculated."
        onCamp={() => navigate({ name: 'home' })}
      />
    )
  }

  const summary = run.summary
  const aggregate = objectiveAggregate(summary.objectives)
  const totals = summary.totals
  const steps = totals.nodesCompleted + totals.nodesSkipped
  const validation = validateNewRunSetup(document.goals, document.tasks, targets)
  const activeGoalIds = new Set(validation.activeGoals.map((goal) => goal.id))
  const activeTasks = document.tasks.filter(
    (task) => task.active && activeGoalIds.has(task.goalId),
  )
  const fieldMessages = new Set(Object.values(validation.fieldErrors))
  const stepErrors = validation.errors.filter((message) => !fieldMessages.has(message))
  const errors = [
    ...(showErrors ? stepErrors : []),
    ...(newRunError ? [newRunError] : []),
  ]

  const openNewRun = () => {
    setTargets(initialWeeklyTargets(document.goals))
    setShowErrors(false)
    setNewRunError(null)
    setNewRunOpen(true)
  }

  const closeNewRun = () => {
    setNewRunOpen(false)
    setShowErrors(false)
    setNewRunError(null)
  }

  const updateTarget = (goalId: string, value: string) => {
    setTargets((current) => ({ ...current, [goalId]: value }))
    setNewRunError(null)
  }

  const stepTarget = (goal: Goal, delta: number) => {
    const current = Number(targets[goal.id] ?? goal.weeklyObjective)
    const next = Math.min(
      MAX_WEEKLY_OBJECTIVE,
      Math.max(MIN_WEEKLY_OBJECTIVE, (Number.isFinite(current) ? current : goal.weeklyObjective) + delta),
    )
    updateTarget(goal.id, String(next))
  }

  const begin = () => {
    setShowErrors(true)
    setNewRunError(null)
    if (!validation.ok) return
    if (startNewRun(undefined, validation.goals)) {
      closeNewRun()
      return
    }
    setNewRunError(useAppStore.getState().toast ?? 'A new run cannot begin yet.')
  }

  return (
    <Screen>
      <Panel pad={false} style={styles.card}>
        <ReportSection>
          <View style={styles.headRow}>
            <View style={styles.headCopy}>
              <Text variant="micro" tone="muted">
                The week · Sealed
              </Text>
              <Text variant="headingLg" accessibilityRole="header">
                The week is sealed.
              </Text>
            </View>
            <ReportSeal numeral={romanDay(6)} label="WEEK" accessibilityLabel="Week seal" />
          </View>
        </ReportSection>

        <ReportSection>
          <ReportSectionHead
            title="The week recorded"
            aside={
              <Text variant="caption" tone="soft">
                {`${totals.daysPlayed + totals.daysMissed} of ${RUN_DAYS} days · ${steps} steps`}
              </Text>
            }
          />
          <StatStrip>
            <Stat
              value={totals.daysPlayed}
              label="Days played"
              progress={totals.daysPlayed / RUN_DAYS}
            />
            <Stat
              value={totals.daysMissed}
              label="Days missed"
              progress={totals.daysMissed / RUN_DAYS}
            />
            <Stat
              value={totals.nodesCompleted}
              label="Steps kept"
              progress={totals.nodesCompleted / Math.max(1, steps)}
            />
          </StatStrip>
        </ReportSection>

        <ReportSection>
          <ReportTotals xp={totals.xp} gold={totals.gold} relics={totals.lootCount} accessibilityLabel="Run totals" />
          <Text variant="bodySm" tone="soft" style={styles.note}>
            {`Weekly bonus included: +${summary.bonusXp} XP · +${summary.bonusGold} gold.`}
          </Text>
        </ReportSection>

        <ReportSection>
          <ReportSectionHead
            title="Weekly goals"
            aside={
              <Text variant="caption" tone="soft">
                {`${aggregate.met} of ${aggregate.total} kept`}
                {aggregate.total > 0
                  ? ` · ${aggregate.progress} / ${aggregate.target}`
                  : ''}
              </Text>
            }
          />
          {aggregate.total === 0 ? (
            <Text variant="bodySm" tone="muted">
              No weekly goals were set for this run.
            </Text>
          ) : (
            <View style={styles.aims}>
              {summary.objectives.map((objective, index) => (
                <View
                  key={objective.goalId}
                  style={
                    index > 0
                      ? [styles.aimDivider, { borderColor: colors.hairline }]
                      : undefined
                  }
                >
                  <AimRow
                    title={objective.title}
                    progress={objective.progress}
                    target={objective.target}
                    icon={goalIconFor(document.goals, objective.goalId) ?? 'banner'}
                  />
                  <Text style={[styles.aimMeta, { color: colors.inkSoft }]}>
                    {objectiveBonusCopy(objective)}
                  </Text>
                  {objective.met && objective.loot.length > 0 ? (
                    <Text variant="caption" tone="muted" style={styles.aimLoot}>
                      {`Found: ${objective.loot.map((item) => item.name).join(', ')}`}
                    </Text>
                  ) : objective.met ? (
                    <Text variant="caption" tone="muted" style={styles.aimLoot}>
                      The loot roll became gold; the relic was already owned.
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </ReportSection>

        <ReportSection>
          <ReportSectionHead
            title="Relics found at the close"
            aside={
              summary.loot.length > 0 ? (
                <Text variant="caption" tone="soft">
                  {summary.loot.length} {summary.loot.length === 1 ? 'relic' : 'relics'}
                </Text>
              ) : undefined
            }
          />
          <ReportLootGrid loot={summary.loot} />
          {summary.duplicateGold > 0 ? (
            <Text variant="bodySm" tone="soft" style={styles.note}>
              {`Duplicates converted into ${summary.duplicateGold} gold.`}
            </Text>
          ) : null}
        </ReportSection>

        <ReportSection last>
          <View style={styles.actions}>
            <Button onPress={openNewRun} full>
              Begin a new run
            </Button>
            <Button
              variant="quiet"
              icon="gem"
              onPress={() => navigate({ name: 'profile' })}
              full
            >
              View the Reliquary
            </Button>
            <Button variant="quiet" onPress={() => navigate({ name: 'home' })} full>
              Return to camp
            </Button>
          </View>
        </ReportSection>
      </Panel>

      <Dialog
        visible={newRunOpen}
        title="Begin a new run?"
        eyebrow="The next run"
        description="The previous week is retired. Your profile, level, XP, gold and relics stay."
        onClose={closeNewRun}
        actions={
          <>
            <Button variant="quiet" onPress={closeNewRun}>
              Cancel
            </Button>
            <Button onPress={begin}>Begin a new run</Button>
          </>
        }
      >
        {errors.length > 0 ? (
          <View
            accessibilityRole="alert"
            style={[
              styles.error,
              { borderColor: colors.hairlineStrong, backgroundColor: colors.surfaceSunken },
            ]}
          >
            <Text variant="caption" style={{ color: colors.inkStrong }}>
              This run cannot begin yet
            </Text>
            {errors.map((message) => (
              <Text key={message} variant="bodySm" style={{ color: colors.inkStrong }}>
                {message}
              </Text>
            ))}
          </View>
        ) : null}

        <Text variant="bodySm" tone="muted">
          {`Targets run from ${MIN_WEEKLY_OBJECTIVE} to ${MAX_WEEKLY_OBJECTIVE}.`}
        </Text>

        {validation.activeGoals.length === 0 ? (
          <Text variant="bodySm" tone="muted">
            There are no active goals. Restore one from Goals before beginning.
          </Text>
        ) : (
          <View style={styles.targets}>
            {validation.activeGoals.map((goal) => {
              const error = showErrors ? validation.fieldErrors[goal.id] : undefined
              const routines = activeTasks.filter((task) => task.goalId === goal.id).length
              return (
                <View key={goal.id} style={[styles.target, { borderColor: colors.hairline }]}>
                  <View style={styles.targetBody}>
                    <Icon name={goal.icon} size={16} color={colors.accent} />
                    <View style={styles.targetCopy}>
                      <Text variant="bodySm" numberOfLines={1}>
                        {goal.title}
                      </Text>
                      <Text variant="caption" tone="muted">
                        {`${routines} active ${routines === 1 ? 'routine' : 'routines'}`}
                      </Text>
                      {error ? (
                        <Text variant="caption" tone="default">
                          {error}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.stepper}>
                    <Button
                      variant="secondary"
                      small
                      accessibilityLabel={`Decrease target for ${goal.title}`}
                      onPress={() => stepTarget(goal, -1)}
                    >
                      −
                    </Button>
                    <Text variant="headingSm">{targets[goal.id] ?? goal.weeklyObjective}</Text>
                    <Button
                      variant="secondary"
                      small
                      accessibilityLabel={`Increase target for ${goal.title}`}
                      onPress={() => stepTarget(goal, 1)}
                    >
                      +
                    </Button>
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {validation.activeRoutines < 4 ? (
          <Text variant="bodySm" tone="default">
            {`A run needs at least four active routines. This setup has ${validation.activeRoutines}.`}
          </Text>
        ) : null}
      </Dialog>
    </Screen>
  )
}

function ActiveRun({ run }: { run: Run }) {
  const goals = useAppStore((state) => state.document.goals)
  const navigate = useAppStore((state) => state.navigate)
  const current = currentDay(run)
  const met = run.objectives.filter(
    (objective) => objective.progress >= objective.target,
  ).length
  const total = run.objectives.length

  return (
    <Screen>
      <ScreenHead
        kicker="The week · In progress"
        title="The week is still open."
        subtitle="Final totals seal after the seventh day."
      />
      <Panel pad={false} style={styles.card}>
        <ReportSection>
          <DayPips days={run.days} currentIndex={current?.index} />
        </ReportSection>

        <ReportSection>
          <ReportSectionHead
            title="Weekly goals"
            aside={
              <Text variant="caption" tone="soft">
                {`${met} of ${total} kept`}
              </Text>
            }
          />
          {total === 0 ? (
            <Text variant="bodySm" tone="muted">
              No weekly goals were set for this run.
            </Text>
          ) : (
            <View style={styles.aims}>
              {run.objectives.map((objective) => (
                <AimRow
                  key={objective.goalId}
                  title={objective.goalTitle}
                  progress={objective.progress}
                  target={objective.target}
                  icon={goalIconFor(goals, objective.goalId) ?? 'banner'}
                />
              ))}
            </View>
          )}
        </ReportSection>

        <ReportSection last>
          <View style={styles.actions}>
            <Button onPress={() => navigate({ name: 'home' })} full>
              Return to camp
            </Button>
          </View>
        </ReportSection>
      </Panel>
    </Screen>
  )
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  headCopy: { flex: 1, minWidth: 0, gap: space.xxs },
  note: { marginTop: space.xs },
  aims: { gap: 0 },
  aimDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.xxs,
    marginTop: space.xxs,
  },
  aimMeta: {
    paddingLeft: space.xxxl,
    // 6px keeps the web aim-meta rhythm; no token covers it.
    paddingBottom: 6,
    fontFamily: fonts.uiBold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  aimLoot: { paddingLeft: space.xxxl, paddingBottom: space.xxs },
  actions: { gap: space.sm },
  error: {
    flexDirection: 'column',
    gap: space.xxs,
    padding: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  targets: { gap: space.sm },
  target: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm,
  },
  targetBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.xs },
  targetCopy: { flex: 1, minWidth: 0, gap: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
})
