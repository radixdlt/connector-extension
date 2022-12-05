import { config } from 'config'
import { ResultAsync } from 'neverthrow'

export const createPopupWindow = (
  pagePath: string,
  {
    left = 0,
    width,
    height,
    top = 0,
  }: Partial<{ left: number; top: number; height: number; width: number }>
) =>
  ResultAsync.fromPromise<chrome.windows.Window | undefined, Error>(
    new Promise((resolve) => {
      chrome.windows.create(
        {
          url: chrome.runtime.getURL(pagePath),
          type: 'popup',
          width: config.popup.width,
          height: config.popup.height,
          top: height !== undefined ? top + config.popup.offsetTop : undefined,
          left:
            width !== undefined ? width + left - config.popup.width : undefined,
        },
        resolve
      )
    }),
    (error) => error as Error
  )
