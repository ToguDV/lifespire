import { defineConfig } from 'vitest/config';

/**
 * Base Vitest configuration shared by every LifeSpire package.
 *
 * Packages extend it with `mergeConfig(baseConfig, defineConfig({ ... }))` so
 * that a package only has to declare what it changes (environment, setup files,
 * coverage thresholds, ...).
 */
export const baseConfig = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    passWithNoTests: true,
  },
});

export default baseConfig;
