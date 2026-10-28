/**
 * Semantic icon vocabulary shared by the web and native shells.
 *
 * The union type is derived from the runtime list, so the icon adapters and
 * the persisted goal ids cannot drift apart. Artwork stays platform-specific
 * (`lucide-react` on web, `lucide-react-native` on mobile).
 */
export const ICON_NAMES = [
  'spire',
  'map',
  'tent',
  'banner',
  'gem',
  'sun',
  'moon',
  'coin',
  'star',
  'chevron-right',
  'chevron-left',
  'arrow-left',
  'check',
  'lock',
  'scroll',
  'elite',
  'campfire',
  'chest',
  'crown',
  'compass',
  'quill',
  'flame',
  'feather',
  'lantern',
  'key',
  'cup',
  'ring',
  'pine',
  'plus',
  'edit',
  'archive',
  'settings',
  'book',
  'heart',
  'leaf',
  'brush',
  'dumbbell',
  'home',
  'wheel',
  'wallet',
  'briefcase',
  'users',
  'utensils',
  'smartphone',
  'laptop',
  'devices',
  'refresh',
  'trash',
] as const

export type IconName = (typeof ICON_NAMES)[number]
