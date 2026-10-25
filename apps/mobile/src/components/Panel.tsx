import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { radius, shadows, space } from '../theme/tokens'
import { Text } from './Text'

export function Panel({
  children,
  pad = true,
  style,
}: {
  children: ReactNode
  pad?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const { colors } = useTheme()
  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: colors.surface,
          borderColor: colors.hairline,
          padding: pad ? space.md : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}

export function PanelHead({ label, aside }: { label: string; aside?: ReactNode }) {
  const { colors } = useTheme()
  return (
    <View style={[styles.head, { borderColor: colors.hairline }]}>
      <Text variant="micro" tone="muted">
        {label.toUpperCase()}
      </Text>
      {aside}
    </View>
  )
}

export function ScreenHead({
  kicker,
  title,
  subtitle,
  aside,
}: {
  kicker?: string
  title: string
  subtitle?: ReactNode
  aside?: ReactNode
}) {
  const { colors } = useTheme()
  return (
    <View style={styles.screenHead}>
      <View style={styles.screenHeadText}>
        {kicker ? (
          <View style={styles.kicker}>
            <View style={[styles.kickerMark, { backgroundColor: colors.accent }]} />
            <Text variant="micro" tone="muted">
              {kicker.toUpperCase()}
            </Text>
          </View>
        ) : null}
        <Text variant="displayMd" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          typeof subtitle === 'string' ? (
            <Text variant="bodyMd" tone="muted">
              {subtitle}
            </Text>
          ) : (
            subtitle
          )
        ) : null}
      </View>
      {aside ? <View style={styles.aside}>{aside}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderRadius: radius.xl,
    ...shadows.soft,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: space.sm,
    marginBottom: space.md,
  },
  screenHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
  },
  screenHeadText: { flex: 1, gap: space.xs },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  kickerMark: { width: 5, height: 5, borderRadius: 1, transform: [{ rotate: '45deg' }] },
  aside: { alignItems: 'flex-end' },
})
