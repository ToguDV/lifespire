import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // External /registerSW.js: the API CSP is script-src 'self' with no
      // inline allowance, so the PWA plugin must never inject an inline script.
      injectRegister: 'script',
      manifest: {
        name: 'LifeSpire — A Quiet Ascent',
        short_name: 'LifeSpire',
        description:
          'Turn your goals and routines into a seven-day path. Local-first, quiet, and kept in your browser.',
        lang: 'en',
        theme_color: '#131511',
        background_color: '#131511',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-192-maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Manifest icons and the webmanifest are added by the plugin itself;
        // keep them out of the glob so every precache URL appears once.
        globPatterns: ['**/*.{js,css,html,svg,woff2}', 'icons/apple-touch-icon.png'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
