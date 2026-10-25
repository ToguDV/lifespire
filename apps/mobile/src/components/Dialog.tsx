import type { ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { fonts, radius, shadows, space } from '../theme/tokens'
import { Text } from './Text'

export function Dialog({
  visible,
  title,
  eyebrow,
  description,
  onClose,
  children,
  actions,
  dismissable = true,
}: {
  visible: boolean
  title: string
  eyebrow?: string
  description?: string
  onClose: () => void
  children?: ReactNode
  actions?: ReactNode
  dismissable?: boolean
}) {
  const { colors } = useTheme()
  const { width } = useWindowDimensions()
  const wide = width >= 480
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.scrim }]}
          onPress={dismissable ? onClose : undefined}
          accessibilityLabel="Close dialog"
        />
        <View
          style={[
            styles.card,
            shadows.float,
            {
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.hairlineStrong,
              padding: wide ? 22 : 18,
            },
          ]}
          accessibilityViewIsModal
          accessibilityRole="none"
        >
          <View style={[styles.head, { borderColor: colors.hairline }]}>
            <View style={styles.headText}>
              {eyebrow ? (
                <Text variant="micro" tone="muted">
                  {eyebrow.toUpperCase()}
                </Text>
              ) : null}
              <Text variant="headingLg" accessibilityRole="header" style={styles.title}>
                {title}
              </Text>
              {description ? (
                <Text variant="bodySm" tone="muted" style={styles.description}>
                  {description}
                </Text>
              ) : null}
            </View>
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
          {actions ? (
            <View style={[styles.actions, { borderColor: colors.hairline }]}>{actions}</View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.md,
  },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  card: {
    width: '100%',
    maxWidth: 470,
    maxHeight: '86%',
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headText: { flex: 1, minWidth: 0 },
  title: { marginTop: 4 },
  description: { marginTop: 5 },
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
  bodyScroll: { flexGrow: 0, flexShrink: 1 },
  body: { gap: space.md, paddingTop: 12 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexWrap: 'wrap',
  },
})
