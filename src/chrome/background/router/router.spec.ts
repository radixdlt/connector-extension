import { backgroundRouter } from './router'
import { createChromeHandler } from 'trpc-chrome/adapter'
import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended'
import type { ContentScriptClient } from './clients/content-script'
import type { GetOffscreenClient } from './clients/offscreen'
import { describe, it, vi, expect, beforeEach, beforeAll } from 'vitest'
import { getBackgroundClient } from 'chrome/content-script/router/clients/background'
import { AppLogger } from 'utils/logger'
import { Logger } from 'tslog'
import { errAsync, okAsync } from 'neverthrow'

const MIN_LEVEL = { trace: 1, debug: 2, info: 3 } as const

const testLogger = new Logger({
  minLevel: MIN_LEVEL['debug'],
  prettyLogTemplate: '{{hh}}:{{MM}}:{{ss}}:{{ms}} {{name}}',
  prettyLogTimeZone: 'UTC',
})

const mockedOpenParingPopup = vi.fn()
const mockedHasConnections = vi.fn()

type MockContent = {
  contentScriptClient: DeepMockProxy<ContentScriptClient>
  getOffscreenClient: DeepMockProxy<GetOffscreenClient>
  openParingPopup: typeof mockedOpenParingPopup
  hasConnections: typeof mockedHasConnections
  logger: AppLogger
}

const createMockContext = (): MockContent => ({
  contentScriptClient: mockDeep<ContentScriptClient>(),
  getOffscreenClient: mockDeep<GetOffscreenClient>(),
  openParingPopup: mockedOpenParingPopup,
  hasConnections: mockedHasConnections,
  logger: testLogger,
})

const mockContent = createMockContext()

createChromeHandler({
  router: backgroundRouter,
  createContext: async () => mockContent,
})

let backgroundClient: Awaited<ReturnType<typeof getBackgroundClient>>

const TAB_ID = 1

describe('public router', () => {
  beforeAll(async () => {
    // @ts-expect-error:
    chrome.runtime.sendMessage.mockImplementationOnce(
      (message: any, callback: any) => {
        if (message.type === 'getTabId') callback(TAB_ID)
      },
    )

    backgroundClient = await getBackgroundClient()
  })

  it('should handle openPopup request', async () => {
    await backgroundClient('openPopup')({
      discriminator: 'openPopup',
    })

    expect(mockedOpenParingPopup).toHaveBeenCalledTimes(1)
  })

  it('should handle extensionStatus request', async () => {
    mockedHasConnections.mockImplementationOnce(() => errAsync(false))

    await backgroundClient('extensionStatus')({
      discriminator: 'extensionStatus',
    })

    expect(
      mockContent.contentScriptClient.sendMessageToDapp,
    ).toHaveBeenLastCalledWith(TAB_ID, {
      canHandleSessions: true,
      eventType: 'extensionStatus',
      isExtensionAvailable: true,
      isWalletLinked: false,
    })

    mockedHasConnections.mockImplementationOnce(() => okAsync(true))

    await backgroundClient('extensionStatus')({
      discriminator: 'extensionStatus',
    })

    expect(
      mockContent.contentScriptClient.sendMessageToDapp,
    ).toHaveBeenLastCalledWith(TAB_ID, {
      canHandleSessions: true,
      eventType: 'extensionStatus',
      isExtensionAvailable: true,
      isWalletLinked: true,
    })
  })
})
