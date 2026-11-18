import { getLinkingSignatureMessage } from './../../crypto/get-linking-message'
import { ed25519 } from '@noble/curves/ed25519'
import type { Account } from '@radixdlt/radix-dapp-toolkit'
import { localStore } from 'chrome/helpers/storage'
import { forgetWalletRecords, recordWalletLinked } from './wallet-records'
import { retireLink } from 'chrome/links/retired-links'
import type { LinkClientInteraction } from 'ledger/schemas'
import { errAsync } from 'neverthrow'
import { useEffect, useMemo, useState } from 'react'

export type Connection = {
  walletName: string
  password: string
  walletPublicKey: string
  accounts: Account[]
  /**
   * The iroh relay the wallet was last seen on: each new iroh session knocks
   * there, so a wallet that is up connects at once. A stale one only means no knock.
   */
  walletRelay?: string
}

export type Connections = Record<string, Connection>

/**
 * The link stored when a wallet is linked. A wallet linked again (a new password)
 * keeps its name, its accounts and the relay it was last seen on: its device has
 * not moved, and without that relay the next iroh sessions could not knock until
 * one of them happened to see it.
 */
export const linkedConnection = ({
  walletPublicKey,
  password,
  knownConnection,
  numberOfExistingConnections,
}: {
  walletPublicKey: string
  password: string
  knownConnection: Connection | null | undefined
  numberOfExistingConnections: number
}): Connection => ({
  walletName:
    knownConnection?.walletName ||
    `Radix Wallet ${numberOfExistingConnections + 1}`,
  walletPublicKey,
  password,
  accounts: knownConnection?.accounts || [],
  ...(knownConnection?.walletRelay
    ? { walletRelay: knownConnection.walletRelay }
    : {}),
})

export const useConnections = () => {
  const [connections, setConnections] = useState<Connections | null>(null)

  useEffect(() => {
    localStore.get('connections').map((stored) => {
      if (JSON.stringify(stored) !== JSON.stringify(connections)) {
        setConnections(stored || {})
      }
    })
    return localStore.onChange('connections', (next) =>
      setConnections(next ?? null),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribes once, on mount
  }, [])

  return connections
}

export type ConnectionsClient = ReturnType<typeof ConnectionsClient>

/**
 * Allows manipulation and listing of wallet connections known in Connector Extension.
 */
export const ConnectionsClient = (connections?: Connections | null) => {
  const updateName = (walletName: string, connectionId: string) => {
    if (!connections) return
    const connection = {
      ...connections[connectionId],
      walletName,
    } satisfies Connection

    return localStore.set('connections', {
      ...connections,
      [connectionId]: connection,
    })
  }

  /**
   * Forgets a linked wallet. `tellWallet` (the default, when the user forgets it
   * here) keeps a notice for the wallet, which then deletes its end of the link;
   * not when the wallet itself removed the link. Only wallets that have connected
   * over iroh (their relay is known) get it: the released wallet has no
   * `linkRemoved` message.
   */
  const remove = (connectionId: string, { tellWallet = true } = {}) => {
    const connection = connections?.[connectionId]
    if (!connections || !connection) return
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omits the key from the rest
    const { [connectionId]: _, ...rest } = connections
    forgetWalletRecords(connectionId)
    if (tellWallet && connection.walletRelay) retireLink(connection)
    return localStore.set('connections', rest)
  }

  const hasConnections = () =>
    connections && Object.keys(connections).length > 0

  const isLoading = () => connections === null

  const entries = () => Object.entries(connections || {})

  const addOrUpdate = (
    password: string,
    interaction: LinkClientInteraction,
  ) => {
    const walletPublicKey = interaction.publicKey
    const signature = interaction.signature
    if (signature) {
      const message = getLinkingSignatureMessage(Buffer.from(password, 'hex'))
      const validSignature = ed25519.verify(signature, message, walletPublicKey)

      if (!validSignature) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- keeps the error shape callers get
        return errAsync({ cause: 'Invalid Signature' } as Error)
      }
    }

    const knownConnection = connections && connections[walletPublicKey]
    const numberOfExistingConnections = Object.keys(connections || {}).length
    const updatedConnections: Connections = {
      ...(connections || {}),
      [walletPublicKey]: linkedConnection({
        walletPublicKey,
        password,
        knownConnection,
        numberOfExistingConnections,
      }),
    }

    return localStore.set('connections', updatedConnections).map(() => {
      if (!knownConnection) recordWalletLinked(walletPublicKey)
      return { isKnownConnection: !!knownConnection }
    })
  }

  const updateAccounts = (walletPublicKey: string, accounts: Account[]) => {
    if (!connections) return
    const connection = {
      ...connections[walletPublicKey],
      accounts,
    } satisfies Connection
    return localStore.set('connections', {
      ...connections,
      [walletPublicKey]: connection,
    })
  }

  return {
    addOrUpdate,
    remove,
    entries,
    isLoading,
    updateName,
    hasConnections,
    updateAccounts,
    connections,
  }
}

export const useConnectionsClient = () => {
  const connections = useConnections()
  // Made with the connections it is rendered with: not one render behind them.
  return useMemo(() => ConnectionsClient(connections), [connections])
}
