import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Lets the stylesheet tests read the real CSS source through `?raw`.
    css: true,
    include: ['src/**/*.test.ts'],
    reporters: ['default'],
  },
})
