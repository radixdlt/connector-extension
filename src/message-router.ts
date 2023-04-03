import { errAsync, ResultAsync } from 'neverthrow'
import { Logger } from 'tslog'
import { logger as utilLogger } from 'utils/logger'

export type MessageRouterOptions = {
  logger?: Logger<unknown>
}

export const MessagesRouter = ({
  logger = utilLogger,
}: MessageRouterOptions = {}) => {
  const store = new Map<string, number>()

  const add = (tabId: number, interactionId: string) => {
    logger.debug('Storing data in messages router', { interactionId, tabId })
    store.set(interactionId, tabId)
  }

  const send = (message: { interactionId: string }) => {
    const tabId = store.get(message.interactionId)
    if (!tabId) {
      return errAsync(new Error('No tab matching interactionId found'))
    }

    return ResultAsync.fromPromise(
      chrome.tabs.get(tabId),
      (err) => err
    ).andThen((tab) => {
      if (tab) {
        return ResultAsync.fromPromise(
          new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, message, (response) => {
              if (response) {
                logger.debug(
                  'Message received by tab',
                  tabId,
                  message.interactionId
                )
                store.delete(message.interactionId)
                return resolve(undefined)
              }
            })
          }),
          (err) => err
        )
      } else {
        return errAsync(new Error('No tab found'))
      }
    })
  }

  return {
    add,
    send,
  }
}
