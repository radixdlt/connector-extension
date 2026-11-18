import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { Subject } from 'rxjs'
import { createMessage } from 'chrome/messages/create-message'
import { extensionPageSender } from 'chrome/messages/senders.test-utils'

// The device: a request it is given stays on it (the user has not approved it yet).
const getPublicKeys = vi.fn(() => new Promise(() => {}))
vi.mock('../wrapper/ledger-wrapper', () => ({
  ledger: {
    getPublicKeys,
    getDeviceInfo: vi.fn(),
    signTransaction: vi.fn(),
    signAuth: vi.fn(),
    signSubintent: vi.fn(),
    deriveAndDisplayAddress: vi.fn(),
    progress$: new Subject(),
    connectedDeviceId$: new Subject(),
  },
  ledgerLogger: { debug: () => undefined },
}))

const { Ledger } = await import('./ledger')

const request = (interactionId: string) =>
  createMessage.walletToLedger(
    'background',
    {
      interactionId,
      discriminator: 'derivePublicKeys',
      keysParameters: [],
      ledgerDevice: { model: 'nanoS', id: 'device' },
    } as any,
    'aa'.repeat(32),
  )

describe('the Ledger page', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    ;(chrome.runtime as any).id = 'test-extension'
    ;(navigator as any).hid = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.mocked(chrome.runtime.sendMessage).mockImplementation((() =>
      Promise.resolve()) as any)
    container = document.createElement('div')
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    getPublicKeys.mockClear()
    ;(chrome.runtime as any).id = undefined
  })

  const receive = (message: ReturnType<typeof request>) =>
    act(async () => {
      // @ts-expect-error vitest-chrome events can be triggered from tests
      chrome.runtime.onMessage.callListeners(message, extensionPageSender())
      await new Promise((resolve) => {
        setTimeout(resolve, 10)
      })
    })

  it('gives the device a request sent again only once', async () => {
    await act(async () => root.render(<Ledger />))

    await receive(request('i-1'))
    await receive(request('i-1'))

    expect(getPublicKeys).toHaveBeenCalledTimes(1)

    await receive(request('i-2'))
    expect(getPublicKeys).toHaveBeenCalledTimes(2)
  })
})
