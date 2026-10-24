import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { space } from '../theme/tokens'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { Text } from './Text'

export function EmptyState({
  icon = 'moon',
  title,
  children,
  action,
}: {
  icon?: IconName
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  const { colors } = useTheme()
  return (
    <View style={[styles.root, { borderColor: colors.hairline }]}>
      <Icon name={icon} size={28} color={colors.inkSoft} />
      <Text variant="headingSm">{title}</Text>
      {children ? (
        <Text variant="bodySm" tone="muted" style={styles.copy}>
          {children}
        </Text>
      ) : null}
      {action}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    padding: space.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
  },
  copy: { textAlign: 'center' },
})
