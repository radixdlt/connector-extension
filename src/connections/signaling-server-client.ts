import log from 'loglevel'
import { track } from 'mixpanel'
import { Subscription } from 'rxjs'
import { wsSendMessage } from './observables/ws-send-message'
import { wsConnect } from './observables/ws-connect'
import { wsReconnect } from './observables/ws-reconnect'
import { SubjectsType } from './subjects'
import { wsDisconnect } from './observables/ws-disconnect'

type Source = 'wallet' | 'extension'

export type SignalingServerClientType = ReturnType<typeof SignalingServerClient>
export type SignalingServerClientInput = {
  baseUrl: string
  target?: Source
  source?: Source
  subjects: SubjectsType
}

export const SignalingServerClient = ({
  baseUrl,
  target = 'wallet',
  source = 'extension',
  subjects,
}: SignalingServerClientInput) => {
  const sendMessageDirection = `[${source} => ${target}]`
  let t0 = 0
  let t1 = 0
  log.debug(
    `📡 created instance of signalingServerClient with baseUrl:\n${baseUrl}`
  )
  let ws: WebSocket | undefined
  subjects.wsSourceSubject.next(source)

  const connect = (connectionId: string) => {
    track('ws_connecting')
    log.debug(
      `📡 connecting to signaling server url:\n${baseUrl}/${connectionId}?target=${target}&source=${source}`
    )
    subjects.wsStatusSubject.next('connecting')
    removeListeners()
    t0 = performance.now()
    ws = new WebSocket(
      `${baseUrl}/${connectionId}?target=${target}&source=${source}`
    )
    addListeners(ws)
  }

  const disconnect = () => {
    log.debug(`🧹 disconnecting from signaling server...`)
    subjects.wsStatusSubject.next('disconnecting')
    ws?.close()
    removeListeners()
    ws = undefined
    subjects.wsStatusSubject.next('disconnected')
    track('ws_disconnected')
  }

  const addListeners = (ws: WebSocket) => {
    ws.onmessage = onMessage
    ws.onopen = onOpen
    ws.onclose = onClose
    ws.onerror = onError
  }

  const removeListeners = () => {
    ws?.removeEventListener('message', onMessage)
    ws?.removeEventListener('close', onClose)
    ws?.removeEventListener('error', onError)
    ws?.removeEventListener('open', onOpen)
  }

  const onMessage = (event: MessageEvent<string>) => {
    log.debug(`⬇️ incoming ws message:`)
    log.trace(event.data)
    subjects.wsIncomingRawMessageSubject.next(event)
  }

  const onOpen = () => {
    t1 = performance.now()
    log.debug(
      `🟢 connected to signaling server\ntarget=${target}&source=${source}\nconnect time: ${(
        t1 - t0
      ).toFixed(0)} ms`
    )
    track('ws_connected', { connectionTime: t1 - t0 })
    subjects.wsStatusSubject.next('connected')
  }

  const onClose = () => {
    log.debug('🔴 disconnected from signaling server')
    subjects.wsStatusSubject.next('disconnected')
  }

  const onError = (event: Event) => {
    log.error(`❌ got websocket error`)
    log.trace(event)
    subjects.wsErrorSubject.next(event)
  }

  const sendMessage = (message: string) => {
    log.debug(`⬆️ ${sendMessageDirection} sending ws message:\n${message}`)
    ws?.send(message)
  }

  const subscriptions = new Subscription()
  subscriptions.add(wsSendMessage(subjects, sendMessage, () => ws).subscribe())
  subscriptions.add(wsConnect(subjects, connect).subscribe())
  subscriptions.add(wsDisconnect(subjects, disconnect).subscribe())
  subscriptions.add(wsReconnect(subjects).subscribe())

  return {
    connect,
    disconnect,
    ws,
  }
}
