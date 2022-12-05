import { config } from 'config'
import log, { Logger } from 'loglevel'
import { SignalingSubjectsType, SignalingSubjects } from './subjects'
import { SignalingSubscriptions } from './subscriptions'

type Source = 'wallet' | 'extension'

export type SignalingServerClientType = ReturnType<typeof SignalingServerClient>
export type SignalingServerClientInput = {
  logger?: Logger
  baseUrl?: string
  target?: Source
  source?: Source
  subjects?: SignalingSubjectsType
}

export const SignalingServerClient = ({
  logger = log,
  baseUrl = config.signalingServer.baseUrl,
  target = 'wallet',
  source = 'extension',
  subjects = SignalingSubjects(),
}: SignalingServerClientInput) => {
  const sendMessageDirection = `[${source} => ${target}]`
  let t0 = 0
  let t1 = 0
  let ws: WebSocket | undefined
  subjects.wsSourceSubject.next(source)

  const connect = (connectionId: string) => {
    logger.debug(
      `📡⚪️ connecting to signaling server\n${baseUrl}/${connectionId}?target=${target}&source=${source}`
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
    logger.debug(`📡⚪️ disconnecting from signaling server`)
    subjects.wsStatusSubject.next('disconnecting')
    ws?.close()
    removeListeners()
    ws = undefined
    subjects.wsStatusSubject.next('disconnected')
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
    subjects.wsIncomingRawMessageSubject.next(event)
  }

  const onOpen = () => {
    t1 = performance.now()
    logger.debug(
      `📡🟢 connected to signaling server\ntarget=${target}&source=${source}\nconnect time: ${(
        t1 - t0
      ).toFixed(0)} ms`
    )
    subjects.wsStatusSubject.next('connected')
  }

  const onClose = () => {
    logger.debug('📡🔴 disconnected from signaling server')
    subjects.wsStatusSubject.next('disconnected')
  }

  const onError = (event: Event) => {
    logger.error(`📡❌ got websocket error`)
    logger.trace(event)
    subjects.wsErrorSubject.next(event)
  }

  const sendMessage = (message: string) => {
    logger.debug(`📡⬆️💬 ${sendMessageDirection} sending ws message`)
    ws?.send(message)
  }

  const getWs = () => ws

  const subscriptions = SignalingSubscriptions(
    subjects,

    {
      sendMessage,
      connect,
      disconnect,
      getWs,
    },
    logger
  )

  const destroy = () => {
    subjects.wsConnectSubject.next(false)
    disconnect()
    subscriptions.unsubscribe()
  }

  return {
    destroy,
    subjects,
    connect: (value: boolean) => subjects.wsConnectSubject.next(value),
  }
}
