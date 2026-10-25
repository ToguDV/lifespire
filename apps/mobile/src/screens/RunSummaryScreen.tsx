import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import {
  OBJECTIVE_BONUS,
  findLootById,
  xpIntoLevel,
  xpToNextLevel,
} from '@lifespire/core'
import type { Goal, LootItem, Run } from '@lifespire/core'
import {
  allAimsBonusCopy,
  duplicateGoldCopy,
  guaranteedRareCopy,
  objectiveAggregate,
  objectiveBonusCopy,
  weeklyBonusTotalCopy,
} from '@lifespire/app-core/ui/runSummary'
import { RARITY_LABEL, goalIconFor, lootIcon, romanDay } from '@lifespire/app-core/ui/format'
import { getNow } from '@lifespire/app-core/state/clock'
import { useTheme } from '../theme/ThemeProvider'
import { fonts, radius, space } from '../theme/tokens'
import { AimRow } from '../components/AimRow'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { Button } from '../components/Button'
import { Dialog } from '../components/Dialog'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'
import { LootCard } from '../components/LootCard'
import { Panel, ScreenHead } from '../components/Panel'
import { Screen } from '../components/Screen'
import { Stat, StatStrip } from '../components/Stat'
import { Text } from '../components/Text'
import { useAppStore } from '../state/store'

function Section({ children, last = false }: { children: ReactNode; last?: boolean }) {
  const { colors } = useTheme()
  return (
    <View
      style={[
        styles.section,
        last
          ? null
          : { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
      ]}
    >
      {children}
    </View>
  )
}

function SectionHead({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <View style={styles.sectionHead}>
      <Text variant="headingSm" accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {aside}
    </View>
  )
}

function Seal({
  numeral,
  label,
  accessibilityLabel,
  icon = 'spire',
}: {
  numeral: string
  label: string
  accessibilityLabel: string
  icon?: IconName
}) {
  const { colors } = useTheme()
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={[styles.seal, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}
    >
      <View style={[styles.sealInner, { borderColor: colors.accent }]}>
        <Icon name={icon} size={15} color={colors.accentDeep} />
        <Text maxFontSizeMultiplier={1.2} style={[styles.sealNumber, { color: colors.accentDeep }]}>
          {numeral}
        </Text>
        <Text maxFontSizeMultiplier={1.2} style={[styles.sealLabel, { color: colors.accentDeep }]}>
          {label}
        </Text>
      </View>
    </View>
  )
}

function Total({ icon, value, label }: { icon: IconName; value: number; label: string }) {
  const { colors } = useTheme()
  return (
    <View style={styles.total}>
      <View style={styles.totalValue}>
        <Icon name={icon} size={15} color={colors.accentDeep} />
        <AnimatedNumber
          value={value}
          prefix="+"
          style={{ ...styles.totalNumber, color: colors.inkStrong }}
        />
      </View>
      <Text variant="micro" tone="soft" style={styles.totalLabel}>
        {label}
      </Text>
    </View>
  )
}

function Totals({ xp, gold, relics }: { xp: number; gold: number; relics: number }) {
  const { colors } = useTheme()
  return (
    <View style={styles.totals} accessibilityLabel="Run totals">
      <Total icon="star" value={xp} label="Experience" />
      <View style={[styles.totalDivider, { borderColor: colors.hairline }]}>
        <View style={styles.totalDividerInner}>
          <Total icon="coin" value={gold} label="Gold" />
        </View>
      </View>
      <View style={[styles.totalDivider, { borderColor: colors.hairline }]}>
        <View style={styles.totalDividerInner}>
          <Total icon="gem" value={relics} label="Relics" />
        </View>
      </View>
    </View>
  )
}

function LootFallback({ item }: { item: LootItem }) {
  const { colors } = useTheme()
  return (
    <View
      style={[
        styles.lootFallback,
        { borderColor: colors.hairline, backgroundColor: colors.surfaceRaised },
      ]}
    >
      <Icon name={lootIcon(item.catalogId)} size={16} color={colors.accent} />
      <View style={styles.lootFallbackBody}>
        <Text variant="bodySm" numberOfLines={2}>
          {item.name}
        </Text>
        <Text variant="caption" tone="muted">
          {RARITY_LABEL[item.rarity]}
        </Text>
      </View>
    </View>
  )
}

function LootGrid({ loot }: { loot: LootItem[] }) {
  const { colors } = useTheme()
  if (loot.length === 0) {
    return (
      <View
        style={[styles.emptyLoot, { borderColor: colors.hairlineStrong }]}
        accessibilityLabel="No new relic this week"
      >
        <Icon name="lock" size={18} color={colors.inkSoft} />
        <Text variant="micro" tone="soft" style={styles.emptyLootLabel}>
          No new relic this week
        </Text>
      </View>
    )
  }
  return (
    <View style={styles.lootGrid}>
      {loot.map((item) => {
        const entry = findLootById(item.catalogId)
        return (
          <View key={item.id} style={styles.lootCell}>
            {entry ? <LootCard entry={entry} owned={item} /> : <LootFallback item={item} />}
          </View>
        )
      })}
    </View>
  )
}

function BonusBlock({
  icon,
  label,
  copy,
  explanation,
  granted,
}: {
  icon: IconName
  label: string
  copy: string
  explanation: string
  granted: boolean
}) {
  const { colors } = useTheme()
  return (
    <View
      style={[
        styles.bonus,
        {
          borderColor: granted ? colors.accent : colors.hairline,
          backgroundColor: granted ? colors.accentWash : colors.surfaceSunken,
          borderStyle: granted ? 'solid' : 'dashed',
        },
      ]}
    >
      <View
        style={[
          styles.bonusIcon,
          {
            borderColor: granted ? colors.accent : colors.hairlineStrong,
            borderStyle: granted ? 'solid' : 'dashed',
          },
        ]}
      >
        <Icon
          name={icon}
          size={16}
          color={granted ? colors.accentDeep : colors.inkSoft}
        />
      </View>
      <View style={styles.bonusBody}>
        <Text variant="micro" tone="muted">
          {label}
        </Text>
        <Text style={[styles.bonusStrong, { color: colors.inkStrong }]}>{copy}</Text>
        <Text variant="bodySm" tone="soft">
          {explanation}
        </Text>
      </View>
    </View>
  )
}

function EmptyCard({ children }: { children: ReactNode }) {
  return (
    <Panel pad={false} style={styles.card}>
      <View style={styles.section}>{children}</View>
    </Panel>
  )
}

export function RunSummaryScreen() {
  const { colors } = useTheme()
  const document = useAppStore((state) => state.document)
  const goals = document.goals
  const navigate = useAppStore((state) => state.navigate)
  const finalizeRun = useAppStore((state) => state.finalizeRun)
  const startNewRun = useAppStore((state) => state.startNewRun)
  const run = document.run
  const profile = document.profile
  const requested = useRef(false)
  const [newRunOpen, setNewRunOpen] = useState(false)
  const [newRunError, setNewRunError] = useState<string | null>(null)
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
        <EmptyCard>
          <EmptyState icon="crown" title="No run yet">
            Begin a run from camp to start the week.
          </EmptyState>
          <Button variant="secondary" onPress={() => navigate({ name: 'home' })} full>
            Back to camp
          </Button>
        </EmptyCard>
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
        <EmptyCard>
          <EmptyState icon="crown" title="The week is closing">
            The weekly bonus is being written. Pull to refresh or return to camp.
          </EmptyState>
        </EmptyCard>
      </Screen>
    )
  }

  const summary = run.summary
  const aggregate = objectiveAggregate(summary.objectives)
  const totals = summary.totals
  const daysRecorded = totals.daysPlayed + totals.daysMissed
  const steps = totals.nodesCompleted + totals.nodesSkipped
  const openNewRun = () => {
    setTargets(
      Object.fromEntries(
        document.goals
          .filter((goal) => goal.active)
          .map((goal) => [goal.id, goal.weeklyObjective]),
      ),
    )
    setNewRunError(null)
    setNewRunOpen(true)
  }
  const closeNewRun = () => {
    setNewRunOpen(false)
    setNewRunError(null)
  }
  const begin = () => {
    const reviewed: Goal[] = document.goals.map((goal) =>
      targets[goal.id] ? { ...goal, weeklyObjective: targets[goal.id]! } : goal,
    )
    if (startNewRun(getNow(), reviewed)) {
      closeNewRun()
      return
    }
    const failure = useAppStore.getState().toast
    setNewRunError(
      failure ?? 'A new run cannot begin yet. Review the weekly targets and try again.',
    )
  }

  return (
    <Screen>
      <Panel pad={false} style={styles.card}>
        <Section>
          <View style={styles.headRow}>
            <View style={styles.headCopy}>
              <Text variant="micro" tone="muted">
                THE WEEK · RUN I · SEALED
              </Text>
              <Text variant="headingLg" accessibilityRole="header">
                {summary.allComplete
                  ? 'Every goal kept. The spire answers.'
                  : 'A week written in small promises.'}
              </Text>
              <Text variant="bodySm" tone="muted">
                {`${profile?.name ?? 'The traveller'}, every page is recorded. The totals below are already part of your profile.`}
              </Text>
            </View>
            <Seal numeral={romanDay(6)} label="WEEK" accessibilityLabel="Week seal" />
          </View>
        </Section>

        <Section>
          <SectionHead
            title="The week recorded"
            aside={
              <Text variant="caption" tone="soft">
                {`${daysRecorded} of 7 days · ${steps} steps`}
              </Text>
            }
          />
          <StatStrip>
            <Stat
              value={totals.daysPlayed}
              label="Days played"
              progress={totals.daysPlayed / 7}
            />
            <Stat
              value={totals.daysMissed}
              label="Days missed"
              progress={totals.daysMissed / 7}
            />
            <Stat
              value={totals.nodesCompleted}
              label="Steps kept"
              progress={totals.nodesCompleted / Math.max(1, steps)}
            />
          </StatStrip>
          <Text variant="bodySm" tone="soft" style={styles.note}>
            {totals.daysMissed > 0
              ? `${totals.daysMissed} ${totals.daysMissed === 1 ? 'day was' : 'days were'} missed. Missed days are recorded without blocking the close and are not recovered.`
              : 'Every day reached a close. No day was missed this week.'}
            {totals.nodesSkipped > 0
              ? ` ${totals.nodesSkipped} ${totals.nodesSkipped === 1 ? 'step was' : 'steps were'} skipped and earned nothing.`
              : ''}
          </Text>
        </Section>

        <Section>
          <Totals xp={totals.xp} gold={totals.gold} relics={totals.lootCount} />
          <Text variant="bodySm" tone="soft" style={styles.note}>
            These totals include every node reward and the weekly bonus. The bonus was granted
            once, when the week closed; reading this page again never adds it a second time.
          </Text>
        </Section>

        <Section>
          <SectionHead
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
              No weekly goals were set for this run. The close is still valid; only the recorded
              node rewards apply.
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
                    icon={goalIconFor(goals, objective.goalId) ?? 'banner'}
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
        </Section>

        <Section>
          <SectionHead
            title="How the weekly bonus was earned"
            aside={
              <Text variant="caption" tone="soft">
                Granted once
              </Text>
            }
          />
          <View style={styles.bonuses}>
            <BonusBlock
              icon={aggregate.met > 0 ? 'check' : 'lock'}
              label="EACH GOAL KEPT"
              copy={`+${aggregate.bonusXp} XP · +${aggregate.bonusGold} gold`}
              explanation={
                aggregate.met > 0
                  ? `${aggregate.met} kept ${aggregate.met === 1 ? 'goal grants' : 'goals grant'} +${OBJECTIVE_BONUS.xp} XP, +${OBJECTIVE_BONUS.gold} gold and one loot roll each.`
                  : 'No weekly goal was kept, so no per-goal bonus was granted.'
              }
              granted={aggregate.met > 0}
            />
            <BonusBlock
              icon={summary.allComplete ? 'crown' : 'lock'}
              label="ALL GOALS KEPT"
              copy={allAimsBonusCopy(summary.allComplete)}
              explanation={
                summary.allComplete
                  ? 'This is the extra bonus for all goals on top of the per-goal bonuses, with one guaranteed rare from the rare pool.'
                  : aggregate.total === 0
                    ? 'No weekly goals were set, so the bonus for all goals was not available this week.'
                    : `${aggregate.total - aggregate.met} of ${aggregate.total} goals still open. Keep every goal in a future run to earn this bonus.`
              }
              granted={summary.allComplete}
            />
          </View>
          {summary.allComplete ? (
            <View style={styles.rareNote}>
              <Icon name="gem" size={15} color={colors.inkSoft} />
              <Text style={[styles.noteText, { color: colors.inkSoft }]}>
                {guaranteedRareCopy(summary.allComplete, summary.guaranteedRare)}
              </Text>
            </View>
          ) : null}
          <View
            style={[
              styles.levelUp,
              { borderColor: colors.accent, backgroundColor: colors.accentWash },
            ]}
          >
            <Icon name="star" size={15} color={colors.accentDeep} />
            <Text style={[styles.levelUpText, { color: colors.accentDeep }]}>
              {`Weekly bonus total · ${weeklyBonusTotalCopy(summary)}. This is the amount already added to your profile.`}
            </Text>
          </View>
        </Section>

        <Section>
          <SectionHead
            title="Relics found at the close"
            aside={
              <Text variant="caption" tone="soft">
                {summary.loot.length} {summary.loot.length === 1 ? 'relic' : 'relics'}
              </Text>
            }
          />
          <LootGrid loot={summary.loot} />
          <Text variant="bodySm" tone="soft" style={styles.note}>
            {duplicateGoldCopy(summary.duplicateGold)}
          </Text>
          {summary.loot.length === 0 ? (
            <Text variant="bodySm" tone="soft" style={styles.note}>
              Weekly loot rolls can still be earned; they are shown here only when they become new
              relics.
            </Text>
          ) : null}
        </Section>

        <Section last>
          <View
            style={[
              styles.levelUp,
              { borderColor: colors.accent, backgroundColor: colors.accentWash },
            ]}
          >
            <Icon name="star" size={15} color={colors.accentDeep} />
            <Text style={[styles.levelUpText, { color: colors.accentDeep }]}>
              {`${profile?.name ?? 'The traveller'} · Level ${profile?.level ?? 1} · ${profile ? xpIntoLevel(profile.xp) : 0} / 100 into this level · ${profile ? xpToNextLevel(profile.xp) : 100} to the next`}
            </Text>
          </View>

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

          <View style={styles.waitNote}>
            <Icon name="lock" size={15} color={colors.inkSoft} />
            <Text style={[styles.waitNoteText, { color: colors.inkSoft }]}>
              A new run retires this week’s record but keeps your profile, level, XP, gold and
              collection. You can review the new weekly goals before it begins.
            </Text>
          </View>
        </Section>
      </Panel>

      <Dialog
        visible={newRunOpen}
        title="Begin a new run"
        onClose={closeNewRun}
        actions={
          <>
            <Button variant="quiet" onPress={closeNewRun}>
              Cancel
            </Button>
            <Button onPress={begin}>Begin the run</Button>
          </>
        }
      >
        <Text variant="bodySm" tone="muted">
          Adjust each weekly target for the new week.
        </Text>
        <View
          style={[
            styles.warning,
            { borderColor: colors.hairlineStrong, backgroundColor: colors.surfaceSunken },
          ]}
        >
          <Icon name="lock" size={15} color={colors.inkSoft} />
          <Text variant="bodySm" tone="muted" style={styles.warningText}>
            This retires the week’s record but keeps your profile, level, XP, gold and
            collection.
          </Text>
        </View>
        <View style={styles.keptRow}>
          <Icon name="check" size={14} color={colors.accent} />
          <Text variant="caption" tone="soft" style={styles.keptText}>
            Kept: profile · gold · XP · relics
          </Text>
        </View>
        {newRunError ? (
          <View
            style={[
              styles.error,
              { borderColor: colors.hairlineStrong, backgroundColor: colors.surfaceSunken },
            ]}
          >
            <Icon name="lock" size={15} color={colors.inkStrong} />
            <Text variant="bodySm" style={[styles.errorText, { color: colors.inkStrong }]}>
              {newRunError}
            </Text>
          </View>
        ) : null}
        <View style={styles.targets}>
          {document.goals
            .filter((goal) => goal.active)
            .map((goal) => (
              <View
                key={goal.id}
                style={[styles.target, { borderColor: colors.hairline }]}
              >
                <View style={styles.targetBody}>
                  <Icon name={goal.icon} size={16} color={colors.accent} />
                  <Text variant="bodySm" numberOfLines={1} style={styles.targetTitle}>
                    {goal.title}
                  </Text>
                </View>
                <View style={styles.stepper}>
                  <Button
                    variant="secondary"
                    small
                    accessibilityLabel={`Decrease target for ${goal.title}`}
                    onPress={() => {
                      setNewRunError(null)
                      setTargets((current) => ({
                        ...current,
                        [goal.id]: Math.max(
                          1,
                          (current[goal.id] ?? goal.weeklyObjective) - 1,
                        ),
                      }))
                    }}
                  >
                    −
                  </Button>
                  <Text variant="headingSm">{targets[goal.id] ?? goal.weeklyObjective}</Text>
                  <Button
                    variant="secondary"
                    small
                    accessibilityLabel={`Increase target for ${goal.title}`}
                    onPress={() => {
                      setNewRunError(null)
                      setTargets((current) => ({
                        ...current,
                        [goal.id]: Math.min(
                          7,
                          (current[goal.id] ?? goal.weeklyObjective) + 1,
                        ),
                      }))
                    }}
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
  const goals = useAppStore((state) => state.document.goals)
  const navigate = useAppStore((state) => state.navigate)
  const kept = run.days.filter((day) => day.status === 'completed').length
  const missed = run.days.filter((day) => day.status === 'missed').length
  const steps = run.totals.nodesCompleted + run.totals.nodesSkipped
  return (
    <Screen>
      <Panel pad={false} style={styles.card}>
        <Section>
          <View style={styles.headRow}>
            <View style={styles.headCopy}>
              <Text variant="micro" tone="muted">
                THE WEEK · RUN I · IN PROGRESS
              </Text>
              <Text variant="headingLg" accessibilityRole="header">
                The week is still unfolding.
              </Text>
              <Text variant="bodySm" tone="muted">
                The weekly bonus is sealed after the seventh day. Nothing is closed or granted
                from this page.
              </Text>
            </View>
            <Seal
              numeral={romanDay(6)}
              label="WEEK"
              icon="compass"
              accessibilityLabel="Week in progress"
            />
          </View>
        </Section>

        <Section>
          <StatStrip>
            <Stat value={kept} label="Days played" progress={kept / 7} />
            <Stat value={missed} label="Days missed" progress={missed / 7} />
            <Stat
              value={run.totals.nodesCompleted}
              label="Steps kept"
              progress={run.totals.nodesCompleted / Math.max(1, steps)}
            />
          </StatStrip>
          <Text variant="bodySm" tone="soft" style={styles.note}>
            {`${7 - kept - missed} ${7 - kept - missed === 1 ? 'day' : 'days'} still ahead. The weekly bonus is granted once, when the run closes.`}
          </Text>
        </Section>

        <Section>
          <Totals
            xp={run.totals.xp}
            gold={run.totals.gold}
            relics={run.totals.lootCount}
          />
          <Text variant="bodySm" tone="soft" style={styles.note}>
            Totals so far. Nothing here is final until the seventh day is sealed.
          </Text>
        </Section>

        <Section>
          <View style={styles.sectionLabel}>
            <Text variant="micro" tone="muted">
              WEEKLY TARGETS
            </Text>
          </View>
          <View style={styles.aims}>
            {run.objectives.map((objective, index) => (
              <View
                key={objective.goalId}
                style={
                  index > 0
                    ? [styles.aimDivider, { borderColor: colors.hairline }]
                    : undefined
                }
              >
                <AimRow
                  title={objective.goalTitle}
                  progress={objective.progress}
                  target={objective.target}
                  icon={goalIconFor(goals, objective.goalId) ?? 'banner'}
                />
              </View>
            ))}
          </View>
        </Section>

        <Section last>
          <View style={styles.waitNote}>
            <Icon name="lock" size={15} color={colors.inkMuted} />
            <Text style={[styles.waitNoteText, { color: colors.inkMuted }]}>
              A run cannot be closed early. Keep the remaining days or let midnight mark them
              missed.
            </Text>
          </View>
          <View style={styles.actions}>
            <Button onPress={() => navigate({ name: 'map' })} full>
              Open the map
            </Button>
            <Button variant="quiet" onPress={() => navigate({ name: 'home' })} full>
              Return to camp
            </Button>
          </View>
        </Section>
      </Panel>
    </Screen>
  )
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  section: { padding: space.xl },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginBottom: space.sm,
  },
  sectionLabel: { marginBottom: space.xs },
  sectionTitle: { flexShrink: 1 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  headCopy: { flex: 1, minWidth: 0, gap: 4 },
  seal: {
    width: 70,
    height: 70,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
  },
  sealInner: {
    width: 60,
    height: 60,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  sealNumber: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 21,
    letterSpacing: 1,
  },
  sealLabel: {
    fontFamily: fonts.uiBold,
    fontSize: 7.4,
    lineHeight: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  note: { marginTop: space.xs },
  totals: { flexDirection: 'row' },
  total: { flex: 1, minWidth: 0, gap: 3 },
  totalValue: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  totalNumber: {
    fontFamily: fonts.display,
    fontSize: 21.6,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
  },
  totalLabel: {
    fontSize: 9.4,
    lineHeight: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  totalDivider: { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth },
  totalDividerInner: { flex: 1, paddingLeft: 10 },
  aims: { gap: 0 },
  aimDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.xxs,
    marginTop: space.xxs,
  },
  aimMeta: {
    paddingLeft: 40,
    paddingBottom: 6,
    fontFamily: fonts.uiBold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  aimLoot: { paddingLeft: 40, paddingBottom: space.xxs },
  bonuses: { gap: space.sm },
  bonus: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    padding: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  bonusIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bonusBody: { flex: 1, minWidth: 0, gap: 3 },
  bonusStrong: { fontFamily: fonts.display, fontSize: 16.3, lineHeight: 20 },
  rareNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    marginTop: space.sm,
  },
  noteText: {
    flex: 1,
    fontFamily: fonts.displayItalic,
    fontSize: 13.6,
    lineHeight: 19.5,
  },
  levelUp: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    marginTop: space.sm,
    paddingVertical: 8,
    paddingHorizontal: space.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.sm,
  },
  levelUpText: {
    flex: 1,
    fontFamily: fonts.uiBold,
    fontSize: 11.2,
    lineHeight: 16,
    letterSpacing: 0.4,
  },
  lootGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  lootCell: { flexBasis: '47%', flexGrow: 1, maxWidth: '48%' },
  lootFallback: {
    minHeight: 90,
    padding: space.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  lootFallbackBody: { flex: 1, minWidth: 0, gap: 2 },
  emptyLoot: {
    minHeight: 104,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    padding: space.sm,
  },
  emptyLootLabel: { textAlign: 'center', textTransform: 'uppercase' },
  actions: { gap: space.sm, marginTop: space.sm },
  waitNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    marginTop: space.sm,
  },
  waitNoteText: {
    flex: 1,
    fontFamily: fonts.displayItalic,
    fontSize: 13.6,
    lineHeight: 19.5,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.xs,
    padding: space.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.md,
  },
  warningText: { flex: 1 },
  keptRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  keptText: { flex: 1 },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.xs,
    padding: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  errorText: { flex: 1 },
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
  targetTitle: { flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
})
