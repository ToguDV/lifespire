import { StyleSheet, View } from 'react-native'
import type { Day } from '@lifespire/core'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { Icon } from './Icon'
import { Text } from './Text'

export function Progress({
  value,
  max,
  tone = 'accent',
  height = 6,
  label,
}: {
  value: number
  max: number
  tone?: 'accent' | 'gold' | 'xp' | 'ink'
  height?: number
  label?: string
}) {
  const { colors } = useTheme()
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const fill =
    tone === 'gold' ? colors.gold : tone === 'xp' ? colors.xp : tone === 'ink' ? colors.ink : colors.accent
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: Math.min(value, max) }}
      style={[styles.track, { backgroundColor: colors.surfaceSunken, height }]}
    >
      <View style={[styles.fill, { backgroundColor: fill, width: `${ratio * 100}%` }]} />
    </View>
  )
}

export function Pips({
  total,
  filled,
  tone = 'accent',
}: {
  total: number
  filled: number
  tone?: 'accent' | 'gold'
}) {
  const { colors } = useTheme()
  return (
    <View style={styles.pips} accessibilityElementsHidden>
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[
            styles.pip,
            {
              backgroundColor: index < filled ? (tone === 'gold' ? colors.gold : colors.accent) : colors.surfaceSunken,
              borderColor: index < filled ? (tone === 'gold' ? colors.gold : colors.accent) : colors.hairline,
            },
          ]}
        />
      ))}
    </View>
  )
}

export function DayPips({
  days,
  currentIndex,
}: {
  days: Day[]
  currentIndex?: number
}) {
  const { colors } = useTheme()
  return (
    <View style={styles.dayPips} accessibilityLabel="Seven-day run">
      {days.map((day) => {
        const done = day.status === 'completed'
        const missed = day.status === 'missed'
        const current = day.index === currentIndex
        return (
          <View
            key={day.id}
            style={[
              styles.dayPip,
              {
                backgroundColor: done
                  ? colors.ink
                  : missed
                    ? colors.surfaceSunken
                    : current
                      ? colors.accentSoft
                      : colors.surface,
                borderColor: current ? colors.accent : done ? colors.ink : colors.hairline,
              },
            ]}
            accessibilityLabel={`Day ${day.index + 1}, ${done ? 'kept' : missed ? 'missed' : current ? 'today' : 'ahead'}`}
          >
            {done ? (
              <Icon name="check" size={10} color={colors.onAccent} />
            ) : missed ? (
              <Text variant="micro" tone="soft">
                –
              </Text>
            ) : (
              <Text variant="micro" tone={current ? 'accent' : 'soft'}>
                {day.index + 1}
              </Text>
            )}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.full },
  pips: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  pip: { width: 7, height: 7, borderRadius: radius.full, borderWidth: 1 },
  dayPips: { flexDirection: 'row', gap: space.xxs, flexWrap: 'wrap' },
  dayPip: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
