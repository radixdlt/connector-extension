import { config } from 'config'
import { wsMessageSubject, wsStatusSubject } from './subjects'

let ws
let connectionId
let encryptionKey

export const connect = (connectId: string, key: string) => {
  ws = new WebSocket(config.ws)
  ws.onmessage = onMessage
  ws.onopen = onOpen
  connectionId = connectId
  encryptionKey = key
}

const onMessage = (event: MessageEvent<string>) => {
  wsMessageSubject.next(event)
}

const onOpen = () => {
  wsStatusSubject.next('connected')
}
