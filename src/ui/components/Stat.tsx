import type { ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'

export interface StatProps {
  value: ReactNode
  label: string
  progress?: number
}

/** Compact metric with an optional thin progress bar. */
export function Stat({ value, label, progress }: StatProps) {
  return (
    <div className="stat">
      <div className="stat__num">{value}</div>
      <div className="stat__label">{label}</div>
      {progress === undefined ? null : (
        <div className="stat__bar" aria-hidden="true">
          <span style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
    </div>
  )
}

export function StatStrip({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="stat-strip" role={label ? 'group' : undefined} aria-label={label}>
      {children}
    </div>
  )
}

export interface ResourceProps {
  icon: IconName
  value: ReactNode
  label: string
  className?: string
}

/** Topbar resource counter (gold, relics, etc.). */
export function Resource({ icon, value, label, className }: ResourceProps) {
  return (
    <span className={['resource', className].filter(Boolean).join(' ')} aria-label={label}>
      <Icon name={icon} />
      {value}
    </span>
  )
}

export interface LevelResourceProps {
  level: number
  xpIntoLevel: number
  xpToNext: number
}

/** Level counter with the mini XP track shown on desktop. */
export function LevelResource({ level, xpIntoLevel, xpToNext }: LevelResourceProps) {
  const total = Math.max(1, xpIntoLevel + xpToNext)
  const percent = (xpIntoLevel / total) * 100
  return (
    <span
      className="resource resource--level"
      aria-label={`Level ${level}, ${xpIntoLevel} of ${total} experience`}
    >
      <span className="level-num">Lv {level}</span>
      <span className="xp-mini" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </span>
    </span>
  )
}
