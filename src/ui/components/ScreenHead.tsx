import type { ReactNode } from 'react'

export interface ScreenHeadProps {
  kicker?: ReactNode
  title: ReactNode
  titleId?: string
  sub?: ReactNode
  meta?: ReactNode
  className?: string
}

/** Shared screen heading: kicker, display title, optional lede and right meta. */
export function ScreenHead({
  kicker,
  title,
  titleId,
  sub,
  meta,
  className,
}: ScreenHeadProps) {
  return (
    <header className={['screen-head', className].filter(Boolean).join(' ')}>
      <div className="screen-head__copy">
        {kicker ? <span className="kicker">{kicker}</span> : null}
        <h1 id={titleId}>{title}</h1>
        {sub ? <p className="screen-head__sub">{sub}</p> : null}
      </div>
      {meta ? <div className="screen-head__meta">{meta}</div> : null}
    </header>
  )
}
