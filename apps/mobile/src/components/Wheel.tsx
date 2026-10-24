import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg'
import { WHEEL_SECTORS } from '@lifespire/core'
import type { WheelOutcome } from '@lifespire/core'
import {
  WHEEL_SPIN_TURNS,
  nextWheelRotation,
  wheelSectorCenter,
  wheelSectorDegrees,
} from '@lifespire/app-core/ui/wheel'
import { useTheme } from '../theme/ThemeProvider'
import { useReducedMotion } from '../theme/motion'

const SIZE = 240

function sectorPath(index: number, degrees: number): string {
  const start = ((index * degrees - 90) * Math.PI) / 180
  const end = (((index + 1) * degrees - 90) * Math.PI) / 180
  const cx = SIZE / 2
  const cy = SIZE / 2
  const r = SIZE / 2 - 6
  const x1 = cx + r * Math.cos(start)
  const y1 = cy + r * Math.sin(start)
  const x2 = cx + r * Math.cos(end)
  const y2 = cy + r * Math.sin(end)
  const large = degrees > 180 ? 1 : 0
  return `M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
}

const OUTCOME_LABEL: Record<WheelOutcome, string> = {
  task: 'Task',
  gold: 'Gold',
  xp: 'XP',
  rest: 'Rest',
}

export function Wheel({
  segmentIndex,
  onSettled,
  disabled = false,
  spinKey = 0,
}: {
  segmentIndex: number
  onSettled: () => void
  disabled?: boolean
  spinKey?: number
}) {
  const { colors } = useTheme()
  const reduced = useReducedMotion()
  const rotation = useRef(new Animated.Value(0)).current
  const settled = useRef(false)
  const onSettledRef = useRef(onSettled)
  useEffect(() => {
    onSettledRef.current = onSettled
  }, [onSettled])
  const sectorDegrees = wheelSectorDegrees()
  const colorFor = (outcome: WheelOutcome): string =>
    outcome === 'task'
      ? colors.wheelTask
      : outcome === 'gold'
        ? colors.wheelGold
        : outcome === 'xp'
          ? colors.wheelXp
          : colors.wheelRest

  useEffect(() => {
    settled.current = false
    rotation.setValue(0)
  }, [spinKey, rotation])

  useEffect(() => {
    if (disabled) return
    if (reduced) {
      settled.current = true
      onSettledRef.current()
      return
    }
    const target = nextWheelRotation(0, segmentIndex, WHEEL_SPIN_TURNS, sectorDegrees)
    const animation = Animated.timing(rotation, {
      toValue: target,
      duration: 2900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    })
    animation.start(({ finished }) => {
      if (finished && !settled.current) {
        settled.current = true
        onSettledRef.current()
      }
    })
    return () => animation.stop()
  }, [disabled, reduced, segmentIndex, rotation, sectorDegrees, spinKey])

  const rotate = rotation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  })

  return (
    <View style={styles.wrap} accessibilityLabel="Wheel of outcomes">
      <View style={[styles.pointer, { borderTopColor: colors.ink }]} />
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={SIZE / 2 - 3}
            fill={colors.surfaceRaised}
            stroke={colors.wheelStroke}
            strokeWidth={2}
          />
          <G>
            {WHEEL_SECTORS.map((outcome, index) => (
              <Path
                key={index}
                d={sectorPath(index, sectorDegrees)}
                fill={colorFor(outcome)}
                stroke={colors.surfaceRaised}
                strokeWidth={1}
              />
            ))}
          </G>
          <G>
            {WHEEL_SECTORS.map((outcome, index) => {
              const center = wheelSectorCenter(index, sectorDegrees)
              const radians = (center * Math.PI) / 180
              const r = SIZE / 2 - 34
              const x = SIZE / 2 + r * Math.cos(radians)
              const y = SIZE / 2 + r * Math.sin(radians)
              return (
                <SvgText
                  key={`label-${index}`}
                  x={x}
                  y={y + 4}
                  fill={colors.wheelIcon}
                  fontSize={10}
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {OUTCOME_LABEL[outcome]}
                </SvgText>
              )
            })}
          </G>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={26}
            fill={colors.surfaceRaised}
            stroke={colors.wheelStroke}
            strokeWidth={1.5}
          />
          <SvgText
            x={SIZE / 2}
            y={SIZE / 2 + 5}
            fill={colors.ink}
            fontSize={16}
            fontWeight="700"
            textAnchor="middle"
          >
            ?
          </SvgText>
        </Svg>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  pointer: {
    position: 'absolute',
    top: -8,
    zIndex: 2,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 18,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
})
