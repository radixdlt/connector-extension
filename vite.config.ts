/// <reference types="vitest" />
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, UserConfigExport } from 'vite'
import react from '@vitejs/plugin-react'
import { crx, defineManifest } from '@crxjs/vite-plugin'
import tsconfigPaths from 'vite-tsconfig-paths'
import packageJson from './package.json'
import { includesIroh } from './src/release-channel'

const { version } = packageJson

const isDevToolsActive = process.env.VITE_DEV_TOOLS === 'true'
const versionName = process.env.GITHUB_REF_NAME || 'local'

// Same variables, and rule, as `isIrohAvailable` in src/config.ts.
const isIrohAvailableIn = (mode: string) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return includesIroh({
    githubRefName: env.VITE_GITHUB_REF_NAME || '',
    isDevMode: env.VITE_DEV_TOOLS === 'true',
  })
}

// Convert from Semver (example: 0.1.0-beta6)
const [major, minor, patch] = version
  // can only contain digits, dots, or dash
  .replace(/[^\d.-]+/g, '')
  // split into version parts
  .split(/[.-]/)
  .filter(Boolean)

const manifest = defineManifest(async ({ mode }) => {
  const permissions: chrome.runtime.ManifestPermissions[] = [
    'storage',
    'tabs',
    'offscreen',
    'scripting',
    'notifications',
    'contextMenus',
    'idle',
  ]
  const matches = ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*']

  if (isDevToolsActive) {
    matches.push('http://*/*')
  }

  return {
    manifest_version: 3,
    name: 'Radix Wallet Connector',
    version: `${major}.${minor}.${patch}`,
    description:
      'Only used with the Radix Wallet mobile app. Link Wallet Connector to your wallet to use dApps in Chrome, or use Ledger devices.',
    version_name: version === '0.0.0' ? versionName : version,
    action: {
      default_popup: 'src/pairing/index.html',
    },
    background: {
      service_worker: `src/chrome/background/background.ts`,
      type: 'module',
    },
    content_scripts: [
      {
        matches,
        js: ['src/chrome/content-script/content-script.ts'],
        run_at: 'document_idle',
        all_frames: true,
      },
    ],
    options_page: 'src/options/index.html',
    // Radix Connect over iroh (@genkipool/radix-connect-iroh) runs as WebAssembly in
    // the offscreen document and the pairing popup. Without a declared policy Chrome
    // uses "script-src 'self'; object-src 'self';", which disables WebAssembly.
    // 'wasm-unsafe-eval' only allows compiling WebAssembly: eval(), new Function()
    // and inline scripts stay blocked, and code still loads only from the extension
    // itself. This is Chrome's minimum policy for extension pages; content scripts
    // are not affected. Public releases do not include iroh and keep the default.
    ...(isIrohAvailableIn(mode)
      ? {
          content_security_policy: {
            extension_pages:
              "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
          },
        }
      : {}),
    host_permissions: matches,
    permissions,
    icons: {
      '16': 'radix-icon_16x16.png',
      '48': 'radix-icon_48x48.png',
      '128': 'radix-icon_128x128.png',
    },
  }
})

const buildConfig: UserConfigExport = {
  plugins: [
    // Fast refresh needs the dev server's preamble, which tests do not have.
    react({ fastRefresh: process.env.VITEST !== 'true' }),
    crx({ manifest }),
    tsconfigPaths(),
  ],
  build: {
    sourcemap: isDevToolsActive ? 'inline' : false,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
          return
        }
        warn(warning)
      },
      input: {
        options: 'src/options/index.html',
        ledger: 'src/ledger/index.html',
        pairing: 'src/pairing/index.html',
        devTools: 'src/chrome/dev-tools/dev-tools.html',
        offscreen: 'src/chrome/offscreen/index.html',
      },
    },
  },
}

if (!isDevToolsActive) {
  delete buildConfig.build.rollupOptions.input['devTools']
}

export default defineConfig(({ mode }) => ({
  ...buildConfig,
  resolve: {
    alias: [
      { find: 'stream', replacement: 'vite-compatible-readable-stream' },
      // Builds without iroh never load it: bundle a stub instead of the package,
      // so that they do not ship the wasm module.
      ...(isIrohAvailableIn(mode)
        ? []
        : [
            {
              find: /^@genkipool\/radix-connect-iroh(\/.*)?$/,
              replacement: fileURLToPath(
                new URL(
                  './src/chrome/offscreen/wallet-connection/transport/iroh/iroh-excluded.ts',
                  import.meta.url,
                ),
              ),
            },
          ]),
    ],
  },
  // @ts-expect-error
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setup-tests.ts',
    reporters: ['default'],
    coverage: {
      reportsDirectory: './coverage',
      provider: 'v8',
      reporter: ['json', 'text', 'lcov', 'clover'],
      include: ['src/**/*'],
    },
  },
}))
