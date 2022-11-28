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
  const permissions = ['storage', 'tabs', 'system.display']
  const matches = ['https://*/*']

  if (isDevToolsActive) {
    permissions.push('contextMenus')
    matches.push('http://*/*')
  }

  return {
    manifest_version: 3,
    name: 'Radix Connect',
    version: `${major}.${minor}.${patch}.${label}`,
    version_name: version,
    action: {},
    background: {
      service_worker: `src/chrome/background${
        isDevToolsActive ? '-with-dev-tools' : ''
      }.ts`,
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

if (isDevToolsActive) {
  buildConfig.build.rollupOptions.input['devTools'] =
    'src/chrome/dev-tools/dev-tools.html'
}

export default defineConfig(buildConfig)
