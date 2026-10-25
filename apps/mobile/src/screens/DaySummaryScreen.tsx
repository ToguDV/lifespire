import { StyleSheet, View } from 'react-native'
import { RUN_DAYS, XP_PER_LEVEL, xpIntoLevel, xpToNextLevel } from '@lifespire/core'
import {
  buildDayPath,
  closingBonusCopy,
  dayPathReward,
} from '@lifespire/app-core/ui/daySummary'
import {
  NODE_TYPE_ICON,
  NODE_TYPE_LABEL,
  formatDayKey,
  goalIconFor,
  romanDay,
} from '@lifespire/app-core/ui/format'
import { useTheme } from '../theme/ThemeProvider'
import { fonts, radius, space } from '../theme/tokens'
import { AimRow } from '../components/AimRow'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { Panel, ScreenHead } from '../components/Panel'
import { Screen } from '../components/Screen'
import {
  ReportEmptyCard,
  ReportLootGrid,
  ReportSeal,
  ReportSection,
  ReportSectionHead,
  ReportTotals,
} from '../components/SummaryReport'
import { Text } from '../components/Text'
import { useAppStore } from '../state/store'

export function DaySummaryScreen({ dayId }: { dayId: string }) {
  const { colors } = useTheme()
  const run = useAppStore((state) => state.document.run)
  const goals = useAppStore((state) => state.document.goals)
  const profile = useAppStore((state) => state.document.profile)
  const navigate = useAppStore((state) => state.navigate)
  const day = run?.days.find((candidate) => candidate.id === dayId) ?? null

  if (!day) {
    return (
      <Screen>
        <ScreenHead kicker="The day" title="Summary" />
        <ReportEmptyCard>
          <EmptyState icon="scroll" title="This day is gone">
            The summary could not be found in the current run.
          </EmptyState>
          <Button variant="secondary" onPress={() => navigate({ name: 'home' })} full>
            Back to camp
          </Button>
        </ReportEmptyCard>
      </Screen>
    )
  }

  if (!day.summary) {
    return (
      <Screen>
        <ScreenHead kicker={formatDayKey(day.date)} title={`Day ${day.index + 1}`} />
        <ReportEmptyCard>
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
        </ReportEmptyCard>
      </Screen>
    )
  }

  const summary = day.summary
  const path = buildDayPath(day)
  const runClosed = run?.status === 'closed'
  const bonusCopy = closingBonusCopy(
    summary.bossCompleted,
    summary.closingBonusXp,
    summary.closingBonusGold,
  )

  return (
    <Screen>
      <Panel pad={false} style={styles.card}>
        <ReportSection>
          <View style={styles.headRow}>
            <View style={styles.headCopy}>
              <Text variant="micro" tone="muted">
                {`DAY ${day.index + 1} OF ${RUN_DAYS} · THE PATH TAKEN`}
              </Text>
              <Text variant="headingLg" accessibilityRole="header">
                {summary.bossCompleted
                  ? 'A quiet climb, kept to the end.'
                  : 'A day left open at the gate.'}
              </Text>
              <Text variant="bodySm" tone="muted">
                {summary.bossCompleted
                  ? 'The gate was kept. Rewards are sealed with the day.'
                  : 'The gate was skipped. The day is sealed without its closing bonus.'}
              </Text>
            </View>
            <ReportSeal
              numeral={romanDay(day.index)}
              label="DAY"
              accessibilityLabel={`Day ${day.index + 1} seal`}
            />
          </View>
        </ReportSection>

        <ReportSection>
          <View style={styles.path} accessible accessibilityLabel="Path taken">
            {path.length === 0 ? (
              <Text variant="bodySm" tone="muted">
                No steps were recorded on this day.
              </Text>
            ) : path.length > 1 ? (
              <View pointerEvents="none" style={[styles.pathLine, { backgroundColor: colors.hairline }]} />
            ) : null}
            {path.map((row) => {
              const done = row.action === 'complete'
              return (
                <View key={row.nodeId} style={styles.pathRow}>
                  <View
                    style={[
                      styles.medallion,
                      done
                        ? { backgroundColor: colors.doneFill, borderColor: colors.doneRim }
                        : {
                            backgroundColor: colors.surfaceSunken,
                            borderColor: colors.hairlineStrong,
                            borderStyle: 'dashed',
                          },
                    ]}
                  >
                    <Icon
                      name={NODE_TYPE_ICON[row.type]}
                      size={16}
                      color={done ? colors.doneInk : colors.inkSoft}
                    />
                  </View>
                  <View style={styles.pathBody}>
                    <Text style={[styles.pathTitle, { color: colors.ink }]} numberOfLines={2}>
                      {row.title}
                    </Text>
                    <Text style={[styles.pathMeta, { color: colors.inkSoft }]} numberOfLines={2}>
                      {NODE_TYPE_LABEL[row.type]}
                      {row.goalTitle ? ` · ${row.goalTitle}` : ''} ·{' '}
                      {done ? 'Completed' : 'Skipped'}
                    </Text>
                  </View>
                  <View style={styles.pathRewards}>
                    <Text
                      style={[
                        styles.pathReward,
                        { color: done ? colors.inkMuted : colors.inkSoft },
                      ]}
                      numberOfLines={2}
                    >
                      {dayPathReward(row)}
                    </Text>
                    {row.duplicateGold > 0 ? (
                      <Text style={[styles.pathDuplicate, { color: colors.inkSoft }]}>
                        {`incl. +${row.duplicateGold} g duplicate`}
                      </Text>
                    ) : null}
                  </View>
                </View>
              )
            })}
          </View>
        </ReportSection>

        <ReportSection>
          <View
            style={[
              styles.bonus,
              {
                borderColor: summary.bossCompleted ? colors.accent : colors.hairline,
                backgroundColor: summary.bossCompleted ? colors.accentWash : colors.surfaceSunken,
                borderStyle: summary.bossCompleted ? 'solid' : 'dashed',
              },
            ]}
            accessibilityLabel="Boss closing bonus"
          >
            <View
              style={[
                styles.bonusIcon,
                {
                  borderColor: summary.bossCompleted ? colors.accent : colors.hairlineStrong,
                  borderStyle: summary.bossCompleted ? 'solid' : 'dashed',
                },
              ]}
            >
              <Icon
                name={summary.bossCompleted ? 'crown' : 'lock'}
                size={16}
                color={summary.bossCompleted ? colors.accentDeep : colors.inkSoft}
              />
            </View>
            <View style={styles.bonusBody}>
              <Text variant="micro" tone="muted">
                BOSS CLOSING BONUS
              </Text>
              <Text style={[styles.bonusStrong, { color: colors.inkStrong }]}>{bonusCopy}</Text>
              <Text variant="bodySm" tone="soft">
                {summary.bossCompleted
                  ? 'Granted once when the boss is completed. It is already included in the boss reward and the day total.'
                  : 'The boss was skipped. Skipping grants no XP, gold, loot or weekly progress.'}
              </Text>
            </View>
          </View>
        </ReportSection>

        <ReportSection>
          <ReportTotals
            xp={summary.xp}
            gold={summary.gold}
            relics={summary.loot.length}
            accessibilityLabel="Rewards earned"
          />
        </ReportSection>

        {summary.objectives.length > 0 ? (
          <ReportSection>
            <View style={styles.sectionLabel}>
              <Text variant="micro" tone="muted">
                WEEKLY TARGETS
              </Text>
            </View>
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
                    progress={objective.after}
                    target={objective.target}
                    icon={goalIconFor(goals, objective.goalId) ?? 'banner'}
                  />
                  <Text style={[styles.aimMeta, { color: colors.inkSoft }]}>
                    {`Before ${objective.before} / ${objective.target} → after ${objective.after} / ${objective.target}`}
                    {objective.after >= objective.target
                      ? ' · target met'
                      : ` · ${objective.target - objective.after} to go`}
                  </Text>
                </View>
              ))}
            </View>
          </ReportSection>
        ) : null}

        <ReportSection>
          <ReportSectionHead
            title="Found today"
            aside={
              <Text variant="caption" tone="soft">
                {summary.loot.length} {summary.loot.length === 1 ? 'relic' : 'relics'}
              </Text>
            }
          />
          <ReportLootGrid
            loot={summary.loot}
            empty={
              <Text variant="bodySm" tone="muted">
                No relics were found. Elite, treasure and boss steps carry a loot roll.
              </Text>
            }
          />
          {summary.duplicateGold > 0 ? (
            <Text variant="bodySm" tone="soft" style={styles.lootNote}>
              {`Duplicates converted into ${summary.duplicateGold} gold. This is already included in the gold total above.`}
            </Text>
          ) : null}
        </ReportSection>

        <ReportSection last>
          {profile ? (
            <View
              style={[
                styles.levelUp,
                { borderColor: colors.accent, backgroundColor: colors.accentWash },
              ]}
            >
              <Icon name="star" size={15} color={colors.accentDeep} />
              <Text style={[styles.levelUpText, { color: colors.accentDeep }]}>
                {`Level ${profile.level} · ${xpIntoLevel(profile.xp)} / ${XP_PER_LEVEL} to the next · ${xpToNextLevel(profile.xp)} to go`}
              </Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Button onPress={() => navigate({ name: 'home' })} full>
              Return to camp
            </Button>
            {runClosed ? (
              <Button
                variant="quiet"
                onPress={() => navigate({ name: 'run-summary' })}
                full
              >
                Read the week
              </Button>
            ) : (
              <Button
                variant="quiet"
                disabled
                accessibilityHint="The next path opens at midnight."
                full
              >
                Wait for tomorrow
              </Button>
            )}
          </View>

          <View style={styles.waitNote}>
            <Icon name={runClosed ? 'crown' : 'moon'} size={15} color={colors.inkSoft} />
            <Text style={[styles.waitNoteText, { color: colors.inkSoft }]}>
              {runClosed
                ? 'Every day in this run is sealed. The weekly totals are ready to read.'
                : 'The next path opens at midnight. Only the current day can be played, so tomorrow waits for the clock.'}
            </Text>
          </View>
        </ReportSection>
      </Panel>
    </Screen>
  )
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  sectionLabel: { marginBottom: space.xs },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  headCopy: { flex: 1, minWidth: 0, gap: space.xxs },
  path: { position: 'relative' },
  pathLine: {
    position: 'absolute',
    top: 18,
    bottom: 18,
    left: 17,
    width: StyleSheet.hairlineWidth,
  },
  pathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    // 6px keeps the web day-path row rhythm; no token covers it.
    paddingVertical: 6,
  },
  medallion: {
    width: 35,
    height: 35,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  pathBody: { flex: 1, minWidth: 0, gap: 2 },
  // 15/9.9/10.2px keep pixel parity with the web day-path rows.
  pathTitle: { fontFamily: fonts.display, fontSize: 15, lineHeight: 19 },
  pathMeta: {
    fontFamily: fonts.uiBold,
    fontSize: 9.9,
    lineHeight: 13,
    letterSpacing: 0.55,
    textTransform: 'uppercase',
  },
  pathRewards: { alignItems: 'flex-end', maxWidth: '38%', gap: 1 },
  pathReward: {
    fontFamily: fonts.uiBold,
    fontSize: 10.2,
    lineHeight: 14,
    letterSpacing: 0.2,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  pathDuplicate: {
    fontFamily: fonts.ui,
    fontSize: 10,
    lineHeight: 13,
    textAlign: 'right',
  },
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
  // 16.3px keeps pixel parity with the web summary bonus line.
  bonusStrong: { fontFamily: fonts.display, fontSize: 16.3, lineHeight: 20 },
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
  lootNote: { marginTop: space.xs },
  levelUp: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.xs,
    paddingVertical: 8,
    paddingHorizontal: space.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.sm,
    marginBottom: space.sm,
  },
  // 11.2px keeps pixel parity with the web level-up strip.
  levelUpText: {
    flex: 1,
    fontFamily: fonts.uiBold,
    fontSize: 11.2,
    lineHeight: 16,
    letterSpacing: 0.4,
  },
  actions: { gap: space.sm },
  waitNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.xs,
    marginTop: space.sm,
  },
  // 13.6px keeps pixel parity with the web italic note.
  waitNoteText: {
    flex: 1,
    fontFamily: fonts.displayItalic,
    fontSize: 13.6,
    lineHeight: 19.5,
  },
})
