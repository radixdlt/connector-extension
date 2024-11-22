import type { ContentScriptClient } from './clients/content-script'
import type { GetOffscreenClient } from './clients/offscreen'
import type { OpenParingPopup } from '../../helpers/open-pairing-popup'
import { AppLogger } from 'utils/logger'
import type { HasConnections } from 'chrome/helpers/get-connections'

export const createBackgroundRouterContext =
  (dependencies: {
    contentScriptClient: ContentScriptClient
    getOffscreenClient: GetOffscreenClient
    openParingPopup: OpenParingPopup
    hasConnections: HasConnections
    logger: AppLogger
  }) =>
  async () =>
    dependencies

export type BackgroundRouterContext = ReturnType<
  Awaited<ReturnType<typeof createBackgroundRouterContext>>
>
