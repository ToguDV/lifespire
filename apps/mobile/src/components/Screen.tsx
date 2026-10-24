import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../theme/ThemeProvider'
import { layout, space } from '../theme/tokens'

export function Screen({
  children,
  scroll = true,
  style,
  contentStyle,
  bottomInset = true,
}: {
  children: ReactNode
  scroll?: boolean
  style?: StyleProp<ViewStyle>
  contentStyle?: StyleProp<ViewStyle>
  bottomInset?: boolean
}) {
  const { colors } = useTheme()
  const paddingBottom = bottomInset ? layout.tabbarHeight + space.xxl : space.xxl

  if (!scroll) {
    return (
      <SafeAreaView edges={[]} style={[styles.root, { backgroundColor: colors.background }, style]}>
        <View style={[styles.content, { paddingBottom }, contentStyle]}>{children}</View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView edges={[]} style={[styles.root, { backgroundColor: colors.background }, style]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom }, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: space.md,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    gap: space.md,
  },
})
