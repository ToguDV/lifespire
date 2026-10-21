import type { Day } from '../../domain/types'

export interface ProgressProps {
  value: number
  max: number
  label: string
  showLabel?: boolean
  className?: string
}

function clampRatio(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0
  return Math.min(1, Math.max(0, value / max))
}

/** Thin progress bar used in rails and profile summaries. */
export function Progress({ value, max, label, showLabel = false, className }: ProgressProps) {
  const ratio = clampRatio(value, max)
  return (
    <div className={['progress', className].filter(Boolean).join(' ')}>
      <div
        className="progress__bar"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(value, max)}
      >
        <span style={{ width: `${ratio * 100}%` }} />
      </div>
      {showLabel ? (
        <span className="progress__label">
          {value} / {max}
        </span>
      ) : null}
    </div>
  )
}

export interface PipsProps {
  value: number
  max: number
  label?: string
  warm?: boolean
}

/** Vertical-attempt pips from the aims panels. */
export function Pips({ value, max, label, warm = false }: PipsProps) {
  const count = Math.max(0, Math.trunc(max))
  return (
    <div
      className="pips"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {Array.from({ length: count }, (_, index) => (
        <i
          key={index}
          className={[
            'pip',
            index < value ? 'pip--on' : '',
            index < value && warm ? 'pip--warm' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
      ))}
    </div>
  )
}

export interface DayPipsProps {
  days: readonly Day[]
  currentIndex?: number
  label?: string
}

/** Seven diamond pips reflecting the persisted day statuses. */
export function DayPips({ days, currentIndex, label }: DayPipsProps) {
  return (
    <div className="day-pips" role={label ? 'img' : undefined} aria-label={label}>
      {days.map((day) => {
        const state =
          day.status === 'completed'
            ? ' day-pip--done'
            : day.status === 'missed'
              ? ' day-pip--missed'
              : day.index === currentIndex ||
                  (currentIndex === undefined && (day.status === 'available' || day.status === 'in_progress'))
                ? ' day-pip--today'
                : ''
        return <span key={day.id} className={`day-pip${state}`} aria-hidden="true" />
      })}
    </div>
  )
}
