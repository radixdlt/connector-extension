import React from 'react'
import ReactDOM from 'react-dom/client'
import '../../fonts.css'
import { Bootstrap } from 'bootstrap/bootstrap'
import { WebRtcContext } from 'contexts/web-rtc-context'
import { Paring } from 'pairing/pairing'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WebRtcContext.Provider value={Bootstrap({ logLevel: 'debug' })}>
      <Paring />
    </WebRtcContext.Provider>
  </React.StrictMode>
)
