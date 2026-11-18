import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RequestTracker, type RequestNotification } from './request-tracker'
import { originHostOf, requestKindOf } from './pending-request'

const login = { origin: 'dashboard.radixdlt.com', kind: 'login' as const }

const createTracker = () => {
  const notifications: RequestNotification[] = []
  const changes: string[][] = []
  const tracker = RequestTracker({
    notifyDelayMs: 300,
    onNotification: (notification) => notifications.push(notification),
    onChange: (requests) =>
      changes.push(requests.map((request) => request.status)),
  })
  const notified = () =>
    notifications.map(({ action, walletConnected }) =>
      action === 'clear'
        ? action
        : `${action}:${walletConnected ? 'connected' : 'waiting'}`,
    )
  return { tracker, notifications, notified, changes }
}

describe('RequestTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('waits for a disconnected wallet, then follows the request to its answer', () => {
    const { tracker, notified } = createTracker()

    tracker.track('a', login, 'wallet1')
    expect(tracker.get('a')?.status).toBe('waitingForWallet')
    vi.advanceTimersByTime(300)
    expect(notified()).toEqual(['create:waiting'])

    tracker.linkConnected('wallet1', true)
    expect(tracker.get('a')?.status).toBe('sending')
    expect(notified()).toEqual(['create:waiting', 'update:connected'])

    tracker.delivered('a')
    expect(tracker.get('a')?.status).toBe('deliveredToWallet')
    tracker.answered('a')
    expect(tracker.get('a')).toBeUndefined()
    expect(notified()).toEqual(['create:waiting', 'update:connected', 'clear'])
  })

  it('notifies once, as connected, a request a connected wallet receives at once', () => {
    const { tracker, notified } = createTracker()
    tracker.linkConnected('wallet1', true)

    tracker.track('a', login, 'wallet1')
    tracker.delivered('a')
    vi.advanceTimersByTime(300)

    expect(notified()).toEqual(['create:connected'])
  })

  it('never changes the notification back when the wallet flaps', () => {
    const { tracker, notified } = createTracker()
    tracker.track('a', login, 'wallet1')
    vi.advanceTimersByTime(300)

    for (let index = 0; index < 5; index += 1) {
      tracker.linkConnected('wallet1', true)
      tracker.linkConnected('wallet1', false)
    }

    expect(notified()).toEqual(['create:waiting', 'update:connected'])
  })

  it('counts any link that may send it: one connected wallet is enough', () => {
    const { tracker } = createTracker()
    tracker.linkConnected('wallet2', true)

    tracker.track('a', login, 'wallet1')
    tracker.track('a', login, 'wallet2')

    expect(tracker.get('a')?.status).toBe('sending')
    tracker.released('a', 'wallet2')
    expect(tracker.get('a')?.status).toBe('waitingForWallet')
  })

  it('fails once every link gave up, and clears its notification', () => {
    const { tracker, notified } = createTracker()
    tracker.track('a', login, 'wallet1')
    tracker.track('a', login, 'wallet2')
    vi.advanceTimersByTime(300)

    tracker.released('a', 'wallet1', true)
    expect(tracker.get('a')?.status).toBe('waitingForWallet')
    tracker.released('a', 'wallet2', true)

    expect(tracker.get('a')).toBeUndefined()
    expect(notified()).toEqual(['create:waiting', 'clear'])
  })

  it('does not notify a request cancelled before the notification was due', () => {
    const { tracker, notified } = createTracker()

    tracker.track('a', login, 'wallet1')
    tracker.cancelled('a')
    vi.advanceTimersByTime(1_000)

    expect(tracker.get('a')).toBeUndefined()
    expect(notified()).toEqual([])
  })

  it('lists the requests going on, newest first: one over leaves the list at once', () => {
    const { tracker, changes } = createTracker()
    for (const id of ['a', 'b', 'c', 'd']) {
      tracker.track(id, login, 'wallet1')
      vi.advanceTimersByTime(10)
    }
    expect(tracker.list().map((request) => request.interactionId)).toEqual([
      'd',
      'c',
      'b',
      'a',
    ])

    // Answered (or rejected) in the wallet, cancelled from the popup or by the
    // dApp, not delivered.
    tracker.answered('a')
    tracker.cancelled('b')
    tracker.released('c', 'wallet1', true)

    expect(tracker.list().map((request) => request.interactionId)).toEqual([
      'd',
    ])
    expect(changes.at(-1)).toEqual(['waitingForWallet'])
  })

  it('ignores news of a request that is over', () => {
    const { tracker, changes } = createTracker()
    tracker.track('a', login, 'wallet1')
    tracker.answered('a')
    const reported = changes.length

    tracker.delivered('a')
    tracker.released('a', 'wallet1')
    tracker.cancelled('a')

    expect(tracker.list()).toEqual([])
    expect(changes).toHaveLength(reported)
  })

  it('lists the wallets a request may go to, then the one that received it', () => {
    const { tracker } = createTracker()

    tracker.track('a', login, 'wallet1')
    tracker.track('a', login, 'wallet2')
    expect(tracker.list()[0]).toMatchObject({
      wallets: ['wallet1', 'wallet2'],
      delivered: false,
    })

    tracker.delivered('a', 'wallet2')
    expect(tracker.list()[0]).toMatchObject({
      wallets: ['wallet2'],
      delivered: true,
    })
  })

  it('reports each change, and lists origins, kinds, statuses and times only', () => {
    const { tracker, changes } = createTracker()

    tracker.track('a', login, 'wallet1')
    tracker.linkConnected('wallet1', true)

    expect(changes).toEqual([['waitingForWallet'], ['sending']])
    expect(Object.keys(tracker.list()[0]).sort()).toEqual([
      'createdAt',
      'delivered',
      'interactionId',
      'kind',
      'origin',
      'status',
      'updatedAt',
      'wallets',
    ])
    // The short keys of the wallets it is for.
    expect(tracker.list()[0].wallets).toEqual(['wallet1'])
  })
})

describe('request details', () => {
  it.each([
    [{ discriminator: 'transaction' }, 'transaction'],
    [{ discriminator: 'preAuthorizationRequest' }, 'preAuthorization'],
    [{ discriminator: 'unauthorizedRequest' }, 'data'],
    [
      {
        discriminator: 'authorizedRequest',
        auth: { discriminator: 'usePersona' },
      },
      'data',
    ],
    [
      {
        discriminator: 'authorizedRequest',
        auth: { discriminator: 'loginWithChallenge' },
      },
      'login',
    ],
    [undefined, 'request'],
  ])('tells the kind of %j', (items, kind) => {
    expect(requestKindOf(items)).toBe(kind)
  })

  it('keeps only the host name of the origin', () => {
    expect(originHostOf('https://dashboard.radixdlt.com/account/x?y=1')).toBe(
      'dashboard.radixdlt.com',
    )
    expect(originHostOf(undefined)).toBe('')
  })

  describe('a request whose wallet disconnects before answering', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    /** Tracked on wallet1, connected, and received by its wallet. */
    const inTheWallet = () => {
      const context = createTracker()
      context.tracker.linkConnected('wallet1', true)
      context.tracker.track('a', login, 'wallet1')
      context.tracker.delivered('a', 'wallet1')
      return context
    }

    it('stays in the wallet through a short drop of the link', () => {
      const { tracker } = inTheWallet()

      tracker.linkConnected('wallet1', false)
      vi.advanceTimersByTime(4_000)
      tracker.linkConnected('wallet1', true)
      vi.advanceTimersByTime(10_000)

      expect(tracker.get('a')?.status).toBe('deliveredToWallet')
    })

    it('becomes walletDisconnected once the link stays down, and stays so when it is back', () => {
      const { tracker } = inTheWallet()

      tracker.linkConnected('wallet1', false)
      vi.advanceTimersByTime(5_000)
      expect(tracker.get('a')?.status).toBe('walletDisconnected')

      // Back: the wallet may have been closed and lost it; only the user knows.
      tracker.linkConnected('wallet1', true)
      expect(tracker.get('a')?.status).toBe('walletDisconnected')
    })

    it('ends as usual if the wallet answers after all', () => {
      const { tracker } = inTheWallet()
      tracker.linkConnected('wallet1', false)
      vi.advanceTimersByTime(5_000)

      tracker.answered('a')

      expect(tracker.get('a')).toBeUndefined()
    })

    it('is being sent again once resent, and in the wallet when it confirms', () => {
      const { tracker } = inTheWallet()
      tracker.linkConnected('wallet1', false)
      vi.advanceTimersByTime(5_000)
      tracker.linkConnected('wallet1', true)

      tracker.resent('a', 'wallet1')
      expect(tracker.get('a')).toMatchObject({
        status: 'sending',
        delivered: false,
      })

      tracker.delivered('a', 'wallet1')
      expect(tracker.get('a')?.status).toBe('deliveredToWallet')
    })

    it('comes back by itself from a wallet that reports its requests, and is in it again once delivered', () => {
      const { tracker } = inTheWallet()
      tracker.walletOf('wallet1', { reportsRequests: () => true })
      tracker.linkConnected('wallet1', false)
      vi.advanceTimersByTime(5_000)
      expect(tracker.get('a')).toMatchObject({
        status: 'walletDisconnected',
        comesBack: true,
      })

      tracker.linkConnected('wallet1', true)
      tracker.redelivered('a', 'wallet1')

      expect(tracker.get('a')?.status).toBe('deliveredToWallet')
      expect(tracker.get('a')?.comesBack).toBeUndefined()
    })

    it('waits less for a wallet that reports its requests, whose link going down was checked', () => {
      const { tracker } = inTheWallet()
      tracker.walletOf('wallet1', { reportsRequests: () => true })

      tracker.linkConnected('wallet1', false)
      vi.advanceTimersByTime(1_900)
      expect(tracker.get('a')?.status).toBe('deliveredToWallet')
      vi.advanceTimersByTime(100)
      expect(tracker.get('a')?.status).toBe('walletDisconnected')
    })

    it('is in the wallet again once a wallet that reports its requests is back', () => {
      const { tracker } = inTheWallet()
      tracker.walletOf('wallet1', { reportsRequests: () => true })
      tracker.linkConnected('wallet1', false)
      vi.advanceTimersByTime(5_000)
      expect(tracker.get('a')?.status).toBe('walletDisconnected')

      // Back after a moment without network: it kept the request, nothing is sent again.
      tracker.linkConnected('wallet1', true)

      expect(tracker.get('a')?.status).toBe('deliveredToWallet')
    })

    it('finds the requests a WebRTC wallet lost from the list it sends on a new connection', () => {
      const { tracker } = inTheWallet() // 'a', delivered now
      tracker.track('b', login, 'wallet1')
      tracker.delivered('b', 'wallet1')
      const since = Date.now() + 1

      // It kept 'b' and lost 'a'; one delivered after the connection opened is not judged.
      expect(tracker.heldBy('wallet1', ['b'], since)).toEqual(['a'])
      expect(tracker.heldBy('wallet1', [], Date.now() - 60_000)).toEqual([])
      expect(tracker.heldBy('wallet2', [], since)).toEqual([])
    })

    it('is in the wallet again when the wallet lists it after its link went down', () => {
      const { tracker } = inTheWallet()
      tracker.linkConnected('wallet1', false)
      vi.advanceTimersByTime(5_000)
      expect(tracker.get('a')?.status).toBe('walletDisconnected')

      tracker.heldBy('wallet1', ['a'], Date.now())

      expect(tracker.get('a')?.status).toBe('deliveredToWallet')
    })

    it('says when the wallet that has it is in the background', () => {
      const { tracker, changes } = inTheWallet()
      const before = changes.length

      tracker.walletInBackground('wallet1', true)
      expect(tracker.get('a')?.walletInBackground).toBe(true)
      tracker.walletInBackground('wallet1', false)
      expect(tracker.get('a')?.walletInBackground).toBeUndefined()
      expect(changes.length).toBe(before + 2)
    })

    it('is not watched for a link it was not received on', () => {
      const { tracker } = inTheWallet()
      tracker.linkConnected('wallet2', false)
      vi.advanceTimersByTime(10_000)

      expect(tracker.get('a')?.status).toBe('deliveredToWallet')
    })
  })

  describe("a dApp's turn", () => {
    const other = { origin: 'other.example.com', kind: 'login' as const }

    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('keeps a request back while an earlier one of its dApp is in a wallet', () => {
      const { tracker } = createTracker()
      tracker.linkConnected('wallet1', true)
      tracker.track('a', login, 'wallet1')
      tracker.track('b', login, 'wallet1')
      tracker.track('c', other, 'wallet1')

      expect(tracker.takeTurn('a', 'wallet1')).toBe(true)
      expect(tracker.get('b')?.status).toBe('waitingForTurn')
      expect(tracker.mayGo('b')).toBe(false)
      expect(tracker.takeTurn('b', 'wallet1')).toBe(false)
      // Another dApp does not wait.
      expect(tracker.mayGo('c')).toBe(true)

      tracker.delivered('a', 'wallet1')
      tracker.sendingEnded('a', 'wallet1')
      expect(tracker.mayGo('b')).toBe(false)

      vi.advanceTimersByTime(60_000)
      tracker.answered('a')
      expect(tracker.get('b')?.status).toBe('sending')
      expect(tracker.mayGo('b')).toBe(true)
      // Its expiry counts from now, not from when it was queued.
      expect(tracker.get('b')?.turnAt).toBe(Date.now())
    })

    it('shows a request lost at once when its wallet app was closed', () => {
      const { tracker } = createTracker()
      tracker.linkConnected('wallet1', true)
      tracker.track('a', login, 'wallet1')
      tracker.delivered('a', 'wallet1')
      tracker.linkConnected('wallet1', false)
      expect(tracker.get('a')?.status).toBe('deliveredToWallet')

      tracker.walletClosed('wallet1')

      expect(tracker.get('a')?.status).toBe('walletDisconnected')
    })

    it('holds a request back from a wallet whose app is in the background, until it comes back', () => {
      const { tracker } = createTracker()
      tracker.linkConnected('wallet1', true)
      tracker.walletInBackground('wallet1', true)
      tracker.track('a', login, 'wallet1')

      expect(tracker.mayGo('a', 'wallet1')).toBe(false)
      expect(tracker.takeTurn('a', 'wallet1')).toBe(false)

      tracker.walletInBackground('wallet1', false)
      expect(tracker.mayGo('a', 'wallet1')).toBe(true)
      expect(tracker.takeTurn('a', 'wallet1')).toBe(true)
    })

    it('lets a request into the first wallet the person opens, and no other', () => {
      const { tracker } = createTracker()
      for (const wallet of ['wallet1', 'wallet2']) {
        tracker.linkConnected(wallet, true)
        tracker.walletInBackground(wallet, true)
        tracker.track('a', login, wallet)
      }
      expect(tracker.mayGo('a', 'wallet1')).toBe(false)
      expect(tracker.mayGo('a', 'wallet2')).toBe(false)

      // The person opens the second one.
      tracker.walletInBackground('wallet2', false)
      expect(tracker.mayGo('a', 'wallet1')).toBe(false)
      expect(tracker.takeTurn('a', 'wallet2')).toBe(true)
      // While it is being sent there, nobody else sends it.
      tracker.walletInBackground('wallet1', false)
      expect(tracker.mayGo('a', 'wallet1')).toBe(false)

      tracker.delivered('a', 'wallet2')
      tracker.sendingEnded('a', 'wallet2')
      // In that wallet now: the other never gets it, even opened.
      expect(tracker.mayGo('a', 'wallet1')).toBe(false)
      expect(tracker.takeTurn('a', 'wallet1')).toBe(false)
    })

    it('sends at once to a wallet that never says where its app is (the official one)', () => {
      const { tracker } = createTracker()
      tracker.linkConnected('official', true)
      tracker.track('a', login, 'official')

      expect(tracker.mayGo('a', 'official')).toBe(true)
      expect(tracker.takeTurn('a', 'official')).toBe(true)
    })

    it('tries another wallet when the one sending it could not', () => {
      const { tracker } = createTracker()
      for (const wallet of ['wallet1', 'wallet2']) {
        tracker.linkConnected(wallet, true)
        tracker.track('a', login, wallet)
      }
      expect(tracker.takeTurn('a', 'wallet1')).toBe(true)
      expect(tracker.mayGo('a', 'wallet2')).toBe(false)

      // Not delivered: the send ended without it.
      tracker.sendingEnded('a', 'wallet1')

      expect(tracker.mayGo('a', 'wallet2')).toBe(true)
    })

    it('keeps the line in order: a failed send stays first, a cancelled one lets the next go', () => {
      const { tracker } = createTracker()
      tracker.linkConnected('wallet1', true)
      tracker.track('a', login, 'wallet1')
      tracker.track('b', login, 'wallet1')
      tracker.track('c', login, 'wallet1')

      tracker.takeTurn('a', 'wallet1')
      tracker.sendingEnded('a', 'wallet1')
      // Not sent: it is tried again, still first.
      expect(tracker.mayGo('a')).toBe(true)
      expect(tracker.mayGo('b')).toBe(false)

      tracker.takeTurn('a', 'wallet1')
      tracker.cancelled('a')
      // Only the next one goes; the one after it still waits, never both at once.
      expect(tracker.get('b')?.status).toBe('sending')
      expect(tracker.get('c')?.status).toBe('waitingForTurn')
    })

    it('frees the turn of a request its wallet lost for good, not of one it gets back', () => {
      const { tracker } = createTracker()
      tracker.linkConnected('wallet1', true)
      tracker.track('a', login, 'wallet1')
      tracker.track('b', login, 'wallet1')
      tracker.delivered('a', 'wallet1')
      expect(tracker.mayGo('b')).toBe(false)

      tracker.linkConnected('wallet1', false)
      vi.advanceTimersByTime(5_000)
      expect(tracker.get('a')?.status).toBe('walletDisconnected')
      expect(tracker.mayGo('b')).toBe(true)
    })

    it('keeps the turn of a lost request that its wallet gets back by itself', () => {
      const { tracker } = createTracker()
      tracker.walletOf('wallet1', { reportsRequests: () => true })
      tracker.linkConnected('wallet1', true)
      tracker.track('a', login, 'wallet1')
      tracker.track('b', login, 'wallet1')
      tracker.delivered('a', 'wallet1')

      tracker.linkConnected('wallet1', false)
      vi.advanceTimersByTime(5_000)
      expect(tracker.get('a')?.status).toBe('walletDisconnected')
      expect(tracker.mayGo('b')).toBe(false)
    })

    it('tells its listeners after every change, until they stop', () => {
      const { tracker } = createTracker()
      const listener = vi.fn()
      const stop = tracker.onTurnChange(listener)
      tracker.track('a', login, 'wallet1')
      expect(listener).toHaveBeenCalled()

      stop()
      listener.mockClear()
      tracker.answered('a')
      expect(listener).not.toHaveBeenCalled()
    })
  })

  it('says for a few seconds how each request just over ended', () => {
    vi.useFakeTimers()
    const outcomes: Record<string, string>[] = []
    const tracker = RequestTracker({
      onChange: (_, recent) => outcomes.push(recent),
    })
    tracker.track('a', login, 'wallet1')
    tracker.track('b', login, 'wallet1')
    tracker.track('c', login, 'wallet1')

    tracker.answered('a', true)
    tracker.answered('b', false)
    tracker.cancelled('c')

    expect(outcomes.at(-1)).toEqual({
      a: 'accepted',
      b: 'rejected',
      c: 'rejected',
    })
    vi.advanceTimersByTime(6_000)
    tracker.track('d', login, 'wallet1')
    expect(outcomes.at(-1)).toEqual({})
    vi.useRealTimers()
  })
})
