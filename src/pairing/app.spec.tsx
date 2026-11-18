import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from './app'
import { mockSidePanelApis } from 'side-panel/chrome-mocks.test-utils'
import { SurfaceContext } from 'side-panel/surface'

vi.mock('./components/connection-status', () => ({
  ConnectionStatus: () => <p data-testid="main-view">Linked wallets</p>,
}))
vi.mock('./pairing', () => ({
  Pairing: () => <p data-testid="pairing-view">QR code</p>,
}))

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

describe('popup and side panel app', () => {
  let container: HTMLDivElement
  let root: Root
  let mocks: ReturnType<typeof mockSidePanelApis>

  const render = async (path = '/') => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root.render(
        <SurfaceContext.Provider value="popup">
          <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
          </MemoryRouter>
        </SurfaceContext.Provider>,
      )
      await sleep(10)
    })
  }
  const button = (name: string) =>
    container.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)
  const click = async (element: HTMLElement | null) =>
    act(async () => {
      element!.click()
      await sleep(10)
    })

  // The pairing and the settings are loaded when first opened: loaded here
  // already, they show as soon as they are opened.
  beforeAll(async () => {
    await import('./pairing')
    await import('settings/settings-screens')
  })

  beforeEach(() => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    mocks = mockSidePanelApis()
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    mocks.restore()
  })

  it('has a settings button, named and focusable, on the main and pairing views', async () => {
    await render('/')
    const settings = button('Settings')!
    expect(settings).not.toBeNull()
    expect(settings.getAttribute('type')).toBe('button')
    expect(settings.title).toBe('Settings')
    expect(settings.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
      'true',
    )
    settings.focus()
    expect(document.activeElement).toBe(settings)
    await act(async () => root.unmount())

    await render('/pairing')
    expect(button('Settings')).not.toBeNull()
  })

  it('opens the settings in place, and goes back to the main view', async () => {
    await render('/')

    await click(button('Settings'))

    const title = container.querySelector('.rdx-top-bar__title')
    expect(title?.textContent).toBe('Settings')
    expect(document.activeElement).toBe(title)
    expect(container.querySelector('[data-testid="main-view"]')).toBeNull()
    expect(button('Settings')).toBeNull()
    expect(container.textContent).toContain('dApp requests')
    expect(
      container.querySelector('[data-testid="side-panel-settings"]'),
    ).not.toBeNull()

    await click(button('Back to the wallet connector'))

    expect(container.querySelector('[data-testid="main-view"]')).not.toBeNull()
    expect(button('Settings')).not.toBeNull()
  })

  it('opens a sub-page of the settings, whose back arrow returns to the settings', async () => {
    await render('/settings')
    const radixConnect = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button.rdx-row'),
    ).find((row) => row.textContent?.startsWith('Radix Connect'))!

    await click(radixConnect)
    expect(container.querySelector('.rdx-top-bar__title')?.textContent).toBe(
      'Radix Connect',
    )

    await click(button('Back to the settings'))
    expect(container.querySelector('.rdx-top-bar__title')?.textContent).toBe(
      'Settings',
    )
  })
})
