import type { ReactNode } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { fonts, radius, shadows, space } from '../theme/tokens'
import { Text } from './Text'

export function Dialog({
  visible,
  title,
  onClose,
  children,
  actions,
  dismissable = true,
}: {
  visible: boolean
  title: string
  onClose: () => void
  children?: ReactNode
  actions?: ReactNode
  dismissable?: boolean
}) {
  const { colors } = useTheme()
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.scrim }]}
          onPress={dismissable ? onClose : undefined}
          accessibilityLabel="Close dialog"
        />
        <View
          style={[
            styles.card,
            shadows.float,
            { backgroundColor: colors.surfaceRaised, borderColor: colors.hairlineStrong },
          ]}
          accessibilityViewIsModal
          accessibilityRole="none"
        >
          <View style={[styles.head, { borderColor: colors.hairline }]}>
            <Text variant="headingMd" accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close dialog"
              onPress={onClose}
              hitSlop={space.xs}
              android_ripple={{ color: colors.accentWash, borderless: true }}
              style={styles.close}
            >
              <Text style={[styles.closeGlyph, { color: colors.inkSoft }]}>×</Text>
            </Pressable>
          </View>
          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
          {actions ? <View style={[styles.actions, { borderColor: colors.hairline }]}>{actions}</View> : null}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    padding: space.lg,
  },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: space.lg,
    maxHeight: '86%',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
    paddingBottom: space.sm,
    borderBottomWidth: 1,
  },
  title: { flex: 1, marginTop: 4 },
  close: {
    width: 44,
    height: 44,
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  closeGlyph: { fontFamily: fonts.ui, fontSize: 22, lineHeight: 24 },
  bodyScroll: { marginTop: space.sm, flexGrow: 0 },
  body: { gap: space.md, paddingBottom: space.xs },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: space.xs,
    marginTop: 18,
    paddingTop: space.md,
    borderTopWidth: 1,
    flexWrap: 'wrap',
  },
})
