import { useEffect, useState } from 'react'
import { useAppStore } from '../../state/store'
import { Icon } from './Icon'

function useSystemDark(): boolean {
  const [dark, setDark] = useState(() =>
    typeof window === 'undefined'
      ? false
      : window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setDark(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return dark
}

/** Light/night switch from the prototype. It writes an explicit preference. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useAppStore((state) => state.document.settings.theme)
  const setTheme = useAppStore((state) => state.setTheme)
  const systemDark = useSystemDark()
  const dark = theme === 'dark' || (theme === 'system' && systemDark)

  return (
    <button
      className={['icon-btn', 'js-theme', className].filter(Boolean).join(' ')}
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? 'Day theme' : 'Night theme'}
      title={dark ? 'Switch to day' : 'Switch to night'}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      <Icon name="moon" className="theme-glyph theme-glyph--moon" />
      <Icon name="sun" className="theme-glyph theme-glyph--sun" />
    </button>
  )
}
