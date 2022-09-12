import { defineConfig, UserConfigExport } from 'vite'
import react from '@vitejs/plugin-react'
import { crx, defineManifest } from '@crxjs/vite-plugin'
import tsconfigPaths from 'vite-tsconfig-paths'
import packageJson from './package.json'
const { version } = packageJson

const isDevToolsActive = process.env.DEV_TOOLS === 'true'

// Convert from Semver (example: 0.1.0-beta6)
const [major, minor, patch, label = '0'] = version
  // can only contain digits, dots, or dash
  .replace(/[^\d.-]+/g, '')
  // split into version parts
  .split(/[.-]/)

const manifest = defineManifest(async () => ({
  manifest_version: 3,
  name: 'Radix Connector Extension',
  version: `${major}.${minor}.${patch}.${label}`,
  version_name: version,
  action: { default_popup: 'index.html' },
  background: {
    service_worker: `src/chrome/background${
      isDevToolsActive ? '-with-dev-tools' : ''
    }.ts`,
    type: 'module',
  },
  options_ui: {
    page: 'src/chrome/setup/setup.html',
    open_in_tab: true,
  },
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['src/chrome/content.ts'],
      run_at: 'document_start',
    },
  ],
  permissions: [
    'activeTab',
    'scripting',
    'storage',
    'tabs',
    'unlimitedStorage',
    'contextMenus',
  ],
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
  },
}))

const buildConfig: UserConfigExport = {
  plugins: [react(), crx({ manifest }), tsconfigPaths()],
  build: {
    rollupOptions: {
      input: {
        devTools: 'src/chrome/dev-tools/dev-tools.html',
      },
    },
  },
}

if (!isDevToolsActive) {
  delete buildConfig['build']
}

export default defineConfig(buildConfig)
