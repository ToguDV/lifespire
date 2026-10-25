import { Pressable, StyleSheet, View } from 'react-native'
import type { GoalIconId } from '@lifespire/core'
import { GOAL_ICON_IDS } from '@lifespire/core'
import { GOAL_ICON_LABEL } from '@lifespire/app-core/ui/format'
import { useTheme } from '../theme/ThemeProvider'
import { fonts, radius } from '../theme/tokens'
import { Icon } from './Icon'
import { Text } from './Text'

export function IconPicker({
  value,
  onChange,
  label = 'Goal icon',
}: {
  value: GoalIconId
  onChange: (icon: GoalIconId) => void
  label?: string
}) {
  const { colors } = useTheme()
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.grid}>
      {GOAL_ICON_IDS.map((icon) => {
        const selected = icon === value
        return (
          <Pressable
            key={icon}
            accessibilityRole="radio"
            accessibilityLabel={GOAL_ICON_LABEL[icon]}
            accessibilityState={{ selected }}
            onPress={() => onChange(icon)}
            android_ripple={{ color: colors.accentWash }}
            style={({ pressed }) => [
              styles.tile,
              {
                borderColor: selected ? colors.accent : colors.hairline,
                backgroundColor: selected ? colors.accentSoft : colors.surface,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            {selected ? (
              <View
                pointerEvents="none"
                style={[styles.ring, { borderColor: colors.accentSoft }]}
              />
            ) : null}
            <Icon name={icon} size={20} color={selected ? colors.accentDeep : colors.inkMuted} />
            <Text
              variant="caption"
              tone="muted"
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
              style={styles.tileLabel}
            >
              {GOAL_ICON_LABEL[icon]}
            </Text>
            {selected ? (
              <View style={[styles.selectedBadge, { backgroundColor: colors.accent }]}>
                <Icon name="check" size={8} color={colors.onAccent} />
              </View>
            ) : null}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tile: {
    position: 'relative',
    flexBasis: 54,
    flexGrow: 1,
    minWidth: 54,
    minHeight: 54,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  ring: {
    position: 'absolute',
    top: -2,
    right: -2,
    bottom: -2,
    left: -2,
    borderWidth: 2,
    borderRadius: radius.md + 2,
  },
  tileLabel: {
    fontFamily: fonts.ui,
    fontSize: 9.6,
    lineHeight: 11,
    letterSpacing: 0.19,
  },
  selectedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 13,
    height: 13,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
