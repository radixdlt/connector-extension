import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import '../../fonts.css'
import { Connector } from 'connector/connector'
import { ConnectorContext } from 'contexts/connector-context'
import { Paring } from 'pairing/pairing'
import { useConnector } from 'hooks/use-connector'

const PairingWrapper = () => {
  const connector = useConnector()

  useEffect(() => {
    if (!connector) return
    connector.connect()
  }, [connector])

  return <Paring />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConnectorContext.Provider value={Connector({})}>
      <PairingWrapper />
    </ConnectorContext.Provider>
  </React.StrictMode>
)
