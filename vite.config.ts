import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx, defineManifest } from '@crxjs/vite-plugin'
import tsconfigPaths from 'vite-tsconfig-paths'
import packageJson from './package.json'
const { version } = packageJson

// Convert from Semver (example: 0.1.0-beta6)
const [major, minor, patch, label = '0'] = version
  // can only contain digits, dots, or dash
  .replace(/[^\d.-]+/g, '')
  // split into version parts
  .split(/[.-]/)

const manifest = defineManifest(async (env) => ({
  manifest_version: 3,
  name: 'Radix Chrome Extension',
  version: `${major}.${minor}.${patch}.${label}`,
  version_name: version,
  description: 'Radix Babylon Browser Extension',
  action: { default_popup: 'index.html' },
  background: {
    service_worker: 'src/chrome/background.ts',
    type: 'module',
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
  ],
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
  },
}))

export default defineConfig({
  plugins: [react(), crx({ manifest }), tsconfigPaths()],
})
