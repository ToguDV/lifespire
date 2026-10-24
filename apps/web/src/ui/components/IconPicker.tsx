import { GOAL_ICON_IDS } from '../../domain/goalIcons'
import type { GoalIconId } from '../../domain/goalIcons'
import { GOAL_ICON_LABEL } from '../lib/format'
import { Icon } from './Icon'

export interface IconPickerProps {
  /** Shared radio name; keep it unique per form. */
  name: string
  value: GoalIconId
  onChange: (icon: GoalIconId) => void
  legend?: string
  /** Icons only, with the label kept for assistive technology. */
  compact?: boolean
  describedBy?: string
}

/**
 * Native radio group: arrows move the selection and each tile is a 44 px
 * target. The visible crest is decorative; the radio carries the label.
 */
export function IconPicker({
  name,
  value,
  onChange,
  legend = 'Icon',
  compact = false,
  describedBy,
}: IconPickerProps) {
  return (
    <fieldset
      className={compact ? 'icon-picker icon-picker--compact' : 'icon-picker'}
      aria-describedby={describedBy}
    >
      <legend className="field__label">{legend}</legend>
      <div className="icon-picker__grid">
        {GOAL_ICON_IDS.map((icon) => (
          <label className="icon-picker__tile" key={icon} title={GOAL_ICON_LABEL[icon]}>
            <input
              type="radio"
              name={name}
              value={icon}
              checked={value === icon}
              onChange={() => onChange(icon)}
            />
            <span className="icon-picker__face" aria-hidden="true">
              <Icon name={icon} />
            </span>
            {value === icon ? (
              <span className="icon-picker__selected" aria-hidden="true">
                <Icon name="check" />
              </span>
            ) : null}
            <span className={compact ? 'sr-only' : 'icon-picker__label'}>
              {GOAL_ICON_LABEL[icon]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
