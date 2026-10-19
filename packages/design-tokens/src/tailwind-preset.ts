import { colors, fonts, motion, radii } from './tokens';

/**
 * Tailwind preset fed by the LifeSpire design tokens.
 *
 * Web/desktop extend their Tailwind config with this preset instead of
 * re-declaring colors, fonts, radii or durations (no hardcoded values).
 */
export const tailwindPreset = {
  theme: {
    extend: {
      colors: {
        bg: colors.bg,
        surface: colors.surface,
        'surface-2': colors.surface2,
        border: colors.border,
        text: colors.text,
        muted: colors.muted,
        gold: colors.gold,
        xp: colors.xp,
        danger: colors.danger,
        success: colors.success,
        rest: colors.rest,
        event: colors.event,
      },
      fontFamily: {
        ui: [...fonts.ui],
        display: [...fonts.display],
      },
      borderRadius: {
        sm: radii.sm,
        md: radii.md,
        lg: radii.lg,
      },
      transitionDuration: {
        fast: motion.fast,
        base: motion.base,
        slow: motion.slow,
      },
    },
  },
};

export default tailwindPreset;
