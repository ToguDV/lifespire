import type { HTMLAttributes, ReactNode } from 'react'

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  as?: 'section' | 'article' | 'div'
  pad?: boolean
  framed?: boolean
  children: ReactNode
}

/** Parchment panel used across every screen. */
export function Panel({
  as = 'section',
  pad = false,
  framed = false,
  className,
  children,
  ...rest
}: PanelProps) {
  const Tag = as
  const classes = ['panel', pad ? 'panel--pad' : '', framed ? 'framed' : '', className]
    .filter(Boolean)
    .join(' ')
  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  )
}

export interface PanelHeadProps {
  label: ReactNode
  aside?: ReactNode
  className?: string
}

export function PanelHead({ label, aside, className }: PanelHeadProps) {
  return (
    <div className={['panel__head', className].filter(Boolean).join(' ')}>
      <span className="micro">{label}</span>
      {aside}
    </div>
  )
}
