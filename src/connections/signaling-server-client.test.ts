import WSS from 'jest-websocket-mock'
import { signalingServerClient } from './signaling-server-client'
import {
  Status,
  wsStatusSubject,
  wsErrorSubject,
  wsOutgoingMessageSubject,
  wsIncomingMessageSubject,
  wsConnect,
  messageConfirmation,
} from './subjects'
import { subscribeSpyTo } from '@hirez_io/observer-spy'
import { filter, firstValueFrom } from 'rxjs'
import { ok } from 'neverthrow'

const delay = (delayTime = 300) =>
  new Promise((resolve) => {
    setTimeout(resolve, delayTime)
  })

const url = 'ws://localhost:1234'
let wss: WSS
signalingServerClient(url)

let wsStatusSpy: ReturnType<typeof subscribeSpyTo<Status>>
let wsErrorSpy: ReturnType<typeof subscribeSpyTo<Event>>
let wsIncomingMessageSpy: ReturnType<
  typeof subscribeSpyTo<MessageEvent<string>>
>

const waitUntilConnected = async () =>
  firstValueFrom(
    wsStatusSubject.pipe(filter((status) => status === 'connected'))
  )

describe('Signaling server client', () => {
  beforeEach(async () => {
    wsStatusSpy = subscribeSpyTo(wsStatusSubject)
    wsErrorSpy = subscribeSpyTo(wsErrorSubject)
    wsIncomingMessageSpy = subscribeSpyTo(wsIncomingMessageSubject)
    wss = new WSS(url)
  })

  afterEach(() => {
    WSS.clean()
  })

  it('should successfully connect and emit status', async () => {
    wsConnect.next()
    await waitUntilConnected()
    expect(wsStatusSpy.getValues()).toEqual([
      'disconnected',
      'connecting',
      'connected',
    ])
  })

  it('should emit error and status', async () => {
    wsConnect.next()
    await waitUntilConnected()
    wss.error()
    expect(wsErrorSpy.getValues()[0]).toBeTruthy()
    expect(wsStatusSpy.getValues()).toEqual([
      'disconnected',
      'connecting',
      'connected',
      'disconnected',
    ])
  })

  it('should send a message to ws server', async () => {
    wsConnect.next()
    await waitUntilConnected()

    wsOutgoingMessageSubject.next('hi from client')

    expect(wss).toReceiveMessage('hi from client')
  })

  it('should receive a message from ws server', async () => {
    wsConnect.next()
    await waitUntilConnected()

    wss.send('hi from ws server')

    const message: MessageEvent<string>[] = wsIncomingMessageSpy.getValues()

    expect(message[0].data).toBe('hi from ws server')
  })

  it('should send a message with ok confirmation', async () => {
    wsConnect.next()
    await waitUntilConnected()

    const message = { requestId: '111' }

    const messageConfirmationSpy = subscribeSpyTo(
      messageConfirmation(message.requestId, 1000)
    )

    wsOutgoingMessageSubject.next(JSON.stringify(message))

    expect(wss).toReceiveMessage(JSON.stringify(message))

    wss.send(JSON.stringify({ valid: message }))

    expect(messageConfirmationSpy.getValues()).toEqual([ok('111')])
  })
})
