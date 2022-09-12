import React from 'react'
import ReactDOM from 'react-dom/client'
import { Main } from './containers/main/main'
import '../fonts.css'
import { Bootstrap } from 'bootstrap/bootstrap'
import { WebRtcContext } from 'contexts/web-rtc-context'

chrome.runtime.sendMessage({})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WebRtcContext.Provider value={Bootstrap({})}>
      <Main />
    </WebRtcContext.Provider>
  </React.StrictMode>
)
