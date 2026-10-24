import { StyleSheet, View } from 'react-native'
import type { LootCatalogEntry } from '@lifespire/core'
import type { LootItem } from '@lifespire/core'
import { RARITY_LABEL, formatShortIsoDay, lootIcon, rarityPips } from '@lifespire/app-core/ui/format'
import { useTheme } from '../theme/ThemeProvider'
import { fonts, radius, shadows } from '../theme/tokens'
import { Icon } from './Icon'
import { Text } from './Text'

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

  if (!owned) {
    return (
      <View
        style={[styles.card, styles.locked, { borderColor: colors.hairline }]}
        accessibilityLabel="Undiscovered relic"
      >
        <View style={styles.lockedIcon}>
          <Icon name="lock" size={20} color={colors.inkSoft} />
        </View>
        <Text variant="micro" tone="soft" style={styles.lockedTitle}>
          Undiscovered
        </Text>
        <Text variant="caption" tone="soft" style={styles.lockedCopy}>
          A niche still empty
        </Text>
      </View>
    )
  }

  const epic = entry.rarity === 'epic'
  const rare = entry.rarity === 'rare'
  const filled = rarityPips(entry.rarity)
  return (
    <View
      style={[
        styles.card,
        shadows.soft,
        {
          borderColor: epic ? colors.accent : colors.hairline,
          backgroundColor: rare ? colors.surfaceRaised : colors.surface,
        },
      ]}
      accessibilityLabel={`${entry.name}, ${RARITY_LABEL[entry.rarity]}`}
    >
      {epic ? (
        <View pointerEvents="none" style={[styles.wash, { backgroundColor: colors.accentWash }]} />
      ) : null}
      <View
        style={[
          styles.niche,
          {
            borderColor: epic ? colors.accent : colors.hairline,
            backgroundColor: epic ? colors.accentSoft : colors.surfaceRaised,
          },
        ]}
      >
        <Icon name={lootIcon(entry.id)} size={22} color={colors.accentDeep} />
      </View>
      <View style={styles.body}>
        <Text variant="headingSm" numberOfLines={2}>
          {entry.name}
        </Text>
        <View style={styles.rarityRow} accessibilityLabel={`Rarity ${filled} of 3`}>
          <View style={styles.pips}>
            {[1, 2, 3].map((step) => (
              <View
                key={step}
                style={[
                  styles.pip,
                  {
                    borderColor: step <= filled ? colors.accent : colors.hairlineStrong,
                    backgroundColor: step <= filled ? colors.accent : 'transparent',
                  },
                ]}
              />
            ))}
          </View>
          <Text variant="caption" tone="soft" style={styles.rarityLabel}>
            {RARITY_LABEL[entry.rarity]}
          </Text>
        </View>
        {detailed ? (
          <>
            <Text variant="bodySm" tone="muted" style={styles.description}>
              {entry.description}
            </Text>
            <Text variant="caption" tone="soft" style={styles.found}>
              Found {formatShortIsoDay(owned.obtainedAt)}
            </Text>
          </>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    flexGrow: 1,
    minHeight: 164,
    padding: 13,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  wash: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: 60,
    borderTopLeftRadius: radius.lg - 1,
    borderTopRightRadius: radius.lg - 1,
  },
  locked: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  lockedIcon: { opacity: 0.6 },
  lockedTitle: { textAlign: 'center', textTransform: 'uppercase' },
  lockedCopy: { textAlign: 'center' },
  niche: {
    width: 52,
    height: 62,
    marginBottom: 12,
    borderWidth: 1,
    borderTopLeftRadius: 99,
    borderTopRightRadius: 99,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flexGrow: 1, gap: 4 },
  rarityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  pips: { flexDirection: 'row', gap: 3 },
  pip: {
    width: 5,
    height: 5,
    borderRadius: 1,
    borderWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  rarityLabel: {
    fontFamily: fonts.uiBold,
    fontSize: 10.24,
    lineHeight: 13,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  description: { marginTop: 2 },
  found: { marginTop: 2 },
})
