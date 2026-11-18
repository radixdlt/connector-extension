import type { Observable, Subscription } from 'rxjs'
import {
  shortWalletKey,
  type TransportName,
} from './wallet-connection/transport/diagnostics'

/**
 * The transport each linked wallet is reached through now (`none`: not
 * connected), by short wallet key: what the popup shows on each wallet card.
 */
export type LinkStatuses = Record<string, TransportName | 'none'>

export type LinkStatusTracker = ReturnType<typeof LinkStatusTracker>

/**
 * Follows the links of the offscreen document and calls `onChange` with every
 * link's status whenever one changes, so that the popup need not ask again and
 * again.
 */
export const LinkStatusTracker = (input: {
  onChange: (statuses: LinkStatuses) => void
}) => {
  const statuses = new Map<string, TransportName | 'none'>()
  const subscriptions = new Map<string, Subscription>()

  const list = (): LinkStatuses => Object.fromEntries(statuses)

  return {
    /** Follows a link, replacing an earlier one of the same wallet. */
    follow: (
      walletPublicKey: string,
      sendingVia$: Observable<TransportName | undefined>,
    ) => {
      const key = shortWalletKey(walletPublicKey)
      subscriptions.get(key)?.unsubscribe()
      subscriptions.set(
        key,
        sendingVia$.subscribe((via) => {
          const status = via ?? 'none'
          if (statuses.get(key) === status) return
          statuses.set(key, status)
          input.onChange(list())
        }),
      )
    },
    /** The link was closed (its wallet forgotten). */
    forget: (walletPublicKey: string) => {
      const key = shortWalletKey(walletPublicKey)
      subscriptions.get(key)?.unsubscribe()
      subscriptions.delete(key)
      if (statuses.delete(key)) input.onChange(list())
    },
    list,
  }
}
