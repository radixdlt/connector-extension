#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const distDir = path.resolve(__dirname, '..', 'dist')
const manifestPath = path.join(distDir, 'manifest.json')

if (!fs.existsSync(manifestPath)) {
  console.error('manifest.json not found in dist directory')
  process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

if (manifest.background && manifest.background.service_worker) {
  const swPath = manifest.background.service_worker
  delete manifest.background.service_worker
  manifest.background.scripts = [swPath]
  console.log(`Patched background.service_worker -> background.scripts: [${swPath}]`)
}

const SW_LOADER = 'service-worker-loader.js'
const swLoaderPath = path.join(distDir, SW_LOADER)
if (fs.existsSync(swLoaderPath)) {
  let content = fs.readFileSync(swLoaderPath, 'utf8')
  content = content.replace(
    /navigator\.serviceWorker\.register\s*\(/g,
    '// Firefox: navigator.serviceWorker.register is not supported; script loaded via manifest\nvoid ('
  )
  fs.writeFileSync(swLoaderPath, content, 'utf8')
  console.log('Patched service-worker-loader.js for Firefox compatibility')
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
console.log('Firefox manifest patched successfully')
