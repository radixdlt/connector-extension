import { describe, expect, it } from 'vitest'
import { finalRequestStatuses, type RequestStatus } from './pending-request'
import {
  activeStatusOf,
  mayMove,
  requestTransitions,
  type RequestFacts,
} from './request-lifecycle'
import { DAppTurns, type TurnEntry } from './dapp-turns'
import { WalletPresence } from './wallet-presence'

const facts = (given: Partial<RequestFacts>): RequestFacts => ({
  delivered: false,
  walletLost: false,
  waitsForTurn: false,
  holderConnected: false,
  ...given,
})

describe('the life of a request', () => {
  it('follows from what is known of it', () => {
    expect(activeStatusOf(facts({}))).toBe('waitingForWallet')
    expect(activeStatusOf(facts({ holderConnected: true }))).toBe('sending')
    expect(
      activeStatusOf(facts({ holderConnected: true, waitsForTurn: true })),
    ).toBe('waitingForTurn')
    expect(activeStatusOf(facts({ delivered: true, waitsForTurn: true }))).toBe(
      'deliveredToWallet',
    )
    expect(activeStatusOf(facts({ delivered: true, walletLost: true }))).toBe(
      'walletDisconnected',
    )
  })

  it('never moves once over, and fails only before reaching a wallet', () => {
    for (const status of finalRequestStatuses)
      expect(requestTransitions[status]).toEqual([])
    expect(mayMove('sending', 'failed')).toBe(true)
    expect(mayMove('deliveredToWallet', 'failed')).toBe(false)
    expect(mayMove('walletDisconnected', 'failed')).toBe(false)
    // In a wallet: back to a queue only when sent again.
    expect(mayMove('walletDisconnected', 'sending')).toBe(true)
    expect(mayMove('answered', 'sending')).toBe(false)
  })

  it('may end from every status going on', () => {
    const going = Object.keys(requestTransitions).filter(
      (status) => !finalRequestStatuses.includes(status as RequestStatus),
    ) as RequestStatus[]
    for (const status of going) {
      expect(mayMove(status, 'answered')).toBe(true)
      expect(mayMove(status, 'cancelled')).toBe(true)
    }
  })
})

describe("a dApp's turns", () => {
  const entry = (
    interactionId: string,
    given: Partial<TurnEntry> = {},
  ): TurnEntry => ({
    interactionId,
    origin: 'dapp.example.com',
    createdAt: 1,
    status: 'sending',
    delivered: false,
    sendingBy: new Set(),
    ...given,
  })

  it('keeps a request back behind an earlier one of its dApp, not of another', () => {
    const turns = DAppTurns(() => false)
    const first = entry('a', { createdAt: 1 })
    const second = entry('b', { createdAt: 2 })
    const other = entry('c', { createdAt: 0, origin: 'other.example.com' })
    const all = [first, second, other]

    expect(turns.waitsForTurn(first, all)).toBe(false)
    expect(turns.waitsForTurn(second, all)).toBe(true)
    // Two queued at the same time: by id, so that two never tie.
    expect(turns.waitsForTurn(entry('a', { createdAt: 2 }), [second])).toBe(
      false,
    )
  })

  it('gives the turn up when its request is lost for good, not when it comes back', () => {
    const lost = entry('a', {
      status: 'walletDisconnected',
      delivered: true,
      walletLost: true,
    })

    expect(DAppTurns(() => false).holdsTurn(lost)).toBe(false)
    expect(DAppTurns(() => true).holdsTurn(lost)).toBe(true)
    expect(
      DAppTurns(() => false).holdsTurn(
        entry('b', { sendingBy: new Set(['x']) }),
      ),
    ).toBe(true)
  })
})

describe('wallet presence', () => {
  it('knows which links are connected, in the background, and report their requests', () => {
    const presence = WalletPresence()
    let reports = false
    presence.walletOf('aaaa', { reportsRequests: () => reports })

    presence.setConnected('aaaa', true)
    expect(presence.anyConnected(['bbbb', 'aaaa'])).toBe(true)
    presence.setConnected('aaaa', false)
    expect(presence.isConnected('aaaa')).toBe(false)

    expect(presence.setInBackground('aaaa', true)).toBe(true)
    expect(presence.setInBackground('aaaa', true)).toBe(false)
    expect(presence.inBackground('aaaa')).toBe(true)

    // Asked when needed: the transport may change.
    expect(presence.reportsRequests('aaaa')).toBe(false)
    reports = true
    expect(presence.reportsRequests('aaaa')).toBe(true)
    expect(presence.reportsRequests(undefined)).toBe(false)
  })
})
