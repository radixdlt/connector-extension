import React from 'react'
import ReactDOM from 'react-dom/client'
import { Main } from './containers/main/main'
import '../fonts.css'
import { BootstrapApplication } from 'bootstrap-application'
import { WebRtcContext } from 'contexts/web-rtc-context'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WebRtcContext.Provider value={BootstrapApplication({})}>
      <Main />
    </WebRtcContext.Provider>
  </React.StrictMode>
)
