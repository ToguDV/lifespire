import type { ReactNode } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import type { TextInputProps } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { radius, space } from '../theme/tokens'
import { Text } from './Text'

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string | null
  hint?: string
  children: ReactNode
}) {
  return (
    <View style={styles.field}>
      <Text variant="caption" tone={error ? 'danger' : 'muted'}>
        {label}
      </Text>
      {children}
      {error ? (
        <Text variant="caption" tone="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="soft">
          {hint}
        </Text>
      ) : null}
    </View>
  )
}

export function Input({ style, ...rest }: TextInputProps) {
  const { colors } = useTheme()
  return (
    <TextInput
      {...rest}
      allowFontScaling
      maxFontSizeMultiplier={2}
      placeholderTextColor={colors.inkSoft}
      style={[
        styles.input,
        {
          backgroundColor: colors.surface,
          borderColor: colors.hairline,
          color: colors.ink,
        },
        style,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  field: { gap: space.xs },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: 15,
  },
})
