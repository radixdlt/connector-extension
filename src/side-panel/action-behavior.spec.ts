import { describe, it, expect, afterEach } from 'vitest'
import {
  applyActionBehavior,
  getOpenSidePanelOnActionClick,
  openSidePanel,
  reapplyActionBehavior,
  setOpenSidePanelOnActionClick,
} from './action-behavior'
import { mockSidePanelApis } from './chrome-mocks.test-utils'

describe('extension icon behavior', () => {
  let mocks: ReturnType<typeof mockSidePanelApis>
  afterEach(() => mocks.restore())

  it('opens the side panel on click: behavior first, then no popup, then saved', async () => {
    mocks = mockSidePanelApis()
    const calls: string[] = []
    mocks.sidePanel.setPanelBehavior.mockImplementation(async (behavior) => {
      calls.push(`behavior:${behavior.openPanelOnActionClick}`)
    })
    mocks.action.setPopup.mockImplementation(async ({ popup }) => {
      calls.push(`popup:${popup}`)
    })

    const result = await setOpenSidePanelOnActionClick(true)

    expect(result.isOk()).toBe(true)
    expect(calls).toEqual(['behavior:true', 'popup:'])
    expect(mocks.sidePanel.setPanelBehavior).toHaveBeenCalledWith({
      openPanelOnActionClick: true,
    })
    expect(mocks.storage).toEqual({ openSidePanelOnActionClick: true })
  })

  it('restores the manifest popup, then turns the side panel behavior off', async () => {
    mocks = mockSidePanelApis({ storage: { openSidePanelOnActionClick: true } })
    const calls: string[] = []
    mocks.sidePanel.setPanelBehavior.mockImplementation(async (behavior) => {
      calls.push(`behavior:${behavior.openPanelOnActionClick}`)
    })
    mocks.action.setPopup.mockImplementation(async ({ popup }) => {
      calls.push(`popup:${popup}`)
    })

    await setOpenSidePanelOnActionClick(false)

    expect(calls).toEqual(['popup:src/pairing/index.html', 'behavior:false'])
    expect(mocks.storage).toEqual({ openSidePanelOnActionClick: false })
  })

  it('saves nothing when the change could not be applied', async () => {
    mocks = mockSidePanelApis()
    mocks.sidePanel.setPanelBehavior.mockRejectedValue(new Error('denied'))

    const result = await setOpenSidePanelOnActionClick(true)

    expect(result._unsafeUnwrapErr().message).toBe(
      'setting the side panel behavior: denied',
    )
    expect(mocks.action.setPopup).not.toHaveBeenCalled()
    expect(mocks.storage).toEqual({})
  })

  it('fails without the side panel API', async () => {
    mocks = mockSidePanelApis()
    ;(chrome as any).sidePanel = undefined

    const result = await applyActionBehavior(true)

    expect(result._unsafeUnwrapErr().message).toMatch(/no side panel/)
  })

  it('reads the saved choice, the popup by default', async () => {
    mocks = mockSidePanelApis()
    expect((await getOpenSidePanelOnActionClick())._unsafeUnwrap()).toBe(false)

    mocks.storage.openSidePanelOnActionClick = true
    expect((await getOpenSidePanelOnActionClick())._unsafeUnwrap()).toBe(true)
  })

  it('applies the saved choice again', async () => {
    mocks = mockSidePanelApis({ storage: { openSidePanelOnActionClick: true } })

    const result = await reapplyActionBehavior()

    expect(result._unsafeUnwrap()).toBe(true)
    expect(mocks.action.setPopup).toHaveBeenCalledWith({ popup: '' })
    expect(mocks.sidePanel.setPanelBehavior).toHaveBeenCalledWith({
      openPanelOnActionClick: true,
    })
  })

  it('opens the side panel in the given window, at once', () => {
    mocks = mockSidePanelApis()

    openSidePanel(42)

    // Synchronously: the click's user gesture must still hold.
    expect(mocks.sidePanel.open).toHaveBeenCalledWith({ windowId: 42 })
  })

  it('opens the side panel in the current window when its id is not known yet', () => {
    mocks = mockSidePanelApis()

    openSidePanel(undefined)

    expect(mocks.sidePanel.open).toHaveBeenCalledWith({
      windowId: chrome.windows.WINDOW_ID_CURRENT,
    })
  })
})
