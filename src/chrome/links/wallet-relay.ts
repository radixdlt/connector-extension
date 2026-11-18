import { updateLocalStore } from 'chrome/helpers/storage'

/**
 * Keeps the iroh relay the wallet of `walletPublicKey` was seen on with its link,
 * so that each new iroh session knocks there. Ignored for a link that is gone
 * (forgotten meanwhile): it is never brought back.
 */
export const noteWalletRelay = (walletPublicKey: string, relayUrl: string) =>
  updateLocalStore('connections', {}, (connections) => {
    const connection = connections[walletPublicKey]
    if (!connection || connection.walletRelay === relayUrl) return connections
    return {
      ...connections,
      [walletPublicKey]: { ...connection, walletRelay: relayUrl },
    }
  })
