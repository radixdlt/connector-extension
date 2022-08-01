import { config } from 'config'
import log from 'loglevel'
import {
  exhaustMap,
  filter,
  first,
  interval,
  Subscription,
  tap,
  withLatestFrom,
} from 'rxjs'
import {
  wsConnect,
  wsErrorSubject,
  wsIncomingRawMessageSubject,
  wsOutgoingMessageSubject,
  wsStatusSubject,
} from '../subjects'

export const signalingServerClient = (url: string) => {
  let ws: WebSocket | undefined

  const connect = () => {
    log.debug(`📡 connecting to signaling server...`)
    wsStatusSubject.next('connecting')
    removeListeners()
    ws = new WebSocket(url)
    addListeners(ws)
  }

  const disconnect = () => {
    log.debug(`🧹 disconnecting from signaling server...`)
    ws?.close()
    removeListeners()
    ws = undefined
    wsStatusSubject.next('disconnected')
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
    log.debug(`⬇️ incoming ws message: \n ${event.data}`)
    wsIncomingRawMessageSubject.next(event)
  }

  const onOpen = () => {
    log.debug('🟢 connected to signaling server')
    wsStatusSubject.next('connected')
  }

  const onClose = () => {
    log.debug('🔴 disconnected from signaling server')
    wsStatusSubject.next('disconnected')
  }

  const onError = (event: Event) => {
    log.error(`❌ got websocket error`)
    log.trace(event)
    wsErrorSubject.next(event)
  }

  const sendMessage = (message: string) => {
    // TODO: handle if not connected or ws is undefined
    log.debug(`⬆️ sending ws message: \n ${message}`)
    ws?.send(message)
  }

  const subscriptions = new Subscription()
  subscriptions.add(wsOutgoingMessageSubject.pipe(tap(sendMessage)).subscribe())
  subscriptions.add(
    wsConnect
      .pipe(
        withLatestFrom(wsStatusSubject),
        tap(([shouldConnect, status]) => {
          if (status === 'disconnected' && shouldConnect) {
            connect()
          } else if (
            ['connection', 'connected'].includes(status) &&
            !shouldConnect
          ) {
            disconnect()
          }
        })
      )
      .subscribe()
  )
  subscriptions.add(
    wsStatusSubject
      .pipe(
        filter((status) => status === 'disconnected'),
        withLatestFrom(wsConnect),
        filter(([, shouldConnect]) => shouldConnect),
        exhaustMap(() => {
          log.debug(
            '🔄 lost connection to signaling server, trying to reconnect...'
          )

          connect()

          return interval(config.signalingServer.reconnect.interval).pipe(
            withLatestFrom(wsConnect, wsStatusSubject),
            filter(([, shouldConnect]) => shouldConnect),
            filter(([index, , status]) => {
              log.debug(
                `🔄 connection status: ${status}, attempt: ${index + 1}`
              )
              wsConnect.next(true)
              return status === 'connected'
            }),
            tap(() => {
              log.debug('🤙 successfully reconnected to signaling server')
            }),
            first()
          )
        })
      )
      .subscribe()
  )

  return {
    connect,
    disconnect,
    ws,
  }
}
