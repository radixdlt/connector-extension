import { config } from 'config'
import { ResultAsync } from 'neverthrow'
import { getActiveWindow } from './get-active-window'

export const createAlignedPopupWindow = (pagePath: string) =>
  getActiveWindow()
    .andThen(({ width, left, height, top }) =>
      createPopupWindow(pagePath, { width, left, height, top }),
    )
    .andThen((popupWindow) =>
      ResultAsync.fromSafePromise(
        new Promise<chrome.tabs.Tab>((resolve) => {
          const listener = (tabId: number, info: chrome.tabs.TabChangeInfo) => {
            if (
              info.status === 'complete' &&
              tabId === popupWindow?.tabs?.[0].id
            ) {
              chrome.tabs.onUpdated.removeListener(listener)
              resolve(popupWindow?.tabs?.[0])
            }
          }
          chrome.tabs.onUpdated.addListener(listener)
        }),
      ),
    )

export const createPopupWindow = (
  pagePath: string,
  {
    left = 0,
    width,
    height,
    top = 0,
  }: Partial<{ left: number; top: number; height: number; width: number }>,
) =>
  ResultAsync.fromPromise<chrome.windows.Window | undefined, Error>(
    new Promise((resolve) => {
      chrome.windows.create(
        {
          url: `${chrome.runtime.getURL(pagePath)}?isPopupWindow=true`,
          type: 'popup',
          width: config.popup.width,
          height: config.popup.height,
          top: height !== undefined ? top + config.popup.offsetTop : undefined,
          left:
            width !== undefined ? width + left - config.popup.width : undefined,
        },
        resolve,
      )
    }),
    (error) => error as Error,
  )
