import { config } from 'config'
import { wsMessageSubject, wsStatusSubject } from './subjects'

export const signalingServerClient = () => {
  let ws: WebSocket | null = null

  const reconnect = () => {
    removeListeners()
    connect()
  }

  const connect = () => {
    ws = new WebSocket(config.ws)
    addListeners()
  }

  const disconnect = () => {
    if (ws) {
      ws.close()
      removeListeners()
      ws = null
    }
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

  const onMessage = (event: MessageEvent<string>) => {
    wsMessageSubject.next(event)
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
    if (ws) {
      ws.send(message)
    }
  }

  return {
    connect,
    disconnect,
    sendMessage,
  }
}
