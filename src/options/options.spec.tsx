import { describe, it, expect, afterEach, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { Options } from './options'
import { mockSidePanelApis } from 'side-panel/chrome-mocks.test-utils'

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

describe('options page', () => {
  let root: Root
  let container: HTMLDivElement
  let mocks: ReturnType<typeof mockSidePanelApis>

  const render = async (storage: Record<string, unknown> = {}) => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    window.location.hash = ''
    mocks = mockSidePanelApis({ storage })
    // The theme is kept in the page's localStorage.
    const items = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, String(value)),
      removeItem: (key: string) => items.delete(key),
    })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root.render(<Options />)
      await sleep(10)
    })
  }
  const title = () =>
    container.querySelector('.rdx-top-bar__title')?.textContent
  const row = (name: string) =>
    Array.from(container.querySelectorAll<HTMLElement>('.rdx-row')).find(
      (element) =>
        element.querySelector('.rdx-row__title')?.textContent === name,
    )!
  const click = async (element: HTMLElement) =>
    act(async () => {
      element.click()
      await sleep(10)
    })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    mocks.restore()
    window.location.hash = ''
    vi.unstubAllGlobals()
    delete document.documentElement.dataset.theme
  })

  it('lists the settings like the wallet: sections of rows, no way back from the page', async () => {
    await render({ options: { showDAppRequestNotifications: false } })

    expect(title()).toBe('Settings')
    expect(container.querySelector('[aria-label^="Back"]')).toBeNull()
    expect(
      Array.from(
        container.querySelectorAll('.rdx-section__header'),
        (header) => header.textContent,
      ),
    ).toEqual([
      'Notifications',
      'Requests',
      'Appearance',
      'Side panel',
      'Connection',
      'About',
    ])
    const dAppRequests = row('dApp requests').querySelector('input')!
    expect(dAppRequests.getAttribute('role')).toBe('switch')
    expect(dAppRequests.checked).toBe(false)
    expect(row('Transaction results').querySelector('input')!.checked).toBe(
      true,
    )
    expect(row('Open in side panel')).toBeDefined()
    expect(row('Version').textContent).toContain('Version')
    expect(row('Build').textContent).not.toBe('Build')
  })

  it('saves a switched notification option', async () => {
    await render()

    await click(row('dApp requests').querySelector('input')!)

    expect(mocks.storage.options).toMatchObject({
      showDAppRequestNotifications: false,
    })
  })

  it('opens Radix Connect: transport choices and the iroh relay, then goes back', async () => {
    await render({ options: { radixConnectTransport: 'webrtcAndIroh' } })

    await click(row('Radix Connect'))

    expect(title()).toBe('Radix Connect')
    expect(container.querySelector('[role="radiogroup"]')).not.toBeNull()
    const both = row('WebRTC and iroh').querySelector('input')!
    expect(both.checked).toBe(true)
    expect(container.textContent).toContain('Custom iroh relay (optional)')

    await click(row('iroh').querySelector('input')!)
    expect(mocks.storage.options).toMatchObject({
      radixConnectTransport: 'iroh',
    })

    await click(
      container.querySelector<HTMLElement>(
        '[aria-label="Back to the settings"]',
      )!,
    )
    expect(title()).toBe('Settings')
  })

  it('opens the diagnostics with "Show advanced diagnostics" off, and saves it', async () => {
    await render()

    await click(row('Connection diagnostics'))

    expect(title()).toBe('Connection diagnostics')
    const toggle = row('Show advanced diagnostics').querySelector('input')!
    expect(toggle.checked).toBe(false)
    expect(
      container.querySelector('[data-testid="connection-diagnostics"]'),
    ).not.toBeNull()

    await click(toggle)

    expect(toggle.checked).toBe(true)
    expect(mocks.storage.showAdvancedDiagnostics).toBe(true)
  })

  it('changes the theme: classic by default, then system, light or dark', async () => {
    await render()

    expect(row('Theme').textContent).toContain('Classic')
    await click(row('Theme'))

    expect(title()).toBe('Theme')
    expect(row('Classic').querySelector('input')!.checked).toBe(true)

    await click(row('Light').querySelector('input')!)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('radix-connector-theme')).toBe('light')

    await click(row('Dark').querySelector('input')!)
    expect(document.documentElement.dataset.theme).toBe('dark')

    await click(
      container.querySelector<HTMLElement>(
        '[aria-label="Back to the settings"]',
      )!,
    )
    expect(row('Theme').textContent).toContain('Dark')
  })
})
