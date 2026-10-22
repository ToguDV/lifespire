import type { ReactNode } from 'react'

export type IconName =
  | 'spire'
  | 'map'
  | 'tent'
  | 'banner'
  | 'gem'
  | 'sun'
  | 'moon'
  | 'coin'
  | 'star'
  | 'chevron-right'
  | 'chevron-left'
  | 'arrow-left'
  | 'check'
  | 'lock'
  | 'scroll'
  | 'elite'
  | 'campfire'
  | 'chest'
  | 'crown'
  | 'compass'
  | 'quill'
  | 'flame'
  | 'feather'
  | 'lantern'
  | 'key'
  | 'cup'
  | 'ring'
  | 'pine'
  | 'plus'
  | 'edit'
  | 'archive'
  | 'settings'
  | 'book'
  | 'heart'
  | 'leaf'
  | 'brush'
  | 'dumbbell'
  | 'home'

const ICON_SHAPES: Record<IconName, ReactNode> = {
  spire: (
    <>
      <path d="M12 21V8.6" />
      <path d="M8.8 21h6.4" />
      <path d="M8.5 8.6 12 2.8l3.5 5.8" />
      <path d="M9.6 12.7h4.8M9.6 16.7h4.8" />
      <path d="M11 21v-2.4a1 1 0 0 1 2 0V21" />
    </>
  ),
  map: (
    <>
      <path d="M4 6.2 9 4l6 2 5-2v13.8L15 20l-6-2-5 2z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  tent: (
    <>
      <path d="M4 20 12 5l8 15" />
      <path d="M9.5 20l2.5-5.6 2.5 5.6" />
      <path d="M3 20h18" />
    </>
  ),
  banner: (
    <>
      <path d="M6 21V3" />
      <path d="M6 5h11l-2 3.5L17 12H6" />
    </>
  ),
  gem: (
    <>
      <path d="M12 3 19 9l-7 12L5 9z" />
      <path d="M5 9h14M9 9l3 12M15 9l-3 12" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.4v2.1M12 19.5v2.1M2.4 12h2.1M19.5 12h2.1M5.2 5.2l1.5 1.5M17.3 17.3l1.5 1.5M18.8 5.2l-1.5 1.5M6.7 17.3l-1.5 1.5" />
    </>
  ),
  moon: <path d="M20 14.2A8.5 8.5 0 0 1 9.8 4 8.5 8.5 0 1 0 20 14.2z" />,
  coin: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5 14.1 12l-2.1 4.5L9.9 12z" />
    </>
  ),
  star: <path d="m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z" />,
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  'chevron-left': <path d="m15 6-6 6 6 6" />,
  'arrow-left': <path d="M19 12H5M11 6l-6 6 6 6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8.5 10V7a3.5 3.5 0 0 1 7 0v3" />
    </>
  ),
  scroll: (
    <>
      <path d="M6.5 6.5A2.5 2.5 0 0 1 9 4h8a1 1 0 0 1 1 1v13a2 2 0 0 0 2 2H9a2.5 2.5 0 0 1-2.5-2.5z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>
  ),
  elite: (
    <>
      <path d="m12 3 2.1 6.9L21 12l-6.9 2.1L12 21l-2.1-6.9L3 12l6.9-2.1z" />
      <path d="m12 8 .9 3.1L16 12l-3.1.9L12 16l-.9-3.1L8 12l3.1-.9z" />
    </>
  ),
  campfire: (
    <>
      <path d="M12 19c-2.6 0-4.3-1.7-4.3-4 0-2.1 1.6-3.4 2.6-5.4.2-.4.4-.9.5-1.5 1.2.9 1.9 2.1 2.1 3.4.8-.6 1.3-1.5 1.5-2.6 1.5 1.3 2.5 3.3 2.5 5.2 0 2.8-1.8 4.9-4.9 4.9z" />
      <path d="M6 20.2h12M7.2 18l11 2.2" />
    </>
  ),
  chest: (
    <>
      <path d="M4 10h16v9H4z" />
      <path d="M4 10c0-2.2 1.8-4 4-4h8c2.2 0 4 1.8 4 4" />
      <path d="M4 13.2h16M11 13.2v3h2v-3" />
    </>
  ),
  crown: (
    <>
      <path d="m4.5 8.5 3.7 7.5h7.6l3.7-7.5-4.6 3L12 5l-2.9 6.5z" />
      <path d="M6 19.5h12" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.5 8.5 13.4 14 8.5 16l2.1-5.5z" />
    </>
  ),
  quill: (
    <>
      <path d="m12 3 5.2 5.2-9 9L4 18.5l1.3-4.2z" />
      <path d="m12 3 5.2 5.2M8.3 13.4l2.3 2.3" />
    </>
  ),
  flame: (
    <path d="M12 21c-3.1 0-5.2-2-5.2-4.8 0-2.6 1.9-4.2 3.1-6.6.3-.5.5-1.1.6-1.8 1.4 1.1 2.2 2.5 2.4 4.1 1-.8 1.6-1.8 1.9-3.1 1.9 1.6 3 4 3 6.3C17.8 19 15.5 21 12 21z" />
  ),
  feather: (
    <>
      <path d="M5 19C5 11.5 10 5 19 4c0 9-6 14-14 15z" />
      <path d="m5 19 7.5-7.5" />
    </>
  ),
  lantern: (
    <>
      <path d="M9 3h6M10 3v2h4V3" />
      <path d="M7.5 8h9l-1 10.5h-7z" />
      <path d="M12 11c1 1.2 1.6 2.1 1.6 3.1a1.7 1.7 0 0 1-3.2 0c0-1 .5-2 1.6-3.1z" />
      <path d="M9 21h6" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="8" r="4" />
      <path d="m11 11 8 8M15.5 15.5l2.2-2.2M17.7 17.7l2.2-2.2" />
    </>
  ),
  cup: (
    <>
      <path d="M7 4h10l-1 6.4a4 4 0 0 1-8 0z" />
      <path d="M12 14.4V20M8.5 21h7" />
    </>
  ),
  ring: (
    <>
      <circle cx="12" cy="16" r="5" />
      <path d="m9 8 3-4 3 4-3 2z" />
    </>
  ),
  pine: <path d="M12 3 8 9h2l-4 6h5v6h2v-6h5l-4-6h2z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  edit: (
    <>
      <path d="m4 20 1-4L16 5l3 3L8 19z" />
      <path d="m14 7 3 3" />
    </>
  ),
  archive: (
    <>
      <rect x="4" y="5" width="16" height="4" rx="1" />
      <path d="M6 9v9.5h12V9" />
      <path d="M10 13h4" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.5C10.5 5 8.5 4.5 4.5 4.5v13c4 0 6 .5 7.5 2 1.5-1.5 3.5-2 7.5-2v-13c-4 0-6 .5-7.5 2z" />
      <path d="M12 6.5v13" />
    </>
  ),
  heart: (
    <path d="M12 20s-7-4.4-7-9.3A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7 3.7C19 15.6 12 20 12 20z" />
  ),
  leaf: (
    <>
      <path d="M20 4C10.5 4 4 9 4 16c0 2.6 1.4 4 4 4 7 0 12-6.5 12-16z" />
      <path d="M4 20c4.5-6 8.5-9.5 12-11.5" />
    </>
  ),
  brush: (
    <>
      <path d="m15.5 4.5 4 4L10 18H6v-4z" />
      <path d="m13.5 6.5 4 4" />
      <path d="M6 18c-1.6.5-2.2 1.6-2.2 3.2 1.6 0 2.7-.6 3.2-2.2" />
    </>
  ),
  dumbbell: (
    <>
      <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" />
    </>
  ),
  home: (
    <>
      <path d="m4 11 8-7 8 7" />
      <path d="M6 9.5V20h12V9.5" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
}

export function IconSprite() {
  return (
    <svg
      className="sprite"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      {(Object.keys(ICON_SHAPES) as IconName[]).map((name) => (
        <symbol key={name} id={`i-${name}`} viewBox="0 0 24 24">
          {ICON_SHAPES[name]}
        </symbol>
      ))}
    </svg>
  )
}

export interface IconProps {
  name: IconName
  className?: string
  label?: string
}

/** Inline icon from the ported design sprite. Decorative unless a label is given. */
export function Icon({ name, className, label }: IconProps) {
  const classes = ['icon', className].filter(Boolean).join(' ')
  return (
    <svg
      className={classes}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <use href={`#i-${name}`} />
    </svg>
  )
}
