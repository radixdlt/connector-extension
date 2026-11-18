import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { SidePanelSection } from './side-panel-section'
import { SurfaceContext, type Surface } from './surface'
import { mockSidePanelApis } from './chrome-mocks.test-utils'

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

describe('SidePanelSection', () => {
  let container: HTMLDivElement
  let root: Root
  let mocks: ReturnType<typeof mockSidePanelApis>

  const render = async (surface: Surface) => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root.render(
        <SurfaceContext.Provider value={surface}>
          <SidePanelSection />
        </SurfaceContext.Provider>,
      )
      await sleep(10)
    })
  }
  const toggle = () =>
    container.querySelector<HTMLInputElement>('input[type="checkbox"]')!
  const openButton = () =>
    Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.startsWith('Open in side panel'),
    )

  beforeEach(() => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    mocks = mockSidePanelApis({ windowId: 7 })
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    mocks.restore()
    vi.restoreAllMocks()
  })

  it('opens the side panel in the popup window, then closes the popup', async () => {
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    await render('popup')

    await act(async () => {
      openButton()!.click()
      await sleep(10)
    })

    expect(mocks.sidePanel.open).toHaveBeenCalledWith({ windowId: 7 })
    expect(close).toHaveBeenCalled()
  })

  it('does not close an options page after opening the side panel', async () => {
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    await render('page')

    await act(async () => {
      openButton()!.click()
      await sleep(10)
    })

    expect(mocks.sidePanel.open).toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
  })

  it('says why the side panel did not open', async () => {
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    mocks.sidePanel.open.mockRejectedValue(new Error('no user gesture'))
    await render('popup')

    await act(async () => {
      openButton()!.click()
      await sleep(10)
    })

    expect(close).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'Could not open the side panel: opening the side panel: no user gesture',
    )
  })

  it('offers only the icon setting inside the side panel', async () => {
    await render('sidePanel')

    expect(openButton()).toBeUndefined()
    expect(container.textContent).toContain(
      'Open as a side panel when clicking the extension icon',
    )
  })

  it('makes the icon open the side panel, and the popup again', async () => {
    await render('sidePanel')
    expect(toggle().checked).toBe(false)

    await act(async () => {
      toggle().click()
      await sleep(10)
    })
    expect(toggle().checked).toBe(true)
    expect(mocks.action.setPopup).toHaveBeenLastCalledWith({ popup: '' })
    expect(mocks.sidePanel.setPanelBehavior).toHaveBeenLastCalledWith({
      openPanelOnActionClick: true,
    })
    expect(mocks.storage.openSidePanelOnActionClick).toBe(true)

    await act(async () => {
      toggle().click()
      await sleep(10)
    })
    expect(mocks.action.setPopup).toHaveBeenLastCalledWith({
      popup: 'src/pairing/index.html',
    })
    expect(mocks.sidePanel.setPanelBehavior).toHaveBeenLastCalledWith({
      openPanelOnActionClick: false,
    })
    expect(mocks.storage.openSidePanelOnActionClick).toBe(false)
  })

  it('shows the saved choice, and goes back to it when it cannot be changed', async () => {
    mocks.storage.openSidePanelOnActionClick = true
    await render('popup')
    expect(toggle().checked).toBe(true)
    mocks.action.setPopup.mockRejectedValue(new Error('denied'))

    await act(async () => {
      toggle().click()
      await sleep(10)
    })

    expect(toggle().checked).toBe(true)
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'Could not change it: setting the popup: denied',
    )
  })

  it('is not shown without the side panel API', async () => {
    ;(chrome as any).sidePanel = undefined
    await render('popup')

    expect(container.textContent).toBe('')
  })
})
