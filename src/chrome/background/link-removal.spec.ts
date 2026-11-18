import type { RetiredLink } from 'chrome/links/retired-links'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { okAsync } from 'neverthrow'
import { Logger } from 'tslog'
import { createMessage } from 'chrome/messages/create-message'
import { BackgroundMessageHandler } from './message-handler'

const wallet = 'a'.repeat(64)
const other = 'b'.repeat(64)
const connection = (walletPublicKey: string, walletName: string) => ({
  walletPublicKey,
  walletName,
  password: walletPublicKey.slice(0, 2).repeat(32),
  accounts: [],
})

describe('background: removed links', () => {
  let stored: Record<string, any>
  const send = vi.fn()

  const handler = () =>
    BackgroundMessageHandler({
      logger: new Logger({ type: 'hidden' }),
      getConnections: () => okAsync(stored.connections),
    })

  beforeEach(() => {
    stored = {
      connections: {
        [wallet]: connection(wallet, 'Pixel 8'),
        [other]: connection(other, 'iPhone'),
      },
    }
    vi.mocked(chrome.storage.local.get).mockImplementation(((key: string) =>
      Promise.resolve({ [key]: stored[key] })) as any)
    vi.mocked(chrome.storage.local.set).mockImplementation(((
      items: Record<string, unknown>,
    ) => {
      Object.assign(stored, items)
      return Promise.resolve()
    }) as any)
    vi.mocked(chrome.notifications.create).mockImplementation(
      ((_id: string, _options: unknown, callback?: () => void) =>
        callback?.()) as any,
    )
  })

  afterEach(() => {
    vi.mocked(chrome.storage.local.get).mockReset()
    vi.mocked(chrome.storage.local.set).mockReset()
    vi.mocked(chrome.notifications.create).mockReset()
  })

  it('forgets a wallet that removed its link, without telling it back, and says so', async () => {
    await handler()(
      createMessage.walletToExtension(
        'offScreen',
        { discriminator: 'linkRemoved' },
        wallet,
      ),
      send,
    )
    await vi.waitFor(() =>
      expect(Object.keys(stored.connections)).toEqual([other]),
    )

    expect(stored.retiredLinks).toBeUndefined()
    expect(chrome.notifications.create).toHaveBeenCalledWith(
      expect.stringMatching(/^linkRemoved___/),
      expect.objectContaining({
        title: 'Wallet unlinked',
        message:
          'Pixel 8 removed this connector, so it was forgotten here too.',
      }),
      expect.any(Function),
    )
  })

  it('ignores the removal of a link it does not know', async () => {
    await handler()(
      createMessage.walletToExtension(
        'offScreen',
        { discriminator: 'linkRemoved' },
        'c'.repeat(64),
      ),
      send,
    )

    expect(Object.keys(stored.connections)).toEqual([wallet, other])
    expect(chrome.notifications.create).not.toHaveBeenCalled()
  })

  it('gives the offscreen document the notices to deliver, and forgets delivered ones', async () => {
    stored.retiredLinks = [
      {
        password: 'aa',
        walletPublicKey: wallet,
        walletName: 'x',
        retiredAt: Date.now(),
      },
      {
        password: 'old',
        walletPublicKey: other,
        walletName: 'y',
        retiredAt: 0,
      },
    ]

    const answer = await handler()(createMessage.getRetiredLinks(), send)
    expect(
      (answer._unsafeUnwrap().data as RetiredLink[]).map(
        (link) => link.password,
      ),
    ).toEqual(['aa'])

    await handler()(createMessage.linkRemovalDelivered('aa'), send)
    expect(stored.retiredLinks.map((link: any) => link.password)).toEqual([
      'old',
    ])
  })
})
