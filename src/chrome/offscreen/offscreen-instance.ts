import { config } from 'config'
import type { OffscreenDiagnostics } from './wallet-connection/transport/diagnostics'

/**
 * This offscreen document: a random id and when it started. A new id in the logs or
 * the diagnostics means the document was restarted, which reopened every wallet
 * link (and lost the logs kept by the previous one).
 */
const instance = {
  id: (crypto.randomUUID?.() ?? Math.random().toString(16).slice(2)).slice(
    0,
    8,
  ),
  startedAt: Date.now(),
}

export const offscreenInstance = (now = Date.now()): OffscreenDiagnostics => ({
  instance: instance.id,
  build: config.buildId,
  uptimeMs: now - instance.startedAt,
})
