import { useEffect, useRef, useState } from 'react'
import { Animated, Easing } from 'react-native'
import type { TextStyle } from 'react-native'
import { useReducedMotion } from '../theme/motion'
import type { TextVariant } from '../theme/tokens'
import { Text } from './Text'

/** Counts up to the new value; reduced motion jumps straight to it. */
export function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  variant = 'bodySm',
  style,
  maxFontSizeMultiplier = 2,
}: {
  value: number
  prefix?: string
  suffix?: string
  variant?: TextVariant
  style?: TextStyle
  maxFontSizeMultiplier?: number
}) {
  const reduced = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const previous = useRef(value)
  const progress = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const from = previous.current
    previous.current = value
    if (reduced || from === value) {
      setDisplay(value)
      return
    }
    progress.setValue(0)
    const id = progress.addListener(({ value: t }) => {
      setDisplay(Math.round(from + (value - from) * t))
    })
    let mounted = true
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    })
    animation.start(() => {
      if (mounted) setDisplay(value)
    })
    return () => {
      mounted = false
      animation.stop()
      progress.removeListener(id)
    }
  }, [value, reduced, progress])

  return (
    <Text variant={variant} style={style} maxFontSizeMultiplier={maxFontSizeMultiplier}>
      {prefix}
      {display}
      {suffix}
    </Text>
  )
}
