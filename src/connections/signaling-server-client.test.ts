import WSS from 'jest-websocket-mock'
import { signalingServerClient } from './signaling-server-client'
import {
  Status,
  wsStatusSubject,
  wsErrorSubject,
  wsOutgoingMessageSubject,
  wsIncomingMessageSubject,
} from './subjects'
import { subscribeSpyTo } from '@hirez_io/observer-spy'
import { filter, firstValueFrom } from 'rxjs'

const url = 'ws://localhost:1234'
let wss: WSS
let client = signalingServerClient(url)

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
    client.connect()
    await waitUntilConnected()
    expect(wsStatusSpy.getValues()).toEqual([
      'disconnected',
      'connecting',
      'connected',
    ])
  })

  it('should emit error and status', async () => {
    client.connect()
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
    client.connect()
    await waitUntilConnected()

    wsOutgoingMessageSubject.next('hi from client')

    expect(wss).toReceiveMessage('hi from client')
  })

  it('should receive a message from ws server', async () => {
    client.connect()
    await waitUntilConnected()

    wss.send('hi from ws server')

    const message: MessageEvent<string>[] = wsIncomingMessageSpy.getValues()

    expect(message[0].data).toBe('hi from ws server')
  })
})
