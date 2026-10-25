import { contextBridge } from 'electron'

/**
 * Read-only bridge. The renderer is the unmodified web build, so nothing here
 * is required for the daily loop; it only lets the shell identify itself
 * without exposing Node or Electron internals.
 */
const bridge = Object.freeze({
  isDesktop: true as const,
  platform: process.platform,
})

contextBridge.exposeInMainWorld('lifespireDesktop', bridge)

export type LifespireDesktopBridge = typeof bridge
