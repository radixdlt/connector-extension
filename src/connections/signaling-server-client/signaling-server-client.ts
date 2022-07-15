import { Subscription, tap } from 'rxjs'
import {
  wsConnect,
  wsDisconnect,
  wsErrorSubject,
  wsIncomingMessageSubject,
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
    wsIncomingMessageSubject.next(event)
  }

  const onOpen = () => {
    wsStatusSubject.next('connected')
  }

  const onClose = () => {
    wsStatusSubject.next('disconnected')
  }

  const onError = (event: Event) => {
    wsErrorSubject.next(event)
  }

  const sendMessage = (message: string) => {
    // TODO: handle if not connected or ws is undefined
    ws?.send(message)
  }

  const bootstrap = () => {
    addSubscriptions()
  }

  bootstrap()
}
