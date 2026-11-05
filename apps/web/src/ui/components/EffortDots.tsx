import type { Effort } from '../../domain/types'

const LABELS: Record<Effort, string> = {
  light: 'Easy difficulty',
  medium: 'Standard difficulty',
  high: 'Hard difficulty',
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

/** Three-dot difficulty indicator used in quests and encounter details. */
export function EffortDots({ effort, label }: EffortDotsProps) {
  return (
    <div className="effort-dots" aria-label={label ?? LABELS[effort]}>
      {[1, 2, 3].map((step) => (
        <i key={step} className={step <= FILLED[effort] ? 'on' : undefined} aria-hidden="true" />
      ))}
    </div>
  )
}
