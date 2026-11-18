import { vi } from 'vitest'

/**
 * The side panel and action APIs, which the chrome mock of the tests lacks, plus
 * storage that keeps what is set. Call `restore` afterwards.
 */
export const mockSidePanelApis = (
  options: { storage?: Record<string, unknown>; windowId?: number } = {},
) => {
  const target = chrome as any
  const previous = { action: target.action, sidePanel: target.sidePanel }
  const storage: Record<string, unknown> = { ...options.storage }
  const sidePanel = {
    open: vi.fn<(options: chrome.sidePanel.OpenOptions) => Promise<void>>(() =>
      Promise.resolve(),
    ),
    setPanelBehavior: vi.fn<
      (behavior: chrome.sidePanel.PanelBehavior) => Promise<void>
    >(() => Promise.resolve()),
  }
  const action = {
    setPopup: vi.fn<(details: { popup: string }) => Promise<void>>(() =>
      Promise.resolve(),
    ),
  }
  target.sidePanel = sidePanel
  target.action = action
  vi.mocked(chrome.storage.local.get).mockImplementation(((key: string) =>
    Promise.resolve({ [key]: storage[key] })) as any)
  vi.mocked(chrome.storage.local.set).mockImplementation(((
    items: Record<string, unknown>,
  ) => {
    Object.assign(storage, items)
    return Promise.resolve()
  }) as any)
  vi.mocked(chrome.windows.getCurrent).mockImplementation((() =>
    Promise.resolve({ id: options.windowId ?? 7 })) as any)
  const manifest: chrome.runtime.ManifestV3 = {
    manifest_version: 3,
    name: 'test',
    version: '1',
    action: { default_popup: 'src/pairing/index.html' },
  }
  vi.mocked(chrome.runtime.getManifest).mockReturnValue(manifest)

  return {
    sidePanel,
    action,
    storage,
    restore: () => {
      target.sidePanel = previous.sidePanel
      target.action = previous.action
      vi.mocked(chrome.storage.local.get).mockReset()
      vi.mocked(chrome.storage.local.set).mockReset()
      vi.mocked(chrome.windows.getCurrent).mockReset()
      vi.mocked(chrome.runtime.getManifest).mockReset()
    },
  }
}
