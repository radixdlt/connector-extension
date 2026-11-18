import { describe, expect, it } from 'vitest'
import { expiredRequests, type PendingRequest } from './pending-request'

const minutes = (n: number) => n * 60_000
const now = Date.now()

const request = (
  interactionId: string,
  changes: Partial<PendingRequest>,
): PendingRequest => ({
  interactionId,
  origin: 'dapp.example.com',
  kind: 'transaction',
  status: 'waitingForWallet',
  wallets: ['w1'],
  delivered: false,
  createdAt: now - minutes(6),
  updatedAt: now,
  ...changes,
})

describe('expiredRequests', () => {
  it('cancels what no wallet is answering, never what is in a wallet', () => {
    const requests = [
      request('waiting', { status: 'waitingForWallet' }),
      request('sending', { status: 'sending' }),
      request('lost', { status: 'walletDisconnected', delivered: true }),
      request('comesBack', {
        status: 'walletDisconnected',
        delivered: true,
        comesBack: true,
      }),
      request('inWallet', { status: 'deliveredToWallet', delivered: true }),
      request('inBackground', {
        status: 'deliveredToWallet',
        delivered: true,
        walletInBackground: true,
      }),
    ]

    expect(
      expiredRequests(requests, '5m', now).map((r) => r.interactionId),
    ).toEqual(['waiting', 'sending', 'lost'])
  })

  it('waits as long as the option says, and never with "never"', () => {
    const young = request('young', { createdAt: now - minutes(4) })
    const old = request('old', { createdAt: now - minutes(16) })

    expect(
      expiredRequests([young, old], '5m', now).map((r) => r.interactionId),
    ).toEqual(['old'])
    expect(expiredRequests([young, old], '2m', now)).toHaveLength(2)
    expect(expiredRequests([young, old], '15m', now)).toHaveLength(1)
    expect(expiredRequests([young, old], 'never', now)).toEqual([])
  })

  it('never cancels one waiting for its turn, and counts from when it got it', () => {
    const waiting = request('waiting', { status: 'waitingForTurn' })
    const justGotIt = request('justGotIt', {
      status: 'sending',
      turnAt: now - minutes(1),
    })

    expect(expiredRequests([waiting, justGotIt], '5m', now)).toEqual([])
    expect(
      expiredRequests([justGotIt], '5m', now + minutes(5)).map(
        (r) => r.interactionId,
      ),
    ).toEqual(['justGotIt'])
  })
})
