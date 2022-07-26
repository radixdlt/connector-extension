import log from 'loglevel'
import { Subscription, tap } from 'rxjs'
import {
  wsConnect,
  wsDisconnect,
  wsErrorSubject,
  wsIncomingRawMessageSubject,
  wsOutgoingMessageSubject,
  wsStatusSubject,
} from '../subjects'

export const signalingServerClient = (url: string) => {
  let ws: WebSocket | undefined
  let subscriptions: Subscription | undefined

  const connect = () => {
    wsStatusSubject.next('connecting')

    removeListeners()
    removeSubscriptions()

    ws = new WebSocket(url)

    addListeners()
    addSubscriptions()
  }

  const disconnect = () => {
    ws?.close()
    removeListeners()
    ws = undefined
    removeSubscriptions()
  }

  const addListeners = () => {
    if (ws) {
      ws.onmessage = onMessage
      ws.onopen = onOpen
      ws.onclose = onClose
      ws.onerror = onError
    }
  }

  const removeListeners = () => {
    ws?.removeEventListener('message', onMessage)
    ws?.removeEventListener('close', onClose)
    ws?.removeEventListener('error', onError)
    ws?.removeEventListener('open', onOpen)
  }

  const addSubscriptions = () => {
    subscriptions = new Subscription()
    subscriptions.add(
      wsOutgoingMessageSubject.pipe(tap(sendMessage)).subscribe()
    )
    subscriptions.add(wsConnect.pipe(tap(connect)).subscribe())
    subscriptions.add(wsDisconnect.pipe(tap(disconnect)).subscribe())
  }

  const removeSubscriptions = () => {
    subscriptions?.unsubscribe()
    subscriptions = undefined
  }

  const onMessage = (event: MessageEvent<string>) => {
    log.debug(`⬇️ incoming ws message: \n ${event.data}`)
    wsIncomingRawMessageSubject.next(event)
  }

  const onOpen = () => {
    log.trace('🟢 connected to websocket')
    wsStatusSubject.next('connected')
  }

  const onClose = () => {
    log.trace('🔴 disconnected from websocket')
    wsStatusSubject.next('disconnected')
  }

  const onError = (event: Event) => {
    log.error(event)
    wsErrorSubject.next(event)
  }

  const sendMessage = (message: string) => {
    // TODO: handle if not connected or ws is undefined
    log.debug(`⬆️ sending ws message: \n ${message}`)
    ws?.send(message)
  }

  const bootstrap = () => {
    addSubscriptions()
  }

  bootstrap()
}
