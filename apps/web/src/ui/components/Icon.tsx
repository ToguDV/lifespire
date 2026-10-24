import { ICON_MAP } from './iconMap'
import type { IconName } from './iconMap'

export type { IconName } from './iconMap'

export interface IconProps {
  name: IconName
  className?: string
  label?: string
}

/**
 * Semantic icon from the Lucide set. `spire` is the LifeSpire brand mark and
 * stays as a local path so the logo does not depend on the icon library.
 */
export function Icon({ name, className, label }: IconProps) {
  const classes = ['icon', className].filter(Boolean).join(' ')
  const a11y = label
    ? ({ role: 'img', 'aria-label': label } as const)
    : ({ 'aria-hidden': true } as const)

  if (name === 'spire') {
    return (
      <svg className={classes} viewBox="0 0 24 24" focusable="false" {...a11y}>
        <path d="M12 21V8.6" />
        <path d="M8.8 21h6.4" />
        <path d="M8.5 8.6 12 2.8l3.5 5.8" />
        <path d="M9.6 12.7h4.8M9.6 16.7h4.8" />
        <path d="M11 21v-2.4a1 1 0 0 1 2 0V21" />
      </svg>
    )
  }

  const Glyph = ICON_MAP[name]
  if (!Glyph) return null

  return <Glyph className={classes} strokeWidth={1.6} focusable="false" {...a11y} />
}
