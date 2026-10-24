import { Pressable, StyleSheet, View } from 'react-native'
import type { GoalIconId } from '@lifespire/core'
import { GOAL_ICON_IDS } from '@lifespire/core'
import { GOAL_ICON_LABEL } from '@lifespire/app-core/ui/format'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { Icon } from './Icon'

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
            android_ripple={{ color: colors.accentWash, borderless: true }}
            style={({ pressed }) => [
              styles.cell,
              {
                borderColor: selected ? colors.accent : colors.hairline,
                backgroundColor: selected ? colors.accentSoft : colors.surface,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Icon name={icon} size={19} color={selected ? colors.accentDeep : colors.inkMuted} />
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  cell: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
