import { Pressable, StyleSheet, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { fonts, radius, space } from '../theme/tokens'
import { Text } from './Text'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  detail?: string
  accessibilityLabel?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<SegmentedOption<T>>
  value: T
  onChange: (next: T) => void
  label?: string
}) {
  const { colors } = useTheme()
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.track, { backgroundColor: colors.surfaceSunken, borderColor: colors.hairline }]}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ selected, disabled: false }}
            onPress={() => onChange(option.value)}
            android_ripple={{ color: colors.accentWash }}
            style={({ pressed }) => [
              styles.option,
              selected
                ? {
                    backgroundColor: colors.surfaceRaised,
                    ...styles.optionShadow,
                  }
                : { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={styles.optionBody}>
              <Text variant="caption" tone={selected ? 'default' : 'soft'} style={styles.optionLabel}>
                {option.label}
              </Text>
              {option.detail ? (
                <Text tone={selected ? 'deep' : 'soft'} style={styles.optionDetail}>
                  {option.detail}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: 3,
    padding: 3,
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  option: {
    flex: 1,
    minHeight: 44,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xs,
  },
  optionShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  optionBody: { alignItems: 'center', gap: 1 },
  optionLabel: {
    fontFamily: fonts.uiBold,
    fontSize: 10.9,
    lineHeight: 14,
    letterSpacing: 0.44,
    textTransform: 'uppercase',
  },
  optionDetail: {
    fontFamily: fonts.uiBold,
    fontSize: 9.3,
    lineHeight: 11,
    letterSpacing: 0.45,
    fontVariant: ['tabular-nums'],
  },
})
