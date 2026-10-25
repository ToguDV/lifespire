import { Pressable, StyleSheet, View } from 'react-native'
import type { ReactNode } from 'react'
import { useTheme } from '../theme/ThemeProvider'
import { radius } from '../theme/tokens'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { Pips } from './Progress'
import { Text } from './Text'

export function clampAimFilled(progress: number, target: number): number {
  return Math.max(0, Math.min(progress, target))
}

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
  icon: IconName
  title: string
  subtitle?: ReactNode
  progress?: number
  target?: number
  right?: ReactNode
  onPress?: () => void
  accessibilityLabel?: string
}) {
  const { colors } = useTheme()
  const filled = typeof progress === 'number' && typeof target === 'number'
    ? clampAimFilled(progress, target)
    : 0
  const content = (
    <View style={styles.row}>
      <View style={[styles.crest, { backgroundColor: colors.surfaceRaised, borderColor: colors.hairline }]}>
        <Icon name={icon} size={15} color={colors.accentDeep} />
      </View>
      <View style={styles.body}>
        <Text variant="resource" numberOfLines={2} style={{ color: colors.ink }}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySm" tone="muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {typeof progress === 'number' && typeof target === 'number' ? (
          <View style={styles.progressRow}>
            <Pips total={target} filled={filled} />
            <Text variant="caption" tone="muted" style={styles.count}>
              {filled} / {target}
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
  pressable: { borderRadius: radius.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  crest: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0, gap: 5 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  count: { marginLeft: 'auto', fontVariant: ['tabular-nums'] },
})
