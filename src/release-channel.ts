// Shared by the app (src/config.ts) and the build (vite.config.ts), which cannot use
// `import.meta.env`: keep this module free of imports.

/** Builds of `main` and `release/*` are the ones published to the Chrome Web Store. */
export const isPublicReleaseRef = (githubRefName: string) =>
  githubRefName === 'main' || githubRefName.includes('release/')

/**
 * Radix Connect over iroh is not offered in public releases (as in the Radix
 * Wallet's release builds): they always use WebRTC, keep the extension's original
 * CSP and do not ship the wasm module. Builds with dev tools and non-release builds
 * include it.
 */
export const includesIroh = (input: {
  githubRefName: string
  isDevMode: boolean
}) => !isPublicReleaseRef(input.githubRefName) || input.isDevMode
