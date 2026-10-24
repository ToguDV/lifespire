import { Icon } from './Icon'
import type { IconName } from './Icon'
import { Pips } from './Progress'

export interface AimRowProps {
  title: string
  progress: number
  target: number
  icon?: IconName
}

/** Weekly goal row shared by camp, map, summaries and profiles. */
export function AimRow({ title, progress, target, icon = 'banner' }: AimRowProps) {
  return (
    <div className="aim-row">
      <span className="aim-row__icon">
        <Icon name={icon} />
      </span>
      <div className="aim-row__body">
        <div className="aim-row__name">
          <span>{title}</span>
          <span className="aim-row__count">
            {Math.min(progress, target)} / {target}
          </span>
        </div>
        <Pips value={progress} max={target} />
      </div>
    </div>
  )
}
