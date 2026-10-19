import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, mergeConfig } from 'vitest/config';

import base from '@lifespire/config/vitest';

export default mergeConfig(
  base,
  defineConfig({
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    test: {
      name: 'web',
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
  }),
);
