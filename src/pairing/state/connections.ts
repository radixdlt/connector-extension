import { getLinkingSignatureMessage } from './../../crypto/get-linking-message'
import { ed25519 } from '@noble/curves/ed25519'
import { Account } from '@radixdlt/radix-dapp-toolkit'
import { chromeLocalStore } from 'chrome/helpers/chrome-local-store'
import { LinkClientInteraction } from 'ledger/schemas'
import { errAsync } from 'neverthrow'
import { useEffect, useState } from 'react'
import { logger } from 'utils/logger'

export type Connection = {
  walletName: string
  password: string
  walletPublicKey: string
  accounts: Account[]
}

export type Connections = Record<string, Connection>

export const useConnections = () => {
  const [connections, setConnections] = useState<Connections | null>(null)

  useEffect(() => {
    chromeLocalStore.getItem('connections').map((result) => {
      if (JSON.stringify(result.connections) !== JSON.stringify(connections)) {
        setConnections(result.connections || {})
      }
    })
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (changes['connections'] && area === 'local') {
        setConnections(changes['connections'].newValue)
      }
    }
    chrome.storage.onChanged.addListener(listener)

    return () => {
      chrome.storage.onChanged.removeListener(listener)
    }
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

    return chromeLocalStore.setItem({
      connections: {
        ...connections,
        [connectionId]: connection,
      },
    })
  }

  const remove = (connectionId: string) => {
    if (!connections) return
    const { [connectionId]: _, ...rest } = connections
    return chromeLocalStore.setItem({
      connections: rest,
    })
  }

  const hasConnections = () => {
    return connections && Object.keys(connections).length > 0
  }

  const isLoading = () => {
    return connections === null
  }

  const entries = () => {
    return Object.entries(connections || {})
  }

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
        return errAsync({ cause: 'Invalid Signature' } as Error)
      }
    }

    const knownConnection = connections && connections[walletPublicKey]
    const numberOfExistingConnections = Object.keys(connections || {}).length
    const updatedConnections = {
      connections: {
        ...(connections || {}),
        [walletPublicKey]: {
          walletName:
            knownConnection?.walletName ||
            `Radix Wallet ${numberOfExistingConnections + 1}`,
          walletPublicKey,
          password,
          accounts: knownConnection?.accounts || [],
        },
      },
    }

    return chromeLocalStore.setItem(updatedConnections).map(() => ({
      isKnownConnection: !!knownConnection,
    }))
  }

  const updateAccounts = (walletPublicKey: string, accounts: Account[]) => {
    if (!connections) return
    const connection = {
      ...connections[walletPublicKey],
      accounts,
    } satisfies Connection
    return chromeLocalStore.setItem({
      connections: {
        ...connections,
        [walletPublicKey]: connection,
      },
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
  const [connectionsClient, setConnectionsClient] = useState<ConnectionsClient>(
    ConnectionsClient(connections),
  )

  useEffect(() => {
    setConnectionsClient(ConnectionsClient(connections))
  }, [connections])

  return connectionsClient
}
