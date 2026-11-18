import { extensionPageSender } from 'chrome/messages/senders.test-utils'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { ResultAsync, okAsync } from 'neverthrow'
import { createMessage } from 'chrome/messages/create-message'
import type { PendingRequest } from 'chrome/offscreen/requests/pending-request'
import { PendingRequests, PendingRequestsView } from './pending-requests'

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

const request = (
  interactionId: string,
  changes: Partial<PendingRequest> = {},
): PendingRequest => ({
  interactionId,
  origin: 'dashboard.radixdlt.com',
  kind: 'transaction',
  status: 'waitingForWallet',
  wallets: [],
  delivered: false,
  createdAt: Date.now() - 35_000,
  updatedAt: Date.now() - 35_000,
  ...changes,
})

describe('pending requests', () => {
  let container: HTMLDivElement
  let root: Root

  const render = async (element: JSX.Element) => {
    await act(async () => {
      root.render(element)
      await sleep(10)
    })
  }
  const rows = () =>
    Array.from(
      container.querySelectorAll<HTMLElement>(
        '[data-testid="pending-request"]',
      ),
    )
  /** A card as it reads: its name, heading, status words and time. */
  const card = (row: HTMLElement) => ({
    name: row.getAttribute('aria-label'),
    heading: row.querySelector('h3')?.textContent,
    status: row.querySelector('.request-card__status')?.textContent,
    time: row.querySelector('time')?.textContent,
  })
  const banner = () =>
    container.querySelector('[data-testid="wallet-not-connected-banner"]')

  beforeEach(() => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    vi.mocked(chrome.runtime.sendMessage).mockReset()
  })

  it('offers to send again, or cancel, a request whose wallet disconnected without answering', async () => {
    const onResend = vi.fn(() => okAsync({ resent: true }))
    const onCancel = vi.fn(() => okAsync({ cancelled: true }))
    await render(
      <PendingRequestsView
        requests={[
          request('a', {
            status: 'walletDisconnected',
            delivered: true,
            wallets: ['w1'],
          }),
        ]}
        walletNames={{ w1: 'Pixel 8' }}
        onResend={onResend}
        onCancel={onCancel}
      />,
    )

    const notice = container.querySelector(
      '[data-testid="wallet-disconnected-notice"]',
    )
    expect(card(rows()[0]).status).toBe('Wallet disconnected')
    expect(notice?.textContent).toContain(
      'Your Radix Wallet disconnected without answering',
    )
    expect(banner()).toBeNull()

    const buttons = Array.from(rows()[0].querySelectorAll('button'))
    await act(async () => {
      buttons.find((button) => button.textContent === 'Send again')!.click()
      await sleep(10)
    })
    expect(onResend).toHaveBeenCalledWith('a')

    await act(async () => {
      buttons.find((button) => button.textContent === 'Cancel')!.click()
      await sleep(10)
    })
    expect(onCancel).toHaveBeenCalledWith('a')
  })

  it('says the wallet is in the background, and keeps the time beside it', async () => {
    await render(
      <PendingRequestsView
        requests={[
          request('a', {
            status: 'deliveredToWallet',
            delivered: true,
            walletInBackground: true,
          }),
        ]}
      />,
    )

    expect(card(rows()[0])).toMatchObject({
      status: 'Wallet in the background',
      time: '35 s',
    })
  })

  it('tells that a lost request comes back by itself from a wallet that reports them, with no Send again', async () => {
    await render(
      <PendingRequestsView
        requests={[
          request('a', {
            status: 'walletDisconnected',
            delivered: true,
            comesBack: true,
          }),
        ]}
      />,
    )

    const notice = container.querySelector(
      '[data-testid="wallet-disconnected-notice"]',
    )
    expect(notice?.textContent).toContain('it is sent again by itself')
    const labels = Array.from(rows()[0].querySelectorAll('button')).map(
      (button) => button.textContent,
    )
    expect(labels).toEqual(['Cancel'])
  })

  it('lists first what needs the user, then what is under way, then what is over', async () => {
    const at = (minutesAgo: number) => Date.now() - minutesAgo * 60_000
    await render(
      <PendingRequestsView
        requests={[
          request('answered', { status: 'answered', createdAt: at(1) }),
          request('sending', { status: 'sending', createdAt: at(2) }),
          request('lost', {
            status: 'walletDisconnected',
            delivered: true,
            createdAt: at(9),
          }),
          request('waiting', { status: 'waitingForWallet', createdAt: at(3) }),
        ]}
      />,
    )

    expect(rows().map((row) => row.dataset.status)).toEqual([
      'waitingForWallet',
      'walletDisconnected',
      'sending',
      'answered',
    ])
  })

  it("lays a dApp's queued requests under its card, with how many, and spreads them on a click", async () => {
    const start = Date.now()
    const at = (minutesAgo: number) => start - minutesAgo * 60_000
    await render(
      <PendingRequestsView
        requests={[
          request('other', { origin: 'other.example.com', createdAt: at(1) }),
          request('inWallet', {
            status: 'deliveredToWallet',
            delivered: true,
            createdAt: at(5),
          }),
          request('second', { status: 'waitingForTurn', createdAt: at(4) }),
          request('third', { status: 'waitingForTurn', createdAt: at(3) }),
        ]}
      />,
    )
    const deck = container.querySelector<HTMLElement>(
      '[data-testid="request-queue"]',
    )!
    const toggle = deck.querySelector<HTMLButtonElement>(
      '.request-deck__keyboard-toggle',
    )!
    const spread = () =>
      Array.from(
        deck.querySelectorAll<HTMLElement>(
          '.request-deck__card [data-testid="pending-request"]',
        ),
      )

    // Folded under its dApp's card in the wallet; no count under the deck.
    expect(
      deck
        .querySelector('.request-deck__top [data-testid="pending-request"]')
        ?.getAttribute('data-status'),
    ).toBe('deliveredToWallet')
    expect(deck.querySelector('.request-deck__count')).toBeNull()
    expect(toggle.textContent).toBe(
      'Show the 2 requests waiting for their turn',
    )
    expect(toggle.getAttribute('aria-expanded')).toBe('false')

    // A click on the card spreads them, as cards, the next to go first.
    await act(async () =>
      deck.querySelector<HTMLElement>('.request-deck__top h3')!.click(),
    )
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(
      spread().map(
        (row) => row.querySelector('time')?.getAttribute('dateTime'),
      ),
    ).toEqual([new Date(at(4)).toISOString(), new Date(at(3)).toISOString()])
    expect(spread().map((row) => card(row).status)).toEqual([
      'Waiting for its turn',
      'Waiting for its turn',
    ])

    // Its own buttons do not fold it; the click on the card again does.
    await act(async () =>
      spread()[0]
        .querySelector<HTMLButtonElement>('.request-card__cancel')!
        .click(),
    )
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    await act(async () => toggle.click())
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })

  it('takes the card on top away, and brings the next up in its place', async () => {
    const inWallet = request('inWallet', {
      status: 'deliveredToWallet',
      delivered: true,
      createdAt: 1,
    })
    const next = request('next', { status: 'waitingForTurn', createdAt: 2 })
    const last = request('last', { status: 'waitingForTurn', createdAt: 3 })
    await render(<PendingRequestsView requests={[inWallet, next, last]} />)

    // Answered: the next one is sent, and takes the top.
    await render(
      <PendingRequestsView
        requests={[
          { ...next, status: 'deliveredToWallet', delivered: true },
          last,
        ]}
      />,
    )
    const top = container.querySelector('.request-deck__top')!
    expect(
      top
        .querySelector('.request-swap__leaving [data-testid="pending-request"]')
        ?.getAttribute('aria-label'),
    ).toBeTruthy()
    expect(top.querySelector('.request-card--arriving')).not.toBeNull()

    // Then only the new one stays.
    await act(async () => sleep(500))
    expect(top.querySelector('.request-swap__leaving')).toBeNull()
  })

  it('shows a queue whose earlier request is gone under its first request', async () => {
    await render(
      <PendingRequestsView
        requests={[
          request('first', { status: 'waitingForTurn', createdAt: 1 }),
          request('next', { status: 'waitingForTurn', createdAt: 2 }),
        ]}
      />,
    )
    expect(rows().map((row) => row.dataset.status)).toEqual([
      'waitingForTurn',
      'waitingForTurn',
    ])
    expect(
      container.querySelector('.request-deck__keyboard-toggle')?.textContent,
    ).toBe('Show the request waiting for its turn')
  })

  it('says beside its title how many requests are still going on', async () => {
    await render(
      <PendingRequestsView
        requests={[
          request('a'),
          request('b', { status: 'waitingForTurn' }),
          request('c', { status: 'answered' }),
        ]}
      />,
    )
    expect(
      container.querySelector('#pending-requests-title .main-view__count')
        ?.textContent,
    ).toBe('2')
  })

  it('keeps the card on top the same element when its queue empties: no flicker', async () => {
    const top = request('top', {
      status: 'deliveredToWallet',
      delivered: true,
      createdAt: 1,
    })
    await render(
      <PendingRequestsView
        requests={[
          top,
          request('next', { status: 'waitingForTurn', createdAt: 2 }),
        ]}
      />,
    )
    const before = container.querySelector('.request-deck__top')

    await render(<PendingRequestsView requests={[top]} />)

    expect(container.querySelector('.request-deck__top')).toBe(before)
    expect(container.querySelector('[data-testid="request-queue"]')).toBeNull()
  })

  it('lets a card cancelled from the spread deck slide away while its place closes', async () => {
    const top = request('top', {
      status: 'deliveredToWallet',
      delivered: true,
      createdAt: 1,
    })
    const first = request('first', { status: 'waitingForTurn', createdAt: 2 })
    const second = request('second', { status: 'waitingForTurn', createdAt: 3 })
    await render(<PendingRequestsView requests={[top, first, second]} />)
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('.request-deck__keyboard-toggle')!
        .click(),
    )

    await render(<PendingRequestsView requests={[top, second]} />)

    const places = () =>
      Array.from(container.querySelectorAll<HTMLElement>('.request-deck__card'))
    // Still at its place, on its way out; the one below stays below it.
    expect(places().map((place) => place.className)).toEqual([
      'request-deck__card request-deck__card--removed',
      'request-deck__card',
    ])
    await act(async () => sleep(700))
    expect(places()).toHaveLength(1)
  })

  it('says it is cancelling in place of the status, so that the card keeps its height', async () => {
    // A cancel that has not answered yet.
    const onCancel = vi.fn(() =>
      ResultAsync.fromSafePromise(new Promise<never>(() => {})),
    )
    await render(
      <PendingRequestsView
        onCancel={onCancel as any}
        requests={[request('a', { status: 'waitingForTurn' })]}
      />,
    )
    const row = rows()[0]

    await act(async () =>
      row.querySelector<HTMLButtonElement>('.request-card__cancel')!.click(),
    )

    expect(card(row).status).toBe('Cancelling…')
    expect(row.querySelector('.request-card__note')).toBeNull()
    expect(row.classList.contains('request-card--busy')).toBe(true)
  })

  it('sends a card its wallet approved out to the left, one rejected to the right', async () => {
    const top = (id: string, createdAt: number) =>
      request(id, {
        status: 'deliveredToWallet',
        delivered: true,
        createdAt,
        origin: 'd.example',
      })
    const next = request('next', {
      status: 'waitingForTurn',
      createdAt: 5,
      origin: 'd.example',
    })
    await render(<PendingRequestsView requests={[top('approved', 1), next]} />)

    await render(
      <PendingRequestsView
        requests={[{ ...next, status: 'sending' }]}
        outcomes={{ approved: 'accepted' }}
      />,
    )

    expect(
      container.querySelector('.request-swap__leaving')?.className,
    ).toContain('request-swap__leaving--accepted')
  })

  it('shows no deck when no request waits for its turn', async () => {
    await render(<PendingRequestsView requests={[request('a')]} />)
    expect(container.querySelector('[data-testid="request-queue"]')).toBeNull()
  })

  it('shows nothing without requests', async () => {
    await render(<PendingRequestsView requests={[]} />)

    expect(container.textContent).toBe('')
  })

  it('says which wallets a request is for, and the one that received it', async () => {
    await render(
      <PendingRequestsView
        requests={[
          request('a', { wallets: ['aaaaaaaa'] }),
          request('b', { wallets: ['aaaaaaaa', 'bbbbbbbb'] }),
          request('c', {
            wallets: ['bbbbbbbb'],
            delivered: true,
            status: 'deliveredToWallet',
          }),
        ]}
        walletNames={{ aaaaaaaa: 'Pixel 8', bbbbbbbb: 'iPhone' }}
      />,
    )

    const wallets = Array.from(
      container.querySelectorAll('.request-card__wallet'),
      (line) => line.textContent,
    )
    expect(wallets).toEqual([
      'For Pixel 8',
      'For Pixel 8 or iPhone',
      'Sent to iPhone',
    ])
  })

  it('asks to open the wallet while a request waits for it, and no longer once it is delivered', async () => {
    await render(<PendingRequestsView requests={[request('a')]} />)

    expect(banner()?.textContent).toBe(
      'Open the Radix Wallet app on your phone to continue',
    )
    expect(card(rows()[0])).toEqual({
      name: 'Transaction from dashboard.radixdlt.com',
      heading: 'Transaction',
      status: 'Waiting for the wallet',
      time: '35 s',
    })
    expect(rows()[0].querySelector('button')?.textContent).toBe('Cancel')

    await render(
      <PendingRequestsView
        requests={[request('a', { status: 'deliveredToWallet' })]}
      />,
    )

    expect(banner()).toBeNull()
    expect(rows()[0].textContent).toContain('In your Radix Wallet')
    // In the wallet already: it can only be rejected there.
    expect(rows()[0].querySelector('button')).toBeNull()
  })

  it('closes the footer of a card that no longer needs it, rather than dropping it at once', async () => {
    await render(<PendingRequestsView requests={[request('a')]} />)
    await render(
      <PendingRequestsView
        requests={[request('a', { status: 'deliveredToWallet' })]}
      />,
    )

    // Its footer as it was, while it closes: hidden, and no longer the live banner.
    const leaving = rows()[0].querySelector('.request-card__reveal--leaving')
    expect(leaving?.textContent).toBe(
      'Open the Radix Wallet app on your phone to continue',
    )
    expect(leaving?.getAttribute('aria-hidden')).toBe('true')
    expect(banner()).toBeNull()

    await act(async () => {
      await sleep(500)
    })
    expect(rows()[0].querySelector('.request-card__reveal')).toBeNull()
  })

  it('names each status, and offers to cancel only what the wallet did not receive', async () => {
    await render(
      <PendingRequestsView
        requests={[
          request('a', { kind: 'login', status: 'sending' }),
          request('b', { kind: 'data', status: 'answered' }),
          request('c', { kind: 'preAuthorization', status: 'cancelled' }),
          request('d', { kind: 'request', status: 'failed', origin: '' }),
        ]}
      />,
    )

    expect(rows().map((row) => row.dataset.status)).toEqual([
      'sending',
      'answered',
      'cancelled',
      'failed',
    ])
    expect(rows().map(card)).toEqual([
      {
        name: 'Login from dashboard.radixdlt.com',
        heading: 'Login',
        status: 'Sending to the wallet',
        time: '35 s',
      },
      {
        name: 'Data request from dashboard.radixdlt.com',
        heading: 'Data request',
        status: 'Answered',
        time: '35 s ago',
      },
      {
        name: 'Pre-authorization from dashboard.radixdlt.com',
        heading: 'Pre-authorization',
        status: 'Cancelled',
        time: '35 s ago',
      },
      {
        name: 'Request from Unknown dApp',
        heading: 'Request',
        status: "Couldn't reach the wallet",
        time: '35 s ago',
      },
    ])
    expect(rows().map((row) => !!row.querySelector('button'))).toEqual([
      true,
      false,
      false,
      false,
    ])
  })

  it('keeps the whole origin and recipients in titles, for when they are cut short', async () => {
    const origin = `${'very-long-subdomain.'.repeat(4)}example.com`
    await render(
      <PendingRequestsView
        requests={[request('a', { origin, wallets: ['aaaaaaaa'] })]}
        walletNames={{ aaaaaaaa: 'A wallet with a rather long name' }}
      />,
    )

    expect(rows()[0].querySelector(`[title="${origin}"]`)?.textContent).toBe(
      origin,
    )
    expect(
      rows()[0].querySelector('[title="For A wallet with a rather long name"]'),
    ).not.toBeNull()
  })

  it('cancels a request, and says when the wallet already had it', async () => {
    const onCancel = vi
      .fn()
      .mockReturnValueOnce(okAsync({ cancelled: true }))
      .mockReturnValueOnce(
        okAsync({ cancelled: false, status: 'deliveredToWallet' }),
      )
    await render(
      <PendingRequestsView
        requests={[request('a'), request('b')]}
        onCancel={onCancel}
      />,
    )
    const cancel = (index: number) =>
      act(async () => {
        rows()[index].querySelector('button')!.click()
        await sleep(10)
      })
    expect(rows()[0].querySelector('button')!.getAttribute('aria-label')).toBe(
      'Cancel the transaction from dashboard.radixdlt.com',
    )

    await cancel(0)
    await cancel(1)

    expect(onCancel.mock.calls).toEqual([['a'], ['b']])
    expect(rows()[1].textContent).toContain(
      'Already in your Radix Wallet: reject it there',
    )
  })

  it('fetches the requests once, then follows the changes the offscreen document sends', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(((
      message: any,
    ) => {
      if (message.discriminator === 'getPendingRequests')
        setTimeout(() =>
          // @ts-expect-error vitest-chrome events can be triggered from tests
          chrome.runtime.onMessage.callListeners(
            createMessage.confirmationSuccess('offScreen', message.messageId, {
              requests: [request('a')],
            }),
            extensionPageSender(),
          ),
        )
      return Promise.resolve()
    }) as any)

    await render(<PendingRequests />)
    await vi.waitFor(() => expect(rows()).toHaveLength(1))
    expect(banner()).not.toBeNull()

    await act(async () => {
      // @ts-expect-error vitest-chrome events can be triggered from tests
      chrome.runtime.onMessage.callListeners(
        createMessage.pendingRequestsChanged([
          request('a', { status: 'deliveredToWallet' }),
        ]),
        extensionPageSender(),
      )
      await sleep(10)
    })

    expect(rows()[0].dataset.status).toBe('deliveredToWallet')
    expect(banner()).toBeNull()
    const polls = vi
      .mocked(chrome.runtime.sendMessage)
      .mock.calls.filter(
        ([message]: any[]) => message.discriminator === 'getPendingRequests',
      )
    expect(polls).toHaveLength(1)
  })
})
