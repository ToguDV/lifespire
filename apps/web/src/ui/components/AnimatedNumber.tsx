import { useCountUp } from '../lib/countUp'

export interface AnimatedNumberProps {
  value: number
  durationMs?: number
  prefix?: string
  suffix?: string
  className?: string
}

/** Counter that ticks up to its target instead of jumping. Calm 600ms ease-out. */
export function AnimatedNumber({
  value,
  durationMs = 600,
  prefix = '',
  suffix = '',
  className,
}: AnimatedNumberProps) {
  const display = useCountUp(value, durationMs)
  return (
    <span className={className} data-animated-number={display}>
      {prefix}
      {display}
      {suffix}
    </span>
  )
}
