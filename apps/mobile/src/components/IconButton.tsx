import { Pressable, StyleSheet } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { Icon } from './Icon'
import type { IconName } from './Icon'

export function IconButton({
  icon,
  label,
  onPress,
  active = false,
  size = 40,
  style,
  disabled = false,
}: {
  icon: IconName
  label: string
  onPress?: () => void
  active?: boolean
  size?: number
  style?: StyleProp<ViewStyle>
  disabled?: boolean
}) {
  const { colors } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: colors.accentWash, borderless: true }}
      hitSlop={space.xs}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderColor: active ? colors.accent : colors.hairline,
          backgroundColor: active ? colors.accentSoft : colors.surface,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Icon name={icon} size={size * 0.45} color={active ? colors.accentDeep : colors.inkMuted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
