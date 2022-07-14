import { filter, firstValueFrom, Subscription, tap } from 'rxjs'
import {
  wsIncomingMessageSubject,
  wsOutgoingMessageSubject,
  wsStatusSubject,
} from './subjects'

export const signalingServerClient = (url: string) => {
  let ws: WebSocket | null = null
  let subscriptions: Subscription | null

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
    if (ws) {
      ws.close()
      removeListeners()
      ws = null
    }
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
    if (ws) {
      ws.removeEventListener('message', onMessage)
      ws.removeEventListener('close', onClose)
      ws.removeEventListener('error', onError)
      ws.removeEventListener('open', onOpen)
    }
  }

  const addSubscriptions = () => {
    subscriptions = new Subscription()
    subscriptions.add(
      wsOutgoingMessageSubject.pipe(tap(sendMessage)).subscribe()
    )
  }

  const removeSubscriptions = () => {
    if (subscriptions) {
      subscriptions.unsubscribe()
      subscriptions = null
    }
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
    console.log('onError')
    wsStatusSubject.next('disconnected')
    reconnect()
  }

  const sendMessage = (message: string) => {
    if (ws) {
      ws.send(message)
    }
  }

  const waitUntilConnected = async () =>
    firstValueFrom(
      wsStatusSubject.pipe(filter((status) => status === 'connected'))
    )

  return {
    connect,
    disconnect,
    waitUntilConnected,
  }
}
