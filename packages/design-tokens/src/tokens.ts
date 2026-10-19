/**
 * LifeSpire visual tokens — single source of truth for the "ink & ember"
 * art direction (GDD §B6, ADR-011).
 *
 * Rule: no component hardcodes a color, font, radius or duration. Import them
 * from here (or from the Tailwind preset / CSS custom properties) instead.
 */

/** Core palette: 6 surfaces/typography tones + 6 accents. All `#RRGGBB`. */
export const colors = {
  bg: '#0B0D12',
  surface: '#141821',
  surface2: '#1C212C',
  border: '#2A3040',
  text: '#E8E4DA',
  muted: '#8B93A7',
  gold: '#E0A94A',
  xp: '#8FB6D9',
  danger: '#C2554F',
  success: '#6FA46A',
  rest: '#C97B4A',
  event: '#9B8CD6',
} as const;

/** Typography families. `ui` carries data (use `tabular-nums`); `display` is for headings. */
export const fonts = {
  ui: [
    'Inter',
    'system-ui',
    '-apple-system',
    'Segoe UI',
    'Roboto',
    'Helvetica',
    'Arial',
    'sans-serif',
  ],
  display: ['Fraunces', 'Iowan Old Style', 'Georgia', 'serif'],
} as const;

/** Corner radii. */
export const radii = {
  sm: '6px',
  md: '10px',
  lg: '16px',
} as const;

/** Motion durations (150–250 ms, ease-out). */
export const motion = {
  fast: '150ms',
  base: '200ms',
  slow: '250ms',
} as const;

/**
 * `prefers-reduced-motion: reduce` strips everything except cross-fades:
 * only opacity may animate, transform/position/scale movement is disabled.
 */
export const reducedMotion =
  'prefers-reduced-motion: reduce → allow opacity cross-fades only, no movement.';

/** The whole token set, for consumers that want everything at once. */
export const tokens = {
  colors,
  fonts,
  radii,
  motion,
} as const;

export type ColorToken = keyof typeof colors;
export type FontToken = keyof typeof fonts;
export type RadiusToken = keyof typeof radii;
export type MotionToken = keyof typeof motion;
export type Tokens = typeof tokens;

/** camelCase token key (`surface2`) → kebab CSS variable name (`--ls-surface-2`). */
export function cssVarName(token: ColorToken): string {
  const kebab = token
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([a-z])([0-9])/g, '$1-$2')
    .toLowerCase();
  return `--ls-${kebab}`;
}
