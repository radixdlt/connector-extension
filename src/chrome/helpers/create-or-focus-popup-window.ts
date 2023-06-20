import { ResultAsync } from 'neverthrow'
import { createAlignedPopupWindow } from './create-popup-window'
import { focusWindow } from './focus-window'
import { getExtensionTabsByUrl } from './get-extension-tabs-by-url'

export const createOrFocusPopupWindow = (url: string) =>
  getExtensionTabsByUrl(url).andThen((tabs) => {
    if (tabs.length === 0) {
      return createAlignedPopupWindow(url)
    }

    return focusWindow(tabs[0].windowId)
      .andThen(() =>
        ResultAsync.fromPromise(
          chrome.tabs.update(tabs[0].id!, { active: true }),
          (e) => e as Error
        )
      )
      .map(() => tabs[0])
  })
