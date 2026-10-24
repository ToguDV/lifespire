import { Pressable, StyleSheet, View } from 'react-native'
import type { ReactNode } from 'react'
import type { GoalIconId } from '@lifespire/core'
import { GOAL_ICON_LABEL } from '@lifespire/app-core/ui/format'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { Icon } from './Icon'
import { Progress } from './Progress'
import { Text } from './Text'

export function AimRow({
  icon,
  title,
  subtitle,
  progress,
  target,
  right,
  onPress,
  accessibilityLabel,
}: {
  icon: GoalIconId
  title: string
  subtitle?: ReactNode
  progress?: number
  target?: number
  right?: ReactNode
  onPress?: () => void
  accessibilityLabel?: string
}) {
  const { colors } = useTheme()
  const content = (
    <View style={styles.row}>
      <View style={[styles.crest, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
        <Icon name={icon} size={17} color={colors.accentDeep} />
      </View>
      <View style={styles.body}>
        <Text variant="headingSm" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {typeof progress === 'number' && typeof target === 'number' ? (
          <View style={styles.progressRow}>
            <Progress value={progress} max={target} label={`${GOAL_ICON_LABEL[icon]} progress`} />
            <Text variant="caption" tone="muted">
              {progress}/{target}
            </Text>
          </View>
        ) : null}
      </View>
      {right}
    </View>
  )

  if (!onPress) return content
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      android_ripple={{ color: colors.accentWash }}
      style={({ pressed }) => [styles.pressable, pressed ? { opacity: 0.8 } : null]}
    >
      {content}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pressable: { borderRadius: radius.md, paddingVertical: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  crest: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 3 },
})
