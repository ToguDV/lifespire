import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import { colors } from '@lifespire/design-tokens/tokens';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg', 'icon-maskable.svg'],
      manifest: {
        name: 'LifeSpire',
        short_name: 'LifeSpire',
        description: 'Turn real-life tasks into a daily dungeon run.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: colors.bg,
        background_color: colors.bg,
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Workspace packages ship TypeScript source; do not pre-bundle them.
  optimizeDeps: {
    exclude: ['@lifespire/engine', '@lifespire/shared-types', '@lifespire/design-tokens'],
  },
  build: {
    target: 'es2022',
  },
});
