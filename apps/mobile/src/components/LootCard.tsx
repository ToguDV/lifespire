import { StyleSheet, View } from 'react-native'
import type { LootCatalogEntry } from '@lifespire/core'
import type { LootItem, Rarity } from '@lifespire/core'
import { RARITY_LABEL, formatShortIsoDay, lootIcon, rarityPips } from '@lifespire/app-core/ui/format'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { Icon } from './Icon'
import { Text } from './Text'

const RARITY_TONE: Record<Rarity, 'muted' | 'accent' | 'gold'> = {
  common: 'muted',
  rare: 'accent',
  epic: 'gold',
}

export function LootCard({
  entry,
  owned,
  detailed = false,
}: {
  entry: LootCatalogEntry
  owned?: LootItem
  detailed?: boolean
}) {
  const { colors } = useTheme()
  const locked = !owned
  const tone = RARITY_TONE[entry.rarity]
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: locked ? colors.surfaceSunken : colors.surface,
          borderColor: locked ? colors.hairline : tone === 'gold' ? colors.accentDeep : colors.hairlineStrong,
        },
      ]}
      accessibilityLabel={locked ? 'Undiscovered relic' : `${entry.name}, ${RARITY_LABEL[entry.rarity]}`}
    >
      <View
        style={[
          styles.art,
          { backgroundColor: locked ? colors.surface : colors.accentSoft, borderColor: colors.hairline },
        ]}
      >
        <Icon
          name={locked ? 'lock' : lootIcon(entry.id)}
          size={24}
          color={locked ? colors.inkSoft : colors.accentDeep}
        />
      </View>
      <View style={styles.body}>
        <Text variant="headingSm" numberOfLines={1} tone={locked ? 'soft' : 'default'}>
          {locked ? 'Undiscovered' : entry.name}
        </Text>
        {locked ? (
          <Text variant="caption" tone="soft">
            A niche still empty.
          </Text>
        ) : (
          <>
            <View style={styles.rarityRow}>
              <View style={styles.pips}>
                {Array.from({ length: rarityPips(entry.rarity) }, (_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.pip,
                      {
                        backgroundColor:
                          entry.rarity === 'epic'
                            ? colors.accentDeep
                            : entry.rarity === 'rare'
                              ? colors.accent
                              : colors.inkMuted,
                      },
                    ]}
                  />
                ))}
              </View>
              <Text variant="caption" tone={tone}>
                {RARITY_LABEL[entry.rarity]}
              </Text>
            </View>
            {detailed && owned ? (
              <>
                <Text variant="bodySm" tone="muted">
                  {entry.description}
                </Text>
                <Text variant="caption" tone="soft">
                  Found {formatShortIsoDay(owned.obtainedAt)}
                </Text>
              </>
            ) : null}
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.sm,
  },
  art: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  rarityRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  pips: { flexDirection: 'row', gap: 3 },
  pip: { width: 6, height: 6, borderRadius: radius.full },
})
