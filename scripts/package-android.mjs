#!/usr/bin/env node
/**
 * Builds an installable Android APK on EAS cloud without cutting a release.
 *
 * Usage:
 *   pnpm package:android            # preview profile -> apps/mobile/release/*.apk
 *   EXPO_TOKEN=... pnpm package:android
 *
 * The release workflow (`release.yml`) runs the same `preview` profile on a
 * `v*` tag; this script runs only the build+download part, with no tag and
 * no GitHub release. Auth comes from `EXPO_TOKEN` or a prior `eas login`.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const mobileDir = path.join(root, 'apps', 'mobile')

function fail(message) {
  console.error(`package:android: ${message}`)
  process.exit(1)
}

function run(cmd, args, options = {}) {
  return execFileSync(cmd, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    ...options,
  })
}

// The project must be linked (extra.eas.projectId) before EAS accepts builds.
const configSource = fs.readFileSync(path.join(mobileDir, 'app.config.ts'), 'utf8')
if (!/projectId:\s*'[^']+'/.test(configSource)) {
  fail('the Expo project is not linked. Run `eas init` in apps/mobile first.')
}

// Auth: EXPO_TOKEN or an existing eas login session.
if (!process.env.EXPO_TOKEN) {
  try {
    run('npx', ['--yes', 'eas-cli@^16', 'whoami', '--non-interactive'], { cwd: mobileDir })
  } catch {
    fail('not logged in to Expo. Run `eas login` in apps/mobile or set EXPO_TOKEN.')
  }
}

const version = JSON.parse(
  fs.readFileSync(path.join(mobileDir, 'package.json'), 'utf8'),
).version
const outDir = path.join(mobileDir, 'release')
fs.mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, `LifeSpire-${version}.apk`)

console.log('package:android: starting EAS preview build (apk)…')
const raw = run(
  'npx',
  [
    '--yes',
    'eas-cli@^16',
    'build',
    '--platform',
    'android',
    '--profile',
    'preview',
    '--non-interactive',
    '--wait',
    '--json',
  ],
  { cwd: mobileDir, env: process.env },
)

let builds
try {
  builds = JSON.parse(raw)
} catch {
  fail('EAS did not return JSON. See the output above.')
}
const url = Array.isArray(builds) ? builds.at(-1)?.artifacts?.buildUrl : undefined
if (!url) fail(`EAS did not return a buildUrl: ${raw.slice(0, 500)}`)

console.log(`package:android: downloading to ${path.relative(root, outFile)}…`)
run('curl', ['--fail', '--location', url, '--output', outFile])
const size = (fs.statSync(outFile).size / 1024 / 1024).toFixed(1)
console.log(`package:android: done (${size} MB): ${path.relative(root, outFile)}`)
