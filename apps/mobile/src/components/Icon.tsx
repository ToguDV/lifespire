import type { IconName } from '@lifespire/app-core/ui/icons'
import Svg, { Path } from 'react-native-svg'
import { useTheme } from '../theme/ThemeProvider'
import { ICON_MAP } from './iconMap'

export type { IconName }

function SpireMark({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.5 16.5 9v3.5L12 21.5 7.5 12.5V9L12 2.5Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path d="M12 7.5v9M9.5 12.5h5" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  )
}

export function Icon({
  name,
  size = 20,
  color,
  strokeWidth = 1.7,
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
