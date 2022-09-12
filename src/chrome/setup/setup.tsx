import React from 'react'
import ReactDOM from 'react-dom/client'
import '../../../fonts.css'
import { Bootstrap } from 'bootstrap/bootstrap'
import { WebRtcContext } from 'contexts/web-rtc-context'
import { Setup } from 'containers/setup/setup'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WebRtcContext.Provider value={Bootstrap({})}>
      <Setup />
    </WebRtcContext.Provider>
  </React.StrictMode>
)
