import type { ButtonHTMLAttributes } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName
  label: string
  badge?: boolean
}

/** 40px round icon control from the prototype, with an always-present label. */
export function IconButton({
  icon,
  label,
  badge = false,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  const classes = ['icon-btn', className].filter(Boolean).join(' ')
  return (
    <button type={type} className={classes} aria-label={label} title={label} {...rest}>
      <Icon name={icon} />
      {badge ? <span className="icon-btn__badge" aria-hidden="true" /> : null}
    </button>
  )
}
