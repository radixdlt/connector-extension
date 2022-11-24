import ReactDOM from 'react-dom/client'
import '../../../fonts.css'
import { DevTools } from './components/dev-tools'
import { ConnectorContext } from 'contexts/connector-context'
import { Connector } from 'connector/connector'
import { SignalingServerClient } from 'connector/signaling/signaling-server-client'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ConnectorContext.Provider
    value={Connector({
      logLevel: 'debug',
      signalingServerClient: SignalingServerClient({
        source: 'wallet',
        target: 'extension',
      }),
    })}
  >
    <DevTools />
  </ConnectorContext.Provider>
)
