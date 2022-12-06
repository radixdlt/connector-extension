import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import '../../fonts.css'
import { Connector } from 'connector/connector'
import { ConnectorContext } from 'contexts/connector-context'
import { Paring } from 'pairing/pairing'
import { useConnector } from 'hooks/use-connector'
import { StorageClient } from 'connector/storage/storage-client'
import { config } from 'config'
import './style.css'

const PairingWrapper = () => {
  const connector = useConnector()

  useEffect(() => {
    if (!connector) return
    connector.getConnectionPassword().map((password) => {
      if (!password) connector.connect()
    })
  }, [connector])

  return <Paring />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConnectorContext.Provider
      value={Connector({
        storageClient: StorageClient({ id: config.storage.key }),
      })}
    >
      <PairingWrapper />
    </ConnectorContext.Provider>
  </React.StrictMode>
)
