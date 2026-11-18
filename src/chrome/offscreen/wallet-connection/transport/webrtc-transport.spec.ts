import { describe, expect, it } from 'vitest'
import { Subject } from 'rxjs'
import { splitWalletNotices } from './webrtc-transport'
import type { TransportMessage, WalletNotice } from './wallet-transport'

describe('splitWalletNotices', () => {
  it("takes the wallet's presence and held requests out of its messages, as notices", () => {
    const fromWallet = new Subject<TransportMessage>()
    const { messages$, notices$ } = splitWalletNotices(fromWallet, () => 1_000)
    const messages: TransportMessage[] = []
    const notices: WalletNotice[] = []
    messages$.subscribe((message) => messages.push(message))
    notices$.subscribe((notice) => notices.push(notice))

    fromWallet.next({ discriminator: 'walletPresence', inBackground: true })
    fromWallet.next({ discriminator: 'walletRequests', interactionIds: ['a'] })
    fromWallet.next({ discriminator: 'success', interactionId: 'a', items: {} })
    // Malformed: not notices, so they go on like any other message.
    fromWallet.next({ discriminator: 'walletPresence' })
    fromWallet.next({ discriminator: 'walletRequests', interactionIds: [1] })

    expect(notices).toEqual([
      { type: 'presence', inBackground: true },
      { type: 'requestsHeld', interactionIds: ['a'], since: 1_000 },
    ])
    expect(messages).toEqual([
      { discriminator: 'success', interactionId: 'a', items: {} },
      { discriminator: 'walletPresence' },
      { discriminator: 'walletRequests', interactionIds: [1] },
    ])
  })
})
