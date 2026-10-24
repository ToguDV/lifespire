import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { xpIntoLevel, xpToNextLevel } from '@lifespire/core'
import {
  buildCollection,
  collectionFilterOptions,
  duplicateConversions,
  duplicateGoldTotal,
  filterCollection,
} from '@lifespire/app-core/ui/collection'
import type { CollectionFilter } from '@lifespire/app-core/ui/collection'
import { RARITY_LABEL, formatShortDayKey } from '@lifespire/app-core/ui/format'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { LootCard } from '../components/LootCard'
import { Panel, PanelHead, ScreenHead } from '../components/Panel'
import { Progress } from '../components/Progress'
import { Screen } from '../components/Screen'
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

  if (!profile) {
    return (
      <Screen>
        <ScreenHead kicker="The reliquary" title="Relics" />
        <Panel>
          <EmptyState icon="gem" title="No profile yet">
            Finish onboarding to begin a collection.
          </EmptyState>
          <Button variant="secondary" onPress={() => navigate({ name: 'home' })} full>
            Back to camp
          </Button>
        </Panel>
      </Screen>
    )
  }

  return (
    <Screen>
      <ScreenHead
        kicker="The reliquary"
        title={profile.name}
        subtitle={
          <Text variant="bodyMd" tone="muted">
            Level {profile.level} · {xpIntoLevel(profile.xp)} / 100 XP · {owned}/12 relics found
          </Text>
        }
        aside={
          <View style={[styles.avatar, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
            <Text variant="headingMd" tone="deep">{profile.name.slice(0, 1).toUpperCase()}</Text>
          </View>
        }
      />

      <Panel>
        <PanelHead label="The traveller" />
        <Progress value={xpIntoLevel(profile.xp)} max={100} label="Experience to next level" />
        <Text variant="caption" tone="muted" style={styles.xpNote}>
          {xpToNextLevel(profile.xp)} XP to level {profile.level + 1}
        </Text>
        <StatStrip>
          <Stat label="XP" value={profile.xp} tone="xp" />
          <Stat label="Gold" value={profile.gold} tone="gold" />
          <Stat label="Relics" value={`${owned}/12`} />
        </StatStrip>
      </Panel>

      <Panel>
        <PanelHead label="Collection" aside={<Text variant="caption" tone="soft">{visible.length} shown</Text>} />
        <View style={styles.filters}>
          {options.map((option) => {
            const selected = option.filter === filter
            return (
              <Pressable
                key={option.filter}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setFilter(option.filter)}
                style={[
                  styles.filter,
                  {
                    borderColor: selected ? colors.accent : colors.hairline,
                    backgroundColor: selected ? colors.accentSoft : colors.surface,
                  },
                ]}
              >
                <Text variant="caption" tone={selected ? 'deep' : 'muted'}>
                  {option.label}
                </Text>
                <Text variant="micro" tone={selected ? 'deep' : 'soft'}>
                  {option.owned}/{option.total}
                </Text>
              </Pressable>
            )
          })}
        </View>
        <View style={styles.collection}>
          {visible.map((entry) => (
            <View key={entry.catalog.id} style={styles.lootCell}>
              <LootCard entry={entry.catalog} owned={entry.owned ?? undefined} detailed />
            </View>
          ))}
        </View>
      </Panel>

      <Panel>
        <PanelHead
          label="Duplicate conversions"
          aside={<Text variant="caption" tone="gold">{duplicateGold} gold</Text>}
        />
        {duplicates.length === 0 ? (
          <Text variant="bodySm" tone="muted">
            No duplicate relics were converted in this run.
          </Text>
        ) : (
          <View style={styles.duplicates}>
            {duplicates.map((conversion) => (
              <View key={conversion.eventId} style={[styles.duplicate, { borderColor: colors.hairline }]}>
                <Icon name="gem" size={15} color={colors.accentDeep} />
                <View style={styles.duplicateBody}>
                  <Text variant="bodySm" numberOfLines={1}>{conversion.name}</Text>
                  <Text variant="caption" tone="muted">
                    Day {conversion.dayNumber} · {conversion.date ? formatShortDayKey(conversion.date) : 'unknown'} ·{' '}
                    {conversion.rarity ? RARITY_LABEL[conversion.rarity] : 'relic'}
                  </Text>
                </View>
                <Text variant="bodySm" tone="gold">{`+${conversion.gold}`}</Text>
              </View>
            ))}
          </View>
        )}
      </Panel>
    </Screen>
  )
}

const styles = StyleSheet.create({
  avatar: { width: 52, height: 52, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  xpNote: { marginVertical: space.xs },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginBottom: space.sm },
  filter: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: space.sm, paddingVertical: 3 },
  collection: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  lootCell: { flexBasis: '46%', flexGrow: 1, maxWidth: '48%' },
  duplicates: { gap: space.sm },
  duplicate: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: space.sm },
  duplicateBody: { flex: 1, gap: 2 },
})
