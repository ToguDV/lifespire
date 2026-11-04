#!/usr/bin/env node
/**
 * Minimal reader for the F-Droid `index-v2.json` used by the release script and
 * its test. fdroidserver writes each version as
 * { file, manifest: { versionCode, versionName } }; older indexes keep the
 * fields at the top level, so both shapes are accepted.
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export function versionEntries(index, packageName) {
  const versions = index?.packages?.[packageName]?.versions ?? {}
  return Array.isArray(versions) ? versions : Object.values(versions)
}

export function versionCodeOf(entry) {
  const code = Number(entry?.manifest?.versionCode ?? entry?.versionCode)
  return Number.isInteger(code) && code > 0 ? code : 0
}

export function highestVersionCode(index, packageName) {
  return Math.max(0, ...versionEntries(index, packageName).map(versionCodeOf))
}

export function hasVersionCode(index, packageName, versionCode) {
  return versionEntries(index, packageName).some(
    (entry) => versionCodeOf(entry) === Number(versionCode),
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, file, packageName, code] = process.argv.slice(2)
  if (!mode || !file || !packageName) {
    console.error('usage: fdroid-index.mjs highest|has <index.json> <package> [versionCode]')
    process.exit(2)
  }
  const index = JSON.parse(readFileSync(file, 'utf8'))
  if (mode === 'highest') {
    console.log(highestVersionCode(index, packageName))
  } else if (mode === 'has') {
    process.exit(hasVersionCode(index, packageName, Number(code)) ? 0 : 1)
  } else {
    console.error(`unknown mode: ${mode}`)
    process.exit(2)
  }
}
