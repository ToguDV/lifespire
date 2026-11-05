import { StyleSheet, View } from 'react-native'
import { RUN_DAYS, levelForXp } from '@lifespire/core'
import { buildDayPath, dayPathReward } from '@lifespire/app-core/ui/daySummary'
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
import { Chip } from '../components/Chip'
import { Icon } from '../components/Icon'
import { Panel, ScreenHead } from '../components/Panel'
import { Screen } from '../components/Screen'
import {
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
        <ScreenHead
          kicker="Day summary"
          title="Returning to camp."
          subtitle="That day is not part of this journey."
          aside={
            <Button small variant="secondary" onPress={() => navigate({ name: 'home' })}>
              Return to camp
            </Button>
          }
        />
      </Screen>
    )
  }

  if (!day.summary) {
    const missed = day.status === 'missed'
    return (
      <Screen>
        <ScreenHead
          kicker={`Day ${day.index + 1} · ${missed ? 'Lost' : 'Open'}`}
          title={missed ? 'The day passed unclaimed.' : 'The day is still open.'}
          subtitle={
            missed
              ? 'No summary was sealed for this day.'
              : 'Claim the daily warden to seal the day.'
          }
          aside={
            <Button
              small
              variant="secondary"
              onPress={() => navigate({ name: missed ? 'home' : 'map' })}
            >
              {missed ? 'Return to camp' : 'Return to map'}
            </Button>
          }
        />
      </Screen>
    )
  }

  const summary = day.summary
  const path = buildDayPath(day)
  const runClosed = run?.status === 'closed'
  const leveledUp = profile
    ? levelForXp(profile.xp) > levelForXp(Math.max(0, profile.xp - summary.xp))
    : false

  return (
    <Screen>
      <Panel pad={false} style={styles.card}>
        <ReportSection>
          <View style={styles.headRow}>
            <View style={styles.headCopy}>
              <Text variant="micro" tone="muted">
                {`Day ${day.index + 1} of ${RUN_DAYS} · Sealed`}
              </Text>
              <Text variant="headingLg" accessibilityRole="header">
                The day is sealed.
              </Text>
              <View style={styles.chips}>
                <Chip variant="quiet" icon="compass">
                  {formatDayKey(day.date)}
                </Chip>
                <Chip
                  variant={summary.bossCompleted ? 'accent' : 'quiet'}
                  icon={summary.bossCompleted ? 'crown' : 'lock'}
                >
                  {summary.bossCompleted ? 'Warden claimed' : 'Warden passed'}
                </Chip>
              </View>
            </View>
            <ReportSeal
              numeral={romanDay(day.index)}
              label="DAY"
              accessibilityLabel={`Day ${day.index + 1} seal`}
            />
          </View>
        </ReportSection>

        <ReportSection>
          <View style={styles.path} accessible accessibilityLabel="Route taken">
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
                  <View style={styles.pathText}>
                    <View style={styles.pathBody}>
                      <Text style={[styles.pathTitle, { color: colors.ink }]} numberOfLines={2}>
                        {row.title}
                      </Text>
                      <Text style={[styles.pathMeta, { color: colors.inkSoft }]} numberOfLines={2}>
                        {NODE_TYPE_LABEL[row.type]}
                        {row.goalTitle ? ` · ${row.goalTitle}` : ''} ·{' '}
                        {done ? 'Claimed' : 'Passed'}
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
                </View>
              )
            })}
          </View>
          <Text variant="bodySm" tone="muted" style={styles.bonusNote}>
            {summary.bossCompleted
              ? `Includes warden closing bonus +${summary.closingBonusXp} XP · +${summary.closingBonusGold} gold.`
              : 'Warden passed: no closing bonus.'}
          </Text>
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
                    {objective.after >= objective.target
                      ? 'Vow met'
                      : `${objective.target - objective.after} to go`}
                  </Text>
                </View>
              ))}
            </View>
          </ReportSection>
        ) : null}

        <ReportSection>
          <ReportSectionHead title="Found today" />
          <ReportLootGrid
            loot={summary.loot}
            empty={
              <Text variant="bodySm" tone="muted">
                No relics today.
              </Text>
            }
          />
          {summary.duplicateGold > 0 ? (
            <Text variant="bodySm" tone="soft" style={styles.lootNote}>
              {`Duplicates converted into ${summary.duplicateGold} gold.`}
            </Text>
          ) : null}
        </ReportSection>

        <ReportSection last>
          {leveledUp && profile ? (
            <View
              style={[
                styles.levelUp,
                { borderColor: colors.accent, backgroundColor: colors.accentWash },
              ]}
            >
              <Icon name="star" size={15} color={colors.accentDeep} />
              <Text style={[styles.levelUpText, { color: colors.accentDeep }]}>
                {`Level ${profile.level} reached.`}
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
                accessibilityHint="The next route opens at midnight."
                full
              >
                Wait for tomorrow
              </Button>
            )}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
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
    alignItems: 'flex-start',
    gap: space.sm,
    // 9px gives the two-line text block room without crowding the medallion.
    paddingVertical: 9,
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
  pathText: { flex: 1, minWidth: 0, gap: 3 },
  pathBody: { minWidth: 0, gap: 2 },
  // 16/20px keeps the path title readable next to the summary totals.
  pathTitle: { fontFamily: fonts.display, fontSize: 16, lineHeight: 20 },
  pathMeta: {
    fontFamily: fonts.uiBold,
    fontSize: 11.5,
    lineHeight: 15,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  pathRewards: { alignItems: 'flex-start', gap: 2 },
  pathReward: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
    textAlign: 'left',
    fontVariant: ['lining-nums', 'tabular-nums'],
  },
  pathDuplicate: {
    fontFamily: fonts.ui,
    fontSize: 11.5,
    lineHeight: 15,
    textAlign: 'left',
  },
  bonusNote: { marginTop: space.sm },
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
    fontSize: 11.5,
    lineHeight: 15,
    letterSpacing: 0.4,
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
  // 12.5px keeps the level-up strip readable without competing with the H1.
  levelUpText: {
    flex: 1,
    fontFamily: fonts.uiBold,
    fontSize: 12.5,
    lineHeight: 17,
    letterSpacing: 0.4,
  },
  actions: { gap: space.sm },
})
