import React from 'react'
import ReactDOM from 'react-dom/client'
import '../../../fonts.css'
import { Bootstrap } from 'bootstrap/bootstrap'
import { WebRtcContext } from 'contexts/web-rtc-context'
import { config } from 'config'
import { Main } from './main'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <WebRtcContext.Provider
    value={Bootstrap({
      logLevel: 'info',
      storageLogLevel: 'debug',
      signalingLogLevel: 'debug',
      signalingClientOptions: {
        ...config.signalingServer,
        source: 'wallet',
        target: 'extension',
      },
    })}
  >
    <Main />
  </WebRtcContext.Provider>
)
