import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { RUN_DAYS, XP_PER_LEVEL, xpIntoLevel, xpToNextLevel } from '@lifespire/core'
import {
  buildCollection,
  collectionFilterOptions,
  duplicateConversions,
  duplicateGoldTotal,
  filterCollection,
} from '@lifespire/app-core/ui/collection'
import type { CollectionFilter } from '@lifespire/app-core/ui/collection'
import { RARITY_LABEL, formatShortDayKey, lootIcon } from '@lifespire/app-core/ui/format'
import { useTheme } from '../theme/ThemeProvider'
import { fonts, radius, space } from '../theme/tokens'
import { Button } from '../components/Button'
import { Chip } from '../components/Chip'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { LootCard } from '../components/LootCard'
import { Panel, PanelHead, ScreenHead } from '../components/Panel'
import { Progress } from '../components/Progress'
import { Screen } from '../components/Screen'
import { SegmentedControl } from '../components/SegmentedControl'
import { Stat, StatStrip } from '../components/Stat'
import { Text } from '../components/Text'
import { useAppStore } from '../state/store'

export function ProfileScreen() {
  const { colors } = useTheme()
  const document = useAppStore((state) => state.document)
  const navigate = useAppStore((state) => state.navigate)
  const profile = document.profile
  const run = document.run
  const [filter, setFilter] = useState<CollectionFilter>('all')
  const collection = buildCollection(profile?.loot ?? [])
  const options = collectionFilterOptions(collection)
  const visible = filterCollection(collection, filter)
  const duplicates = duplicateConversions(run)
  const duplicateGold = duplicateGoldTotal(duplicates)
  const owned = collection.filter((entry) => entry.owned).length
  const daysKept = run?.days.filter((day) => day.status === 'completed').length ?? 0

  if (!profile) {
    return (
      <Screen>
        <ScreenHead
          kicker="Profile"
          title="The Reliquary"
          subtitle="Your level, gold and collection appear after onboarding."
        />
        <EmptyState
          icon="gem"
          title="No profile yet"
          action={
            <Button onPress={() => navigate({ name: 'onboarding' })}>Begin the journey</Button>
          }
        >
          The catalogue below is complete from the start. Relics are revealed as they are found
          during a run.
        </EmptyState>
      </Screen>
    )
  }

  const xpNow = xpIntoLevel(profile.xp)
  const xpLeft = xpToNextLevel(profile.xp)

  return (
    <Screen>
      <ScreenHead
        kicker="Profile · The Reliquary"
        title="The Reliquary"
        subtitle="Tokens found along the climb. No powers, only proof."
        aside={
          <Chip icon="gem">
            {owned} of {collection.length}
          </Chip>
        }
      />

      <Panel>
        <View style={styles.stripTop}>
          <View
            style={[
              styles.levelBadge,
              { backgroundColor: colors.accentSoft, borderColor: colors.accent },
            ]}
          >
            <Text style={[styles.levelNumber, { color: colors.accentDeep }]}>{profile.level}</Text>
            <Text style={[styles.levelCaption, { color: colors.inkMuted }]}>Lv</Text>
          </View>
          <View style={styles.stripId}>
            <Text variant="headingLg">{profile.name}</Text>
            <Text style={[styles.wayfarer, { color: colors.inkSoft }]}>
              Wayfarer of the quiet path
            </Text>
            <View style={styles.xpMeta}>
              <Text style={[styles.xpMetaText, { color: colors.inkSoft }]}>Experience</Text>
              <Text style={[styles.xpMetaText, { color: colors.inkSoft }]}>{xpNow} / {XP_PER_LEVEL}</Text>
            </View>
            <View style={styles.xpBar}>
              <Progress value={xpNow} max={XP_PER_LEVEL} height={4} label="Experience in this level" />
            </View>
            <Text variant="caption" tone="soft" style={styles.xpLeft}>
              {xpLeft} XP to level {profile.level + 1}
            </Text>
          </View>
        </View>
        <View style={[styles.stats, { borderColor: colors.hairline }]}>
          <StatStrip>
            <Stat label="Gold" value={profile.gold} />
            <Stat label="Relics" value={owned} />
            <Stat label="Days kept" value={`${daysKept} / ${RUN_DAYS}`} />
          </StatStrip>
        </View>
      </Panel>

      <View style={styles.collectionBlock}>
        <View style={styles.collectionHead}>
          <Text variant="headingLg">Found so far</Text>
          <Text variant="micro" tone="muted">
            {owned} of {collection.length}
          </Text>
        </View>
        <SegmentedControl
          label="Filter relics by rarity"
          value={filter}
          onChange={setFilter}
          options={options.map((option) => ({
            value: option.filter,
            label: option.label,
            detail: `${option.owned}/${option.total}`,
            accessibilityLabel: `${option.label}: ${option.owned} of ${option.total} found`,
          }))}
        />
        <Text
          variant="micro"
          tone="muted"
          accessibilityLiveRegion="polite"
          style={styles.collectionStatus}
        >
          Showing {visible.length} relics · {owned} found
        </Text>
        <View style={styles.collection}>
          {visible.map((entry) => (
            <View key={entry.catalog.id} style={styles.lootCell}>
              <LootCard entry={entry.catalog} owned={entry.owned ?? undefined} detailed />
            </View>
          ))}
        </View>
      </View>

      <Panel>
        <PanelHead
          label="Duplicate conversions"
          aside={
            duplicates.length > 0 ? (
              <Chip variant="quiet">{`+${duplicateGold} gold`}</Chip>
            ) : undefined
          }
        />
        {!run ? (
          <Text variant="bodySm" tone="muted">
            Duplicate history starts with a run. Past runs are not kept in this save.
          </Text>
        ) : duplicates.length === 0 ? (
          <Text variant="bodySm" tone="muted">
            No duplicate relics have been converted in this run yet. A second copy of a relic
            becomes gold when it is found.
          </Text>
        ) : (
          <View style={styles.duplicates}>
            {duplicates.map((conversion) => (
              <View
                key={conversion.eventId}
                style={[styles.duplicate, { borderColor: colors.hairline }]}
              >
                <Icon name={lootIcon(conversion.catalogId)} size={15} color={colors.accentDeep} />
                <View style={styles.duplicateBody}>
                  <Text variant="bodySm" numberOfLines={1}>
                    {conversion.name}
                  </Text>
                  <Text variant="caption" tone="muted">
                    Day {conversion.dayNumber} ·{' '}
                    {conversion.date ? formatShortDayKey(conversion.date) : 'unknown'} ·{' '}
                    {conversion.rarity ? RARITY_LABEL[conversion.rarity] : 'relic'}
                  </Text>
                </View>
                <Text variant="bodySm" tone="deep">{`+${conversion.gold} gold`}</Text>
              </View>
            ))}
          </View>
        )}
      </Panel>
    </Screen>
  )
}

const styles = StyleSheet.create({
  stripTop: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },
  levelBadge: {
    width: 62,
    height: 62,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  // 21.6/7.4/10.6/9.9px keep pixel parity with the web reliquary header.
  levelNumber: { fontFamily: fonts.display, fontSize: 21.6, lineHeight: 24 },
  levelCaption: {
    position: 'absolute',
    bottom: 8,
    fontFamily: fonts.uiBold,
    fontSize: 7.4,
    lineHeight: 9,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  stripId: { flex: 1, minWidth: 130 },
  wayfarer: {
    marginTop: 3,
    fontFamily: fonts.uiBold,
    fontSize: 10.6,
    lineHeight: 14,
    letterSpacing: 0.64,
    textTransform: 'uppercase',
  },
  xpMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 9,
  },
  xpMetaText: {
    fontFamily: fonts.uiBold,
    fontSize: 9.9,
    lineHeight: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  xpBar: { marginTop: 5 },
  xpLeft: { marginTop: 6 },
  stats: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: space.md,
    paddingTop: space.sm,
  },
  collectionBlock: { gap: space.sm },
  collectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginTop: space.xs,
  },
  collectionStatus: { paddingHorizontal: 2, paddingBottom: space.xs },
  collection: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: space.xs },
  // 47% cells match the summary loot grid; 10px gutter keeps web parity.
  lootCell: { flexBasis: '47%', flexGrow: 1, maxWidth: '48%' },
  duplicates: { gap: space.sm },
  duplicate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: space.sm,
  },
  duplicateBody: { flex: 1, gap: 2 },
})
