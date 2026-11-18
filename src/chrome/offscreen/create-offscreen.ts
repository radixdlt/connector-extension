import { config } from 'config'
import type { AppLogger } from 'utils/logger'

let creating: Promise<void> | null

/**
 * Makes sure the offscreen document, which holds the wallet links, is running.
 * Resolves with `created` when it was not and a new one was created (every wallet
 * link is then reopened), `running` otherwise.
 */
export async function createOffscreen(
  logger?: AppLogger,
): Promise<'created' | 'running'> {
  const offscreenUrl = chrome.runtime.getURL(config.offscreen.url)

  // @ts-ignore: clients exists in service workers context
  const matchedClients = await clients.matchAll()

  for (const client of matchedClients) {
    if (client.url === offscreenUrl) {
      logger?.info('offscreen document already running')
      return 'running'
    }
  }

  if (await chrome.offscreen.hasDocument()) {
    logger?.info('offscreen document already running')
    return 'running'
  }

  if (creating) {
    await creating
    return 'created'
  }
  const startedAt = Date.now()
  try {
    creating = chrome.offscreen.createDocument({
      url: offscreenUrl,
      reasons: [chrome.offscreen.Reason.WEB_RTC],
      justification: 'Keep WebRTC connection with mobile wallet',
    })

    await creating
    creating = null
    logger?.info(
      'offscreen document created: it opens every wallet link again',
      { durationMs: Date.now() - startedAt },
    )
    return 'created'
  } catch (error) {
    creating = null
    // Only one offscreen document may exist: another call may have created it.
    logger?.info('creating the offscreen document failed, checking again', {
      message: (error as Error)?.message,
    })
    return createOffscreen(logger)
  }
}
