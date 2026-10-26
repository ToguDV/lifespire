import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import type { LootItem } from '@lifespire/core'
import { findLootById } from '@lifespire/core'
import { RARITY_LABEL, lootIcon } from '@lifespire/app-core/ui/format'
import { useTheme } from '../theme/ThemeProvider'
import { fonts, radius, space } from '../theme/tokens'
import { AnimatedNumber } from './AnimatedNumber'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { LootCard } from './LootCard'
import { Text } from './Text'

export function ReportSection({ children, last = false }: { children: ReactNode; last?: boolean }) {
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

export function ReportSectionHead({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <View style={styles.sectionHead}>
      <Text variant="headingSm" accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {aside}
    </View>
  )
}

export function ReportSeal({
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

export function ReportTotal({ icon, value, label }: { icon: IconName; value: number; label: string }) {
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

export function ReportTotals({
  xp,
  gold,
  relics,
  accessibilityLabel,
}: {
  xp: number
  gold: number
  relics: number
  accessibilityLabel: string
}) {
  const { colors } = useTheme()
  return (
    <View style={styles.totals} accessible accessibilityLabel={accessibilityLabel}>
      <ReportTotal icon="star" value={xp} label="Experience" />
      <View style={[styles.totalDivider, { borderColor: colors.hairline }]}>
        <View style={styles.totalDividerInner}>
          <ReportTotal icon="coin" value={gold} label="Gold" />
        </View>
      </View>
      <View style={[styles.totalDivider, { borderColor: colors.hairline }]}>
        <View style={styles.totalDividerInner}>
          <ReportTotal icon="gem" value={relics} label="Relics" />
        </View>
      </View>
    </View>
  )
}

export function ReportLootFallback({ item }: { item: LootItem }) {
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

export function ReportLootGrid({ loot, empty }: { loot: LootItem[]; empty?: ReactNode }) {
  const { colors } = useTheme()
  if (loot.length === 0) {
    if (empty) return <>{empty}</>
    // No accessibilityLabel: the child text already reads the same aloud.
    return (
      <View style={[styles.emptyLoot, { borderColor: colors.hairlineStrong }]}>
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
            {entry ? <LootCard entry={entry} owned={item} /> : <ReportLootFallback item={item} />}
          </View>
        )
      })}
    </View>
  )
}

// Display sizes below (20/21.6/9.4/7.4) keep pixel parity with the web
// summary card and seal; they are not part of the mobile type ramp.
const styles = StyleSheet.create({
  section: { padding: space.xl },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginBottom: space.sm,
  },
  sectionTitle: { flexShrink: 1 },
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
  totals: { flexDirection: 'row' },
  // 3/5px dense rhythms and the 10px divider offset keep web parity.
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
  // 10px two-column gutter and 47% cells: no token, keeps web grid parity.
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
})
