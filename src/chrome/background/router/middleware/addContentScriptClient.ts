import { metadata } from 'valibot'
import { trpc } from '../trpc'
import { logger } from 'utils/logger'

export const addContentScriptClientMiddleware = trpc.middleware(
  async (opts) => {
    return opts.next({
      ctx: {
        sendMessageToDapp: (tabId: number, data: any) => {
          logger
            .getSubLogger({ name: `response: ` })
            .debug({ data, metadata: { tabId } })
          return chrome.tabs.sendMessage(tabId, {
            type: 'sendMessageToDapp',
            data,
          })
        },
      },
    })
  },
)
