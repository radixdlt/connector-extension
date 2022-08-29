import { BootstrapApplication } from 'bootstrap-application'

const webRTC = BootstrapApplication({})
webRTC.webRtcClient.subjects.wsConnectSubject.next(true)

window.addEventListener('radix#chromeExtension#send', (event) => {
  const { detail } = event as CustomEvent<any>
  webRTC.messageClient.subjects.addMessageSubject.next(detail)
})
