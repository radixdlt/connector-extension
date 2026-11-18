import { afterEach, describe, expect, it, vi } from 'vitest'
import { Subject, of } from 'rxjs'
import { okAsync } from 'neverthrow'
import { Logger } from 'tslog'
import type { Message } from 'chrome/messages/_types'
import { OffscreenServices, WalletConnectionClientFactory } from './factory'

// What the wallet links of these tests share, as an offscreen document's would.
const services = OffscreenServices()
const walletConnectionClientFactory = WalletConnectionClientFactory(services)

const wallet = 'a'.repeat(64)

const setup = () => {
  // @ts-expect-error vitest-chrome events can be reset from tests
  chrome.runtime.onMessage.clearListeners()
  ;(chrome.runtime as any).id = 'test-extension'
  const sent: Message[] = []
  vi.mocked(chrome.runtime.sendMessage).mockImplementation(((
    message: Message,
  ) => {
    sent.push(message)
    return Promise.resolve()
  }) as any)
  const fromWallet = new Subject<Record<string, unknown>>()
  const transport = {
    setConnectionPassword: vi.fn(() => okAsync(undefined)),
    setConnectionConfig: vi.fn(),
    sendMessage: vi.fn(() => okAsync(undefined)),
    connected$: of(true),
    onMessage$: fromWallet.asObservable(),
    connect: vi.fn(),
    restart: vi.fn(),
    destroy: vi.fn(),
    diagnostics: vi.fn(() => ({ connected: true })),
  }
  const client = walletConnectionClientFactory({
    connection: {
      walletPublicKey: wallet,
      walletName: 'Pixel',
      password: 'aa'.repeat(32),
      accounts: [],
    },
    logger: new Logger({ type: 'hidden' }),
    transport: transport as any,
    dispatch: {
      delivered: vi.fn(),
      walletResponse: vi.fn(() => okAsync(undefined)),
    },
  })
  const toBackground = () =>
    sent.filter((message) => message.discriminator === 'walletToExtension')
  return { client, transport, fromWallet, toBackground }
}

describe('wallet link: removal of the link', () => {
  afterEach(() => {
    vi.mocked(chrome.runtime.sendMessage).mockReset()
    ;(chrome.runtime as any).id = undefined
  })

  it("answers the wallet's removal of the link, and passes it on to the background", async () => {
    const { client, transport, fromWallet, toBackground } = setup()

    fromWallet.next({ discriminator: 'linkRemoved' })

    expect(transport.sendMessage).toHaveBeenCalledWith(
      { discriminator: 'linkRemoved' },
      expect.objectContaining({ timeout: expect.any(Number) }),
    )
    await vi.waitFor(() =>
      expect(toBackground()).toEqual([
        expect.objectContaining({
          data: { discriminator: 'linkRemoved' },
          walletPublicKey: wallet,
        }),
      ]),
    )
    client.destroy()
  })

  it("hears only its wallet, never the extension's messages", () => {
    const { client } = setup()

    // A message of a web page or of the extension's pages never passes for the
    // wallet's: the link has no listener for them.
    expect(chrome.runtime.onMessage.hasListeners()).toBe(false)
    client.destroy()
  })
})
