import { Children } from 'react'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { fonts, radius } from '../theme/tokens'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { Text } from './Text'

export function Stat({
  label,
  value,
  tone,
  progress,
}: {
  label: string
  value: ReactNode
  tone?: 'accent' | 'muted'
  progress?: number
}) {
  const { colors } = useTheme()
  const color = tone === 'muted' ? colors.inkSoft : colors.inkStrong
  const ratio =
    typeof progress === 'number' ? Math.max(0, Math.min(1, progress)) : null
  return (
    <View style={styles.stat}>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text variant="numeral" style={{ color }} numberOfLines={1}>
          {value}
        </Text>
      ) : (
        value
      )}
      <Text style={[styles.label, { color: colors.inkSoft }]} numberOfLines={2}>
        {label.toUpperCase()}
      </Text>
      {ratio === null ? null : (
        <View style={[styles.progressTrack, { backgroundColor: colors.surfaceSunken }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: colors.accent, width: `${ratio * 100}%` },
            ]}
          />
        </View>
      )}
    </View>
  )
}

export function StatStrip({ children }: { children: ReactNode }) {
  const { colors } = useTheme()
  const cells = Children.toArray(children)
  return (
    <View style={styles.strip}>
      {cells.map((child, index) => (
        <View
          key={index}
          style={[
            styles.cell,
            index > 0
              ? { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline }
              : null,
          ]}
        >
          {child}
        </View>
      ))}
    </View>
  )
}

export function Resource({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  const { colors } = useTheme()
  return (
    <View style={styles.resource} accessibilityLabel={label}>
      <Icon name={icon} size={16} color={colors.accentDeep} />
      <Text variant="resource">{value}</Text>
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
  const total = Math.max(1, xpIntoLevel + xpToNext)
  const ratio = Math.max(0, Math.min(1, xpIntoLevel / total))
  return (
    <View
      style={styles.level}
      accessibilityLabel={`Level ${level} · ${xpIntoLevel} / ${total} XP`}
    >
      <View style={[styles.levelBadge, { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}>
        <Text style={[styles.levelNumber, { color: colors.accentDeep }]}>{level}</Text>
      </View>
      <View style={styles.levelBody}>
        <View style={[styles.levelTrack, { backgroundColor: colors.surfaceSunken }]}>
          <View
            style={[styles.levelFill, { backgroundColor: colors.accent, width: `${ratio * 100}%` }]}
          />
        </View>
        <Text variant="caption" tone="muted" style={styles.levelLabel} numberOfLines={1}>
          {`Level ${level} · ${xpIntoLevel} / ${total} XP`}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  stat: { minWidth: 0 },
  label: {
    marginTop: 4,
    fontFamily: fonts.uiBold,
    fontSize: 9.3,
    lineHeight: 12,
    letterSpacing: 0.75,
    textTransform: 'uppercase',
  },
  progressTrack: {
    width: '100%',
    height: 3,
    marginTop: 7,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.full },
  strip: { flexDirection: 'row', alignItems: 'flex-start' },
  cell: { flex: 1, minWidth: 0, paddingHorizontal: 10 },
  resource: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  level: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  levelBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  levelNumber: { fontFamily: fonts.display, fontSize: 15, lineHeight: 17 },
  levelBody: { flex: 1, gap: 5 },
  levelTrack: { height: 3, borderRadius: radius.full, overflow: 'hidden' },
  levelFill: { height: '100%', borderRadius: radius.full },
  levelLabel: { fontVariant: ['tabular-nums'] },
})
