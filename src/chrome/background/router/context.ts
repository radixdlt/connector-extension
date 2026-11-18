import type { ContentScriptClient } from './clients/content-script'
import type { OpenParingPopup } from '../../helpers/open-pairing-popup'
import type { AppLogger } from 'utils/logger'
import type { HasConnections } from 'chrome/helpers/get-connections'

export const createBackgroundRouterContext =
  (dependencies: {
    contentScriptClient: ContentScriptClient
    openParingPopup: OpenParingPopup
    hasConnections: HasConnections
    logger: AppLogger
  }) =>
  async () =>
    dependencies

export type BackgroundRouterContext = ReturnType<
  Awaited<ReturnType<typeof createBackgroundRouterContext>>
>
