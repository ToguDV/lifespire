import type { IconName } from '@lifespire/app-core/ui/icons'
import Svg, { Path } from 'react-native-svg'
import { useTheme } from '../theme/ThemeProvider'
import { ICON_MAP } from './iconMap'

export type { IconName }

function SpireMark({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21V8.6" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8.8 21h6.4" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8.5 8.6 12 2.8l3.5 5.8" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M9.6 12.7h4.8M9.6 16.7h4.8"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M11 21v-2.4a1 1 0 0 1 2 0V21"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function Icon({
  name,
  size = 20,
  color,
  strokeWidth = 1.6,
}: {
  name: IconName
  size?: number
  color?: string
  strokeWidth?: number
}) {
  const { colors } = useTheme()
  const tint = color ?? colors.inkMuted
  const Component = ICON_MAP[name]
  if (!Component) return <SpireMark size={size} color={color ?? colors.ink} />
  return <Component size={size} color={tint} strokeWidth={strokeWidth} />
}
