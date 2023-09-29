import { defineConfig, UserConfigExport } from 'vite'
import react from '@vitejs/plugin-react'
import { crx, defineManifest } from '@crxjs/vite-plugin'
import tsconfigPaths from 'vite-tsconfig-paths'
import packageJson from './package.json'

const { version } = packageJson

const isDevToolsActive = !!process.env.DEV_TOOLS
const versionName = process.env.GITHUB_REF_NAME || 'local'

// Convert from Semver (example: 0.1.0-beta6)
const [major, minor, patch] = version
  // can only contain digits, dots, or dash
  .replace(/[^\d.-]+/g, '')
  // split into version parts
  .split(/[.-]/)
  .filter(Boolean)

const manifest = defineManifest(async () => {
  const permissions: chrome.runtime.ManifestPermissions[] = [
    'storage',
    'tabs',
    'offscreen',
    'scripting',
    'notifications',
  ]
  const matches = [
    'https://*/*',
    'http://localhost:*/*',
    'http://127.0.0.1:*/*',
  ]

  if (isDevToolsActive) {
    permissions.push('contextMenus')
    matches.push('http://*/*')
  }

  return {
    manifest_version: 3,
    name: 'Radix Wallet Connector',
    version: `${major}.${minor}.${patch}`,
    description:
      'Link your Radix Wallet and allow it to interact with dApps running on the Radix network in your Chrome browser.',
    version_name: version === '0.0.0' ? versionName : version,
    action: {
      default_popup: 'src/pairing/index.html',
    },
    background: {
      service_worker: `src/chrome/background/background${
        isDevToolsActive ? '-with-dev-tools' : ''
      }.ts`,
      type: 'module',
    },
    content_scripts: [
      {
        matches,
        js: ['src/chrome/content-script/content-script.ts'],
        run_at: 'document_idle',
      },
    ],
    options_page: 'src/options/index.html',
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
  plugins: [react(), crx({ manifest }), tsconfigPaths()],
  resolve: {
    alias: {
      stream: 'vite-compatible-readable-stream',
    },
  },
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

export default defineConfig(buildConfig)
