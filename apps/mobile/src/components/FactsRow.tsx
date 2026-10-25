import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { fonts, radius } from '../theme/tokens'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { Text } from './Text'

/** Shared fact strip for the node detail and the wheel recap. */
export function FactsRow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme()
  return (
    <View
      style={[
        styles.facts,
        { backgroundColor: colors.surfaceRaised, borderColor: colors.hairline },
        style,
      ]}
    >
      {children}
    </View>
  )
}

export function FactCell({
  label,
  value,
  note,
  icon,
  last = false,
}: {
  label: string
  value: string
  note: string
  icon?: IconName
  last?: boolean
}) {
  const { colors } = useTheme()
  return (
    <View style={[styles.fact, last ? null : { borderColor: colors.hairline, borderRightWidth: 1 }]}>
      <Text variant="micro" tone="muted" style={styles.factLabel}>
        {label.toUpperCase()}
      </Text>
      <View style={styles.factValue}>
        {icon ? <Icon name={icon} size={14} color={colors.accentDeep} /> : null}
        <Text style={[styles.factStrong, { color: colors.inkStrong }]}>{value}</Text>
      </View>
      <Text style={[styles.factNote, { color: colors.inkSoft }]} numberOfLines={3}>
        {note}
      </Text>
    </View>
  )
}

// 11px vertical cell padding and the 15/10px display sizes keep pixel
// parity with the shipped node screen; no token covers them.
const styles = StyleSheet.create({
  facts: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  fact: { flex: 1, gap: 4, paddingVertical: 11, paddingHorizontal: 10 },
  factLabel: { fontSize: 10, letterSpacing: 1 },
  factValue: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  factStrong: {
    fontFamily: fonts.display,
    fontSize: 15,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  factNote: { fontSize: 10, lineHeight: 13 },
})
