import type { AppLogger } from 'utils/logger'

export const createContentScriptClient = ({
  logger,
}: {
  logger: AppLogger
}) => {
  const sendMessageToDapp = (tabId: number, data: unknown) => {
    logger
      .getSubLogger({
        name: `router.sendMessageToDapp `,
      })
      .debug({ data, metadata: { tabId } })
    return chrome.tabs.sendMessage(tabId, {
      type: 'sendMessageToDapp',
      data,
    })
  }

  return { sendMessageToDapp }
}

export type ContentScriptClient = ReturnType<typeof createContentScriptClient>
