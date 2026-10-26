import { StyleSheet, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { fonts, radius, space } from '../theme/tokens'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { Text } from './Text'

/**
 * Shared hero plate for the node detail and the wheel recap: concentric
 * rings, crest medallion, kicker, display title and one italic line.
 * Pixel values keep parity with the shipped node screen.
 */
export function HeroArt({
  icon,
  kicker,
  title,
  flavor,
}: {
  icon: IconName
  kicker: string
  title: string
  flavor?: string
}) {
  const { colors } = useTheme()
  return (
    <View style={[styles.art, { backgroundColor: colors.surfaceSunken, borderColor: colors.hairline }]}>
      <View style={styles.medallionStage}>
        <View style={[styles.ringOuter, { borderColor: colors.hairline }]} pointerEvents="none" />
        <View style={[styles.ringInner, { borderColor: colors.hairlineStrong }]} pointerEvents="none" />
        <View style={[styles.halo, { backgroundColor: colors.accentSoft }]} />
        <View style={[styles.medallion, { backgroundColor: colors.surfaceRaised, borderColor: colors.accent }]}>
          <Icon name={icon} size={34} color={colors.accentDeep} />
        </View>
      </View>
      <Text variant="micro" tone="muted" style={styles.kicker}>
        {kicker}
      </Text>
      <Text style={[styles.title, { color: colors.ink }]} accessibilityRole="header">
        {title}
      </Text>
      {flavor ? (
        <Text style={[styles.flavor, { color: colors.inkMuted }]}>{flavor}</Text>
      ) : null}
    </View>
  )
}

// 190/130/90/78 medallions, the 18px kicker offset and the 30px display
// title keep pixel parity with the web node art; no token covers them.
const styles = StyleSheet.create({
  art: {
    position: 'relative',
    alignItems: 'center',
    padding: space.xl,
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  medallionStage: {
    width: 190,
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: radius.full,
    borderWidth: 1,
    opacity: 0.8,
  },
  ringInner: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: radius.full,
    borderWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.65,
  },
  halo: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: radius.full,
  },
  medallion: {
    width: 78,
    height: 78,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: { marginTop: 18, textAlign: 'center' },
  title: {
    marginTop: 5,
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 33,
    textAlign: 'center',
  },
  flavor: {
    marginTop: 9,
    paddingHorizontal: space.xs,
    fontFamily: fonts.displayItalic,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
})
