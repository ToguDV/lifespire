import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { radius } from '../theme/tokens'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { Text } from './Text'

export function EmptyState({
  icon = 'moon',
  kicker,
  title,
  children,
  action,
}: {
  icon?: IconName
  kicker?: string
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  const { colors } = useTheme()
  return (
    <View style={styles.root}>
      <View style={[styles.medallionRing, { backgroundColor: colors.accentWash }]}>
        <View style={[styles.medallion, { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}>
          <Icon name={icon} size={26} color={colors.accentDeep} />
        </View>
      </View>
      {kicker ? (
        <Text variant="micro" tone="muted">
          {kicker.toUpperCase()}
        </Text>
      ) : null}
      <Text variant="headingLg" accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {children ? (
        <Text variant="bodySm" tone="muted" style={styles.copy}>
          {children}
        </Text>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: 9,
    paddingTop: 26,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  medallionRing: {
    width: 76,
    height: 76,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  medallion: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { maxWidth: 320, textAlign: 'center' },
  copy: { maxWidth: 340, lineHeight: 21, textAlign: 'center' },
  action: { marginTop: 8 },
})
