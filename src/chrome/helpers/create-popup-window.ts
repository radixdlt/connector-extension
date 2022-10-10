import { config } from 'config'
import { ResultAsync } from 'neverthrow'

export const createPopupWindow = (pagePath: string, screenWidth: number) =>
  ResultAsync.fromPromise<chrome.windows.Window | undefined, Error>(
    new Promise((resolve) => {
      chrome.windows.create(
        {
          url: chrome.runtime.getURL(pagePath),
          type: 'popup',
          width: config.popup.width,
          height: config.popup.height,
          top: config.popup.offsetTop,
          left: screenWidth - config.popup.width,
        },
        resolve
      )
    }),
    (error) => error as Error
  )
