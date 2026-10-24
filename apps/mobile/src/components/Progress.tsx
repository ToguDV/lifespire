import { StyleSheet, View } from 'react-native'
import type { Day } from '@lifespire/core'
import { useTheme } from '../theme/ThemeProvider'
import { radius } from '../theme/tokens'

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
      {Array.from({ length: total }, (_, index) => {
        const on = index < filled
        return (
          <View
            key={index}
            style={[
              styles.pip,
              {
                backgroundColor: on ? (tone === 'gold' ? colors.gold : colors.accent) : 'transparent',
                borderColor: on ? (tone === 'gold' ? colors.gold : colors.accent) : colors.hairlineStrong,
              },
            ]}
          />
        )
      })}
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
        const current = day.index === currentIndex
        return (
          <View
            key={day.id}
            style={styles.dayPipSlot}
            accessibilityLabel={`Day ${day.index + 1}, ${done ? 'kept' : current ? 'today' : 'ahead'}`}
          >
            {current ? <View style={[styles.dayPipRing, { borderColor: colors.accentSoft }]} /> : null}
            <View
              style={[
                styles.dayPip,
                {
                  backgroundColor: done ? colors.ink : current ? colors.accent : 'transparent',
                  borderColor: done ? colors.ink : current ? colors.accent : colors.hairlineStrong,
                },
              ]}
            />
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
  pip: { width: 6, height: 13, borderRadius: 2, borderWidth: 1 },
  dayPips: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  dayPipSlot: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  dayPip: { width: 7, height: 7, borderRadius: 1.5, borderWidth: 1, transform: [{ rotate: '45deg' }] },
  dayPipRing: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 2,
    borderWidth: 3,
    transform: [{ rotate: '45deg' }],
  },
})
