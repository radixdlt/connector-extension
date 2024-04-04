import { chromeLocalStore } from 'chrome/helpers/chrome-local-store'
import { chrome } from 'jest-chrome'
import { useEffect, useState } from 'react'

export type Connection = {
  walletName: string
  password: string
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

  const add = (password: string) => {
    return chromeLocalStore.setItem({
      connections: {
        ...(connections || {}),
        [crypto.randomUUID()]: {
          walletName: `Radix Wallet ${
            Object.keys(connections || {}).length + 1
          }`,
          password,
        } satisfies Connection,
      },
    })
  }

  return {
    add,
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
