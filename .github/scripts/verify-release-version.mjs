#!/usr/bin/env node
// Fails the release when the pushed tag does not match the manifests that
// electron-builder reads, so an installer never carries the wrong version.
import { readFileSync } from 'node:fs'

const tag = process.env.GITHUB_REF_NAME ?? ''
const version = tag.replace(/^v/, '')

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Tag "${tag}" is not a semantic version (expected vMAJOR.MINOR.PATCH).`)
  process.exit(1)
}

const manifests = ['package.json', 'apps/desktop/package.json', 'apps/mobile/package.json']
let failed = false

for (const file of manifests) {
  const manifest = JSON.parse(readFileSync(file, 'utf8'))
  if (manifest.version !== version) {
    console.error(`${file}: version ${manifest.version} does not match tag ${version}`)
    failed = true
  }
}

if (failed) process.exit(1)
console.log(`Release version ${version} matches ${manifests.join(', ')}.`)
