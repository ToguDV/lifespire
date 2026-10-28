#!/usr/bin/env node
/**
 * Smoke-test the desktop shell without building an installer.
 *
 * Usage:
 *   pnpm try:desktop
 *
 * Starts the Vite dev server, waits for it, then opens the unpackaged
 * Electron shell against it. Ctrl+C stops both. Throwaway data goes through
 * LIFESPIRE_USER_DATA when set (see docs/DESKTOP.md); otherwise the shell
 * uses its normal profile, so this runs against your real local save.
 */
import { spawn } from 'node:child_process'

const WEB_URL = process.env.LIFESPIRE_DEV_URL ?? 'http://localhost:5173'
const children = new Set()

function run(label, cmd, args) {
  // New process group per child so shutdown kills the whole tree
  // (pnpm -> vite/tsc -> electron), not just the pnpm wrapper.
  const child = spawn(cmd, args, {
    stdio: 'inherit',
    shell: false,
    detached: process.platform !== 'win32',
  })
  children.add(child)
  child.on('exit', (code, signal) => {
    children.delete(child)
    if (label === 'electron') shutdown(code ?? (signal ? 1 : 0))
    else if (code !== 0 && code !== null) shutdown(code)
  })
  return child
}

function shutdown(code) {
  for (const child of children) {
    try {
      if (child.pid !== undefined && process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM')
      else child.kill('SIGTERM')
    } catch {
      // Already gone.
    }
  }
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

async function waitForWeb(tries = 240) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const response = await fetch(WEB_URL, { method: 'HEAD' })
      if (response.ok || response.status < 500) return
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  console.error(`try:desktop: web server never came up at ${WEB_URL}`)
  shutdown(1)
}

console.log(`try:desktop: starting web dev server (${WEB_URL})…`)
run('web', 'pnpm', ['--filter', '@lifespire/web', 'dev'])
await waitForWeb()
console.log('try:desktop: opening the Electron shell…')
run('electron', 'pnpm', ['--filter', '@lifespire/desktop', 'dev'])
