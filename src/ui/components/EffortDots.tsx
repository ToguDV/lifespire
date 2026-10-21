import type { Effort } from '../../domain/types'

const LABELS: Record<Effort, string> = {
  light: 'Light effort',
  medium: 'Medium effort',
  high: 'Heavy effort',
}

const FILLED: Record<Effort, number> = {
  light: 1,
  medium: 2,
  high: 3,
}

export interface EffortDotsProps {
  effort: Effort
  label?: string
}

/** Three-dot effort indicator used in aims and node details. */
export function EffortDots({ effort, label }: EffortDotsProps) {
  return (
    <div className="effort-dots" aria-label={label ?? LABELS[effort]}>
      {[1, 2, 3].map((step) => (
        <i key={step} className={step <= FILLED[effort] ? 'on' : undefined} aria-hidden="true" />
      ))}
    </div>
  )
}
