import { createTab } from './create-tab'

export const createAndFocusTab = (url: string) =>
  createTab(url).map((tab) => chrome.tabs.update(tab.id!, { active: true }))
