import { defineConfig, UserConfigExport } from 'vite'
import react from '@vitejs/plugin-react'
import { crx, defineManifest } from '@crxjs/vite-plugin'
import tsconfigPaths from 'vite-tsconfig-paths'
import packageJson from './package.json'
const { version } = packageJson

const isDevToolsActive = !!process.env.DEV_TOOLS

// Convert from Semver (example: 0.1.0-beta6)
const [major, minor, patch, label = '0'] = version
  // can only contain digits, dots, or dash
  .replace(/[^\d.-]+/g, '')
  // split into version parts
  .split(/[.-]/)

const manifest = defineManifest(async () => {
  const permissions = ['storage', 'tabs']
  const matches = ['https://*/*']

  if (isDevToolsActive) {
    matches.push('http://*/*')
  }

  return {
    manifest_version: 3,
    name: 'Radix Wallet Connector',
    version: `${major}.${minor}.${patch}.${label}`,
    version_name: version,
    action: {
      default_popup: 'src/pairing/index.html',
    },
    background: {
      service_worker: `src/chrome/background.ts`,
      type: 'module',
    },
    content_scripts: [
      {
        matches,
        js: ['src/chrome/content.ts'],
        run_at: 'document_start',
      },
    ],
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
  build: {
    rollupOptions: {
      input: {
        pairing: 'src/pairing/index.html',
      },
    },
  },
}

export default defineConfig(buildConfig)
