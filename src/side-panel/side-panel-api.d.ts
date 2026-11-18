// `chrome.sidePanel.open` (Chrome 116), missing from the installed @types/chrome.
declare namespace chrome.sidePanel {
  export type OpenOptions = {
    windowId?: number
    tabId?: number
  }

  /** Opens the side panel. Only in response to a user action (e.g. a click). */
  export function open(options: OpenOptions): Promise<void>
}
