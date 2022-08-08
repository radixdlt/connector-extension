import { config } from 'config'
import log from 'loglevel'
import {
  combineLatest,
  exhaustMap,
  filter,
  first,
  interval,
  Subscription,
  tap,
  withLatestFrom,
  skip,
} from 'rxjs'
import { subjects as allSubjects } from './subjects'

type Source = 'wallet' | 'extension'

export const SignalingServerClient = ({
  baseUrl,
  target = 'wallet',
  source = 'extension',
  subjects,
}: {
  baseUrl: string
  target?: Source
  source?: Source
  subjects: typeof allSubjects
}) => {
  const sendMessageDirection = `[${source} => ${target}]`
  const receiveMessageDirection = `[${target} => ${source}]`
  log.debug(
    `📡 created instance of signalingServerClient with baseUrl:\n${baseUrl}`
  )
  let ws: WebSocket | undefined
  subjects.wsSource.next(source)

  const connect = (connectionId: string) => {
    log.debug(
      `📡 connecting to signaling server url:\n${baseUrl}/${connectionId}?target=${target}&source=${source}`
    )
    subjects.wsStatusSubject.next('connecting')
    removeListeners()
    ws = new WebSocket(
      `${baseUrl}/${connectionId}?target=${target}&source=${source}`
    )
    addListeners(ws)
  }

  const disconnect = () => {
    log.debug(`🧹 disconnecting from signaling server...`)
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
    log.debug(`⬇️ incoming ws message:`)
    log.trace(event.data)
    subjects.wsIncomingRawMessageSubject.next(event)
  }

  const onOpen = () => {
    log.debug(
      `🟢 connected to signaling server\ntarget=${target}&source=${source}`
    )
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
    // TODO: handle if not connected or ws is undefined
    log.debug(`⬆️ ${sendMessageDirection} sending ws message:\n${message}`)
    ws?.send(message)
  }

  const subscriptions = new Subscription()
  subscriptions.add(
    subjects.wsOutgoingMessageSubject.pipe(tap(sendMessage)).subscribe()
  )
  subscriptions.add(
    combineLatest([
      subjects.wsConnectSubject,
      subjects.wsConnectionSecretsSubject,
    ])
      .pipe(
        withLatestFrom(subjects.wsStatusSubject),
        tap(([[shouldConnect, secrets], status]) => {
          if (
            status === 'disconnected' &&
            shouldConnect &&
            secrets &&
            secrets.isOk()
          ) {
            connect(secrets.value.connectionId.toString('hex'))
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
    combineLatest([subjects.wsStatusSubject, subjects.wsConnectSubject])
      .pipe(
        skip(1),
        filter(
          ([status, shouldConnect]) =>
            status === 'disconnected' && shouldConnect
        ),
        exhaustMap(() =>
          interval(config.signalingServer.reconnect.interval).pipe(
            withLatestFrom(subjects.wsConnectSubject, subjects.wsStatusSubject),
            filter(
              ([, shouldConnect, status]) =>
                shouldConnect && status === 'disconnected'
            ),
            filter(([index, , status]) => {
              log.debug(
                `🔄 lost connection to signaling server, attempting to reconnect... status: ${status}, attempt: ${
                  index + 1
                }`
              )
              subjects.wsConnectSubject.next(true)
              return status === 'connected'
            }),
            tap(() => {
              log.debug('🤙 successfully reconnected to signaling server')
            }),
            first()
          )
        )
      )
      .subscribe()
  )

  return {
    connect,
    disconnect,
    ws,
  }
}
