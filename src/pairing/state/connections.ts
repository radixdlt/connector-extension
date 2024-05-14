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
        setConnections(result.connections || null)
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

  const hasNoConnections = () => {
    return connections && Object.keys(connections).length === 0
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

    if (connections && connections[walletPublicKey]) {
      connections[walletPublicKey] = {
        ...connections[walletPublicKey],
        password,
      }
      return chromeLocalStore.setItem({
        connections: {
          ...(connections || {}),
          [walletPublicKey]: connections[walletPublicKey],
        },
      })
    }

    return chromeLocalStore.setItem({
      connections: {
        ...(connections || {}),
        [walletPublicKey]: {
          walletName: `Radix Wallet ${
            Object.keys(connections || {}).length + 1
          }`,
          walletPublicKey,
          password,
        },
      },
    })
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
    hasNoConnections,
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
    logger.debug('Connections updated', connections)
    setConnectionsClient(ConnectionsClient(connections))
  }, [connections])

  return connectionsClient
}
