import type { ReactNode } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { radius, shadows, space } from '../theme/tokens'
import { IconButton } from './IconButton'
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
            { backgroundColor: colors.surfaceRaised, borderColor: colors.hairline },
          ]}
          accessibilityViewIsModal
          accessibilityRole="none"
        >
          <View style={styles.head}>
            <Text variant="headingMd" accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <IconButton icon="arrow-left" label="Close" onPress={onClose} size={36} />
          </View>
          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
          {actions ? <View style={styles.actions}>{actions}</View> : null}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  title: { flex: 1 },
  bodyScroll: { marginTop: space.md, flexGrow: 0 },
  body: { gap: space.md, paddingBottom: space.xs },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: space.sm,
    marginTop: space.lg,
    flexWrap: 'wrap',
  },
})
