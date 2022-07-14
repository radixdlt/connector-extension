import { Subscription, tap } from 'rxjs'
import {
  wsIncomingMessageSubject,
  wsOutgoingMessageSubject,
  wsStatusSubject,
} from './subjects'

export const signalingServerClient = (url: string) => {
  let ws: WebSocket | undefined
  let subscriptions: Subscription | undefined

  const reconnect = () => {
    removeListeners()
    removeSubscriptions()
    connect()
  }

  const connect = () => {
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

  const onError = () => {
    wsStatusSubject.next('disconnected')
    reconnect()
  }

  const sendMessage = (message: string) => {
    // TODO: handle if not connected or ws is undefined
    ws?.send(message)
  }

  return {
    connect,
    disconnect,
  }
}
