import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { layout, radius, space } from '../theme/tokens'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { Text } from './Text'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'

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
  style,
}: ButtonProps) {
  const { colors } = useTheme()
  const background =
    variant === 'primary'
      ? colors.ink
      : variant === 'danger'
        ? colors.danger
        : variant === 'secondary'
          ? colors.surface
          : 'transparent'
  const border =
    variant === 'primary'
      ? colors.ink
      : variant === 'danger'
        ? colors.danger
        : variant === 'secondary'
          ? colors.hairline
          : 'transparent'
  const textTone =
    variant === 'primary' || variant === 'danger'
      ? 'inverse'
      : variant === 'quiet'
        ? 'muted'
        : 'default'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      android_ripple={{ color: colors.accentWash }}
      style={({ pressed }) => [
        styles.base,
        small ? styles.small : null,
        full ? styles.full : null,
        {
          backgroundColor: background,
          borderColor: border,
          opacity: disabled ? 0.45 : pressed ? 0.82 : 1,
        },
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
                variant === 'primary' || variant === 'danger' ? colors.onAccent : colors.inkMuted
              }
            />
          ) : null}
          <Text variant="button" tone={textTone} numberOfLines={1}>
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
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: {
    minHeight: 38,
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
