import { getLinkingSignatureMessage } from './../../crypto/get-linking-message'
import { ed25519 } from '@noble/curves/ed25519'
import { chromeLocalStore } from 'chrome/helpers/chrome-local-store'
import { Message } from 'chrome/messages/_types'
import { chrome } from 'jest-chrome'
import { err, errAsync } from 'neverthrow'
import { useEffect, useState } from 'react'
import { logger } from 'utils/logger'

export type Connection = {
  walletName: string
  password: string
  walletPublicKey: string
}

const defaultConnections = {}

export type Connections = Record<string, Connection>

export const useConnections = () => {
  const [connections, setConnections] = useState<Connections | null>(null)

  useEffect(() => {
    chromeLocalStore.getItem('connections').map((result) => {
      if (JSON.stringify(result.connections) !== JSON.stringify(connections)) {
        setConnections(result.connections || defaultConnections)
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
  })

  return connections
}

type ConnectionsClient = ReturnType<typeof ConnectionsClient>

const ConnectionsClient = (connections?: Connections | null) => {
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

  const addOrUpdate = (password: string, interaction: Message) => {
    const walletPublickey = interaction.publicKey
    const signature = interaction.signature
    const message = getLinkingSignatureMessage(Buffer.from(password, 'hex'))
    const validSignature = ed25519.verify(signature, message, walletPublickey)

    if (!validSignature) {
      logger.warn('Invalid Signature')
      // return errAsync({ cause: 'Invalid Signature' } as Error)
    }
    if (connections && connections[walletPublickey]) {
      connections[walletPublickey] = {
        ...connections[walletPublickey],
        password,
      }
      return chromeLocalStore.setItem({
        connections: {
          ...(connections || {}),
          [walletPublickey]: connections[walletPublickey],
        },
      })
    }

    return chromeLocalStore.setItem({
      connections: {
        ...(connections || {}),
        [walletPublickey]: {
          walletName: `Radix Wallet ${
            Object.keys(connections || {}).length + 1
          }`,
          walletPublickey,
          password,
        },
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
