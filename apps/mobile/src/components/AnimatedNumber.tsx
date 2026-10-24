import { useEffect, useRef, useState } from 'react'
import { Animated, Easing } from 'react-native'
import { useReducedMotion } from '../theme/motion'
import { Text } from './Text'

/** Counts up to the new value; reduced motion jumps straight to it. */
export function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  variant = 'bodySm',
}: {
  value: number
  prefix?: string
  suffix?: string
  variant?: 'bodySm' | 'headingMd' | 'bodyMd'
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
    Animated.timing(progress, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => setDisplay(value))
    return () => {
      progress.removeListener(id)
    }
  }, [value, reduced, progress])

  return (
    <Text variant={variant}>
      {prefix}
      {display}
      {suffix}
    </Text>
  )
}
