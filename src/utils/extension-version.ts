import { config } from 'config'

/** The extension's version, as its manifest names it (the build's outside one). */
export const extensionVersion = () => {
  try {
    const manifest = chrome.runtime.getManifest()
    return manifest.version_name ?? manifest.version
  } catch (error) {
    return config.version
  }
}
