import { useState } from 'react'
import type { ReactNode } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import type { TextInputProps } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { fonts, radius, space } from '../theme/tokens'
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
  const { colors } = useTheme()
  return (
    <View style={styles.field}>
      <Text variant="caption" tone="muted" style={styles.label}>
        {label}
      </Text>
      {children}
      {error ? (
        <View style={styles.errorRow} accessibilityRole="alert">
          <View style={[styles.errorBadge, { borderColor: colors.inkStrong }]}>
            <Text style={[styles.errorMark, { color: colors.inkStrong }]}>!</Text>
          </View>
          <Text variant="caption" style={[styles.errorText, { color: colors.inkStrong }]}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="caption" tone="soft">
          {hint}
        </Text>
      ) : null}
    </View>
  )
}

export function Input({ style, onFocus, onBlur, ...rest }: TextInputProps) {
  const { colors } = useTheme()
  const [focused, setFocused] = useState(false)
  return (
    <TextInput
      {...rest}
      allowFontScaling
      maxFontSizeMultiplier={2}
      placeholderTextColor={colors.inkSoft}
      onFocus={(event) => {
        setFocused(true)
        onFocus?.(event)
      }}
      onBlur={(event) => {
        setFocused(false)
        onBlur?.(event)
      }}
      style={[
        styles.input,
        {
          backgroundColor: colors.surfaceRaised,
          borderColor: focused ? colors.accent : colors.hairlineStrong,
          color: colors.ink,
        },
        focused ? styles.inputFocused : null,
        style,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: {
    fontFamily: fonts.uiBold,
    letterSpacing: 0.72,
    textTransform: 'uppercase',
  },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  errorBadge: {
    width: 11,
    height: 11,
    marginTop: 3,
    borderWidth: 1,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorMark: { fontSize: 8, lineHeight: 9, fontFamily: fonts.uiBold },
  errorText: { flex: 1, fontFamily: fonts.uiBold, lineHeight: 18 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    fontFamily: fonts.ui,
    fontSize: 15,
    lineHeight: 22,
  },
  inputFocused: {
    shadowColor: '#4d6b5a',
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
  },
})
