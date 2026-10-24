import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { space } from '../theme/tokens'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { Text } from './Text'

export function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: ReactNode
  tone?: 'accent' | 'gold' | 'xp' | 'muted'
}) {
  return (
    <View style={styles.stat}>
      <Text variant="micro" tone="muted">
        {label.toUpperCase()}
      </Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text variant="headingMd" tone={tone === 'muted' ? 'muted' : tone ?? 'default'}>
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  )
}

export function StatStrip({ children }: { children: ReactNode }) {
  const { colors } = useTheme()
  return (
    <View style={[styles.strip, { borderColor: colors.hairline, backgroundColor: colors.surface }]}>
      {children}
    </View>
  )
}

export function Resource({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  const { colors } = useTheme()
  return (
    <View style={styles.resource} accessibilityLabel={label}>
      <Icon name={icon} size={15} color={colors.accentDeep} />
      <Text variant="bodySm">{value}</Text>
    </View>
  )
}

export function LevelResource({
  level,
  xpIntoLevel,
  xpToNext,
}: {
  level: number
  xpIntoLevel: number
  xpToNext: number
}) {
  const { colors } = useTheme()
  return (
    <View style={styles.level} accessibilityLabel={`Level ${level}, ${xpIntoLevel} of ${xpToNext} XP`}>
      <View style={[styles.levelBadge, { borderColor: colors.accent }]}>
        <Text variant="micro" tone="deep">
          {level}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  stat: { flex: 1, minWidth: 88, gap: 2 },
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    borderWidth: 1,
    borderRadius: 12,
    padding: space.md,
  },
  resource: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  level: { flexDirection: 'row', alignItems: 'center' },
  levelBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
})
