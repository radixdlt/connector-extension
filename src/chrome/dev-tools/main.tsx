import ReactDOM from 'react-dom/client'
import '../../../fonts.css'
import { DevToolsWrapper } from './dev-tools'
import { ConnectorContext } from 'contexts/connector-context'
import { Connector } from 'connector/connector'
import { config } from 'config'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ConnectorContext.Provider
    value={Connector({
      logLevel: 'debug',
      signalingClientOptions: {
        ...config.signalingServer,
        source: 'wallet',
        target: 'extension',
      },
    })}
  >
    <DevToolsWrapper />
  </ConnectorContext.Provider>
)
