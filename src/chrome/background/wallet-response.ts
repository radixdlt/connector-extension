import { RadixNetworkConfigById } from '@radixdlt/babylon-gateway-api-sdk'
import { localStore } from 'chrome/helpers/storage'
import { shortWalletKey } from 'chrome/offscreen/wallet-connection/transport/diagnostics'
import { recordWalletUsed } from 'pairing/state/wallet-records'
import type { AppLogger } from 'utils/logger'
import { createGatewayModule } from './create-gateway-module'
import { notificationDispatcher } from './notification-dispatcher'

/**
 * What the background reads of a wallet's answer to a dApp, which the offscreen
 * document passes on with the session and the wallet: never its other contents.
 */
export type WalletResponseSummary = {
  discriminator?: string
  items?: {
    discriminator?: string
    send?: { transactionIntentHash?: string }
  }
  metadata?: {
    sessionId?: string
    walletPublicKey?: string
    networkId?: number
  }
}

/**
 * The dApp session goes to the wallet that answered it, unless it already goes to
 * another one (then only logged). A failure routes nothing.
 */
const routeSession = (response: WalletResponseSummary, logger?: AppLogger) => {
  const sessionId = response.metadata?.sessionId
  const walletPublicKey = response.metadata?.walletPublicKey
  if (
    !sessionId ||
    !walletPublicKey ||
    !response.discriminator ||
    response.discriminator === 'failure'
  )
    return
  localStore.get('sessionRouter').map((data) => {
    if (!data) {
      return localStore.set('sessionRouter', {
        [sessionId]: walletPublicKey,
      })
    }

    if (data[sessionId] && data[sessionId] !== walletPublicKey) {
      logger?.warn(
        'a dApp session is routed to another wallet than the one that answered',
        {
          routedTo: shortWalletKey(data[sessionId]),
          answeredBy: shortWalletKey(walletPublicKey),
        },
      )
    } else if (!data[sessionId]) {
      return localStore.set('sessionRouter', {
        ...data,
        [sessionId]: walletPublicKey,
      })
    }
  })
}

/** A transaction the wallet sent, on a network with a gateway: its status is followed. */
const transactionOf = (response: WalletResponseSummary) => {
  const txIntentHash = response.items?.send?.transactionIntentHash
  const networkId = response.metadata?.networkId
  return response.items?.discriminator === 'transaction' &&
    txIntentHash &&
    networkId &&
    RadixNetworkConfigById[networkId]?.gatewayUrl
    ? { txIntentHash, networkId }
    : undefined
}

/** Shows the outcome of a transaction the wallet sent, once the network has it. */
const followTransaction = (
  response: WalletResponseSummary,
  logger?: AppLogger,
) => {
  const transaction = transactionOf(response)
  if (!transaction) return
  const { txIntentHash, networkId } = transaction
  logger?.debug('🔁 Polling', { txIntentHash, networkId })
  createGatewayModule(networkId)
    .pollTransactionStatus(txIntentHash)
    .map((result) => {
      notificationDispatcher.transaction(networkId, txIntentHash, result.status)
    })
}

/**
 * A wallet answered a dApp: the wallet was used (for sorting the wallets), the
 * dApp's session goes to it, and a transaction it sent is followed.
 */
export const onWalletResponse = (
  response: WalletResponseSummary | undefined,
  logger?: AppLogger,
) => {
  if (!response) return
  const walletPublicKey = response.metadata?.walletPublicKey
  // For sorting the wallets by when they were last used.
  if (walletPublicKey) recordWalletUsed(walletPublicKey)
  routeSession(response, logger)
  followTransaction(response, logger)
}
