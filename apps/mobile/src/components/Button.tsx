import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { layout, radius, space } from '../theme/tokens'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { Text } from './Text'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'ghost' | 'danger'

export interface ButtonProps {
  children: ReactNode
  onPress?: () => void
  variant?: ButtonVariant
  icon?: IconName
  disabled?: boolean
  loading?: boolean
  small?: boolean
  full?: boolean
  accessibilityLabel?: string
  accessibilityHint?: string
  style?: StyleProp<ViewStyle>
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  small = false,
  full = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ButtonProps) {
  const { colors } = useTheme()
  const background =
    variant === 'primary'
      ? colors.accent
      : variant === 'danger'
        ? colors.surfaceSunken
        : 'transparent'
  const border =
    variant === 'primary'
      ? colors.accent
      : variant === 'danger'
        ? colors.hairlineStrong
        : variant === 'quiet' || variant === 'ghost'
          ? 'transparent'
          : colors.hairlineStrong
  const textColor =
    variant === 'primary'
      ? colors.onAccent
      : variant === 'danger'
        ? colors.inkStrong
        : variant === 'secondary'
          ? colors.ink
          : colors.inkMuted
  const pressedBackground =
    variant === 'primary' ? colors.accentDeep : variant === 'danger' ? colors.surface : colors.surfaceSunken

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      android_ripple={{ color: colors.accentWash }}
      style={({ pressed }) => [
        styles.base,
        small ? styles.small : null,
        full ? styles.full : null,
        variant === 'quiet' || variant === 'ghost' ? styles.ghost : null,
        {
          backgroundColor: pressed ? pressedBackground : background,
          borderColor: border,
          opacity: disabled ? 0.45 : 1,
        },
        pressed && (variant === 'primary' || variant === 'danger')
          ? { transform: [{ scale: 0.98 }] }
          : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' ? colors.onAccent : colors.ink} />
      ) : (
        <View style={styles.content}>
          {icon ? (
            <Icon
              name={icon}
              size={small ? 15 : 17}
              color={
                variant === 'primary'
                  ? colors.onAccent
                  : variant === 'danger'
                    ? colors.inkStrong
                    : variant === 'secondary'
                      ? colors.ink
                      : colors.inkMuted
              }
            />
          ) : null}
          <Text variant="button" style={{ color: textColor }} numberOfLines={1}>
            {children}
          </Text>
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.minTouch,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: { borderWidth: 0, paddingHorizontal: 10 },
  small: {
    minHeight: layout.minTouch,
    paddingHorizontal: space.md,
  },
  full: { alignSelf: 'stretch' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
})
