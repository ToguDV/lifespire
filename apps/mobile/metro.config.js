const { getDefaultConfig } = require('expo/metro-config')

/**
 * Metro does not map TypeScript's `.js` import specifiers to `.ts` sources.
 * `@lifespire/core` (and `@lifespire/app-core`) deliberately use `.js`
 * specifiers so the CJS API build and Vite keep one source of truth.
 *
 * The default resolution runs first, so dependencies that ship real `.js`
 * files are untouched. Only when that fails do we retry a relative `.js`
 * request without the extension, which lets Metro find the `.ts` source.
 */
const config = getDefaultConfig(__dirname)

config.resolver.resolveRequest = (context, moduleName, platform) => {
  try {
    return context.resolveRequest(context, moduleName, platform)
  } catch (error) {
    const isRelative = moduleName.startsWith('./') || moduleName.startsWith('../')
    if (!isRelative || !moduleName.endsWith('.js')) throw error
    return context.resolveRequest(context, moduleName.slice(0, -3), platform)
  }
}

module.exports = config
