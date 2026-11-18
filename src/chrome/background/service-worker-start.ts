import { sessionStore } from 'chrome/helpers/storage'
import type { AppLogger } from 'utils/logger'

/**
 * Chrome stops an idle service worker and starts it again on the next event: each
 * start runs this file. Counted per browser session (session storage), so that
 * exported logs show restarts. The offscreen document, and the wallet links in it,
 * normally keep running meanwhile.
 */
export const logServiceWorkerStart = (logger: AppLogger) => {
  const startedAt = Date.now()
  return sessionStore
    .getMany(['serviceWorkerStarts', 'serviceWorkerStartedAt'])
    .andThen(({ serviceWorkerStarts = 0, serviceWorkerStartedAt }) => {
      const starts = Number(serviceWorkerStarts) + 1
      return sessionStore
        .setMany({
          serviceWorkerStarts: starts,
          serviceWorkerStartedAt: startedAt,
        })
        .map(() =>
          logger.info('service worker started', {
            start: starts,
            ...(typeof serviceWorkerStartedAt === 'number'
              ? { sincePreviousStartMs: startedAt - serviceWorkerStartedAt }
              : {}),
          }),
        )
    })
    .mapErr(() => logger.info('service worker started'))
}
