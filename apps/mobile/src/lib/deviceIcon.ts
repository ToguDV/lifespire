import type { DevicePlatform } from '@lifespire/app-core/sync/protocol'
import type { IconName } from '../components/Icon'

/**
 * Device-type artwork for the sync UI. Unknown (older peers that predate the
 * platform advertisement) gets the neutral combined icon, never a guess.
 */
export function platformIcon(platform?: DevicePlatform): IconName {
  if (platform === 'android') return 'smartphone'
  if (platform === 'desktop') return 'laptop'
  return 'devices'
}
